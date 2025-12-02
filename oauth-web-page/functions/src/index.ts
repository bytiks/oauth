import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { randomUUID as nodeRandomUUID, randomBytes } from 'crypto';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore instance
const db = admin.firestore();

interface GenerateTokenRequest {
  sessionId: string;
  uid: string;
}

/**
 * Creates a short-lived auth session document and returns a server-generated sessionId.
 * This enforces single-use login URLs and prevents client-controlled session IDs.
 */
export const createAuthSession = functions.https.onRequest(async (req, res) => {
  functions.logger.info('🎟️ createAuthSession called', { method: req.method });

  // CORS for local development and plugin UI usage
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Generate secure random session id (server-only)
    let sid: string;
    try {
      if (typeof nodeRandomUUID === 'function') {
        sid = nodeRandomUUID();
      } else {
        sid = randomBytes(16).toString('hex');
      }
    } catch (_) {
      sid = randomBytes(16).toString('hex');
    }

    const sessionId = `figma_${sid}`;
    const now = Date.now();
    const expiresAt = Timestamp.fromMillis(now + 5 * 60 * 1000); // 5 minutes

    const ref = db.collection('figma_auth').doc(sessionId);
    await ref.set({
      status: 'created',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      // optional metadata for audit
      version: 1
    }, { merge: true });

    functions.logger.info('✅ Session created', { sessionId });
    res.status(200).json({ success: true, sessionId });
  } catch (err) {
    functions.logger.error('❌ Failed to create session', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * Generates a custom token and stores it in Firestore
 * The Figma plugin will poll Firestore to retrieve this token
 */
export const generateCustomToken = functions.https.onRequest(async (req, res) => {
  functions.logger.info('🚀 Function called', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  // Enable CORS for local development
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    functions.logger.info('✅ CORS preflight');
    res.status(204).send('');
    return;
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    functions.logger.warn('❌ Method not allowed:', req.method);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Get and verify ID token
    const authHeader = req.headers.authorization;
    functions.logger.info('🔑 Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      functions.logger.error('❌ Unauthorized - Missing or invalid token');
      res.status(401).json({ error: 'Unauthorized - Missing token' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    functions.logger.info('🔓 Verifying ID token...');
    
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    functions.logger.info('✅ Token verified', { uid, email: decodedToken.email });

    // Get request body
    const { sessionId } = req.body as GenerateTokenRequest;

    if (!sessionId) {
      functions.logger.error('❌ Missing sessionId in request body');
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    functions.logger.info('📋 Session ID:', sessionId);

    const sessRef = db.collection('figma_auth').doc(sessionId);
    const sessSnap = await sessRef.get();

    if (!sessSnap.exists) {
      functions.logger.warn('❌ Invalid sessionId - doc not found');
      res.status(400).json({ error: 'Invalid sessionId' });
      return;
    }

    const sess = sessSnap.data() as { status?: string; expiresAt?: InstanceType<typeof Timestamp> } | undefined;
    if (!sess) {
      res.status(400).json({ error: 'Invalid session' });
      return;
    }

    const nowMs = Date.now();
    if (sess.expiresAt && sess.expiresAt.toMillis() < nowMs) {
      functions.logger.warn('⌛ Session expired', { sessionId });
      res.status(410).json({ error: 'Session expired' });
      return;
    }

    if (sess.status && sess.status !== 'created') {
      functions.logger.warn('♻️ Session already used or in invalid state', { sessionId, status: sess.status });
      res.status(409).json({ error: 'Session already used' });
      return;
    }

    // Generate custom token with session id claim for traceability
    functions.logger.info('🎫 Generating custom token...', { uid, sessionId });
    const customToken = await admin.auth().createCustomToken(uid, { sid: sessionId });
    functions.logger.info('✅ Custom token generated', { 
      tokenPreview: customToken.substring(0, 50) + '...',
      tokenLength: customToken.length,
      uid,
      email: decodedToken.email
    });

    // Update the same session doc atomically to single-use state
    functions.logger.info('💾 Storing token in session doc...');
    await sessRef.set({
      customToken,
      uid,
      email: decodedToken.email || null,
      readyAt: FieldValue.serverTimestamp(),
      status: 'ready'
    }, { merge: true });

    functions.logger.info('✅ Token stored successfully', { sessionId, uid });

    res.status(200).json({ 
      success: true,
      message: 'Custom token generated and stored',
      sessionId: sessionId
    });

  } catch (error) {
    functions.logger.error('❌ Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate custom token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});