# Firebase Authentication Setup Guide for Figma Plugin

This guide explains how to set up Firebase Authentication with custom tokens for your Figma plugin using local emulators.

## Architecture Overview

```
1. User clicks "Authenticate" in Figma plugin UI
2. Plugin generates unique sessionId (e.g., "figma_1234567890_abc123")
3. Plugin opens auth.html in browser with sessionId as URL parameter
4. User signs in with Firebase Auth (Email/Password or Google)
5. Auth page calls Firebase Function with sessionId and user info
6. Firebase Function generates custom token for the user
7. Function stores token in Firestore: figma_auth/{sessionId} document
8. Plugin polls Firestore every second for the token
9. When token found, plugin retrieves it and saves to clientStorage
10. Token document is deleted from Firestore after retrieval
```

## Prerequisites

- Node.js and npm installed
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project created at [console.firebase.google.com](https://console.firebase.google.com)

## 1. Initialize Firebase Project

```bash
# Login to Firebase
firebase login

# Initialize Firebase in your project directory
firebase init

# Select:
# - Firestore
# - Functions (TypeScript)
# - Emulators (Auth, Firestore, Functions)
# - Hosting

# Choose your Firebase project or create a new one
```

## 2. Update Firebase Configuration

### Update `manifest.json`

```json
{
  "networkAccess": {
    "allowedDomains": [
      "http://127.0.0.1:5000",
      "http://localhost:5000",
      "http://127.0.0.1:8080",
      "http://localhost:8080",
      "http://127.0.0.1:5001",
      "http://localhost:5001"
    ],
    "reasoning": "Required for Firebase authentication flow with local emulators",
    "devAllowedDomains": ["*"]
  }
}
```

### Create `auth.html` in `public` folder

This is the page that opens in the browser for authentication.

**File: `public/auth.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Figma Plugin Authentication</title>
  
  <link type="text/css" rel="stylesheet" href="https://www.gstatic.com/firebasejs/ui/6.0.1/firebase-ui-auth.css" />
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      padding: 20px;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 450px;
      width: 90%;
    }
    
    h2 {
      margin-top: 0;
      color: #333;
      text-align: center;
    }
    
    .info {
      background: #f0f0f0;
      padding: 12px;
      border-radius: 8px;
      font-size: 13px;
      color: #666;
      margin-bottom: 20px;
      text-align: center;
    }
    
    .emulator-notice {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
      font-size: 12px;
      color: #856404;
      margin-bottom: 15px;
    }
    
    .status {
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
      margin-bottom: 15px;
      display: none;
    }
    
    .status.success {
      background: #d4edda;
      color: #155724;
      display: block;
    }
    
    .status.error {
      background: #f8d7da;
      color: #721c24;
      display: block;
    }
    
    .status.loading {
      background: #d1ecf1;
      color: #0c5460;
      display: block;
    }
    
    #firebaseui-auth-container {
      margin: 20px 0;
    }
    
    #loader {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 14px;
    }
    
    .success-message {
      display: none;
      text-align: center;
    }
    
    .success-message.show {
      display: block;
    }
    
    .success-icon {
      font-size: 64px;
      color: #28a745;
      margin-bottom: 20px;
    }
    
    .success-message h3 {
      color: #28a745;
      margin-bottom: 10px;
    }
    
    .success-message p {
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="auth-container">
      <h2>🔐 Figma Plugin Authentication</h2>
      
      <div class="info">
        Sign in to authenticate your Figma plugin
      </div>
      
      <div class="emulator-notice">
        ⚠️ Using Local Firebase Emulators
      </div>
      
      <div id="status" class="status"></div>
      
      <div id="firebaseui-auth-container"></div>
      <div id="loader">Loading authentication...</div>
    </div>
    
    <div id="success-message" class="success-message">
      <div class="success-icon">✓</div>
      <h3>Authentication Successful!</h3>
      <p>You can now return to Figma.<br>This window will close in <span id="countdown">3</span> seconds.</p>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/ui/6.0.1/firebase-ui-auth.js"></script>
  
  <script>
    // Firebase configuration - Use your actual config
    const firebaseConfig = {
      apiKey: "AIzaSyBXCZ_34epRlVsD1_2GWPAq0A-lG49WogM",
      authDomain: "my-auth-figma.firebaseapp.com",
      projectId: "my-auth-figma",
      storageBucket: "my-auth-figma.firebasestorage.app",
      messagingSenderId: "832872984394",
      appId: "1:832872984394:web:c24c5efccae3753bbc9bb3"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    
    // Connect to Auth Emulator for local development
    firebase.auth().useEmulator('http://127.0.0.1:9099');
    
    // Get sessionId from URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    
    const statusDiv = document.getElementById('status');
    const authContainer = document.getElementById('auth-container');
    const successMessage = document.getElementById('success-message');
    
    function showStatus(message, type) {
      statusDiv.textContent = message;
      statusDiv.className = 'status ' + type;
    }
    
    if (!sessionId) {
      showStatus('Error: Missing session ID', 'error');
      document.getElementById('loader').style.display = 'none';
    } else {
      // Initialize FirebaseUI
      const ui = new firebaseui.auth.AuthUI(firebase.auth());
      
      const uiConfig = {
        callbacks: {
          signInSuccessWithAuthResult: function(authResult, redirectUrl) {
            handleSuccessfulAuth(authResult.user);
            return false;
          },
          uiShown: function() {
            document.getElementById('loader').style.display = 'none';
          },
          signInFailure: function(error) {
            showStatus('Sign in failed: ' + error.message, 'error');
          }
        },
        signInFlow: 'popup',
        signInOptions: [
          {
            provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
            requireDisplayName: true
          },
          firebase.auth.GoogleAuthProvider.PROVIDER_ID
        ],
        tosUrl: '#',
        privacyPolicyUrl: '#'
      };
      
      // Start FirebaseUI
      ui.start('#firebaseui-auth-container', uiConfig);
      
      // Check if already signed in
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          handleSuccessfulAuth(user);
        }
      });
    }
    
    async function handleSuccessfulAuth(user) {
      try {
        showStatus('Generating custom token...', 'loading');
        
        // Get ID token
        const idToken = await user.getIdToken();
        
        // Call Firebase Function to generate custom token
        // Local emulator endpoint
        const functionUrl = 'http://127.0.0.1:5001/my-auth-figma/us-central1/generateCustomToken';
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            sessionId: sessionId,
            uid: user.uid
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate custom token');
        }
        
        const data = await response.json();
        
        // Show success
        authContainer.style.display = 'none';
        successMessage.classList.add('show');
        
        // Countdown and close
        let countdown = 3;
        const countdownEl = document.getElementById('countdown');
        const interval = setInterval(() => {
          countdown--;
          countdownEl.textContent = countdown;
          if (countdown <= 0) {
            clearInterval(interval);
            window.close();
          }
        }, 1000);
        
      } catch (error) {
        console.error('Error:', error);
        showStatus('Failed: ' + error.message, 'error');
      }
    }
  </script>
</body>
</html>
```

## 3. Create Firebase Function

**File: `functions/src/index.ts`**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

interface GenerateTokenRequest {
  sessionId: string;
  uid: string;
}

/**
 * Generates a custom token and stores it in Firestore
 * The Figma plugin will poll Firestore to retrieve this token
 */
export const generateCustomToken = functions.https.onRequest(async (req, res) => {
  // Enable CORS for local development
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Get and verify ID token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized - Missing token' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get request body
    const { sessionId } = req.body as GenerateTokenRequest;

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    // Generate custom token
    const customToken = await admin.auth().createCustomToken(uid);

    // Store in Firestore with sessionId as document ID
    await admin.firestore()
      .collection('figma_auth')
      .doc(sessionId)
      .set({
        customToken: customToken,
        uid: uid,
        email: decodedToken.email || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // Auto-expire in 5 minutes
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000)
      });

    functions.logger.info('Custom token stored', { sessionId, uid });

    res.status(200).json({ 
      success: true,
      message: 'Custom token generated and stored'
    });

  } catch (error) {
    functions.logger.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate custom token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cleanup expired tokens (optional)
 * Run periodically to clean up old auth sessions
 */
export const cleanupExpiredTokens = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    
    const expiredDocs = await admin.firestore()
      .collection('figma_auth')
      .where('expiresAt', '<', now)
      .get();

    const batch = admin.firestore().batch();
    expiredDocs.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    
    functions.logger.info(`Cleaned up ${expiredDocs.size} expired tokens`);
    return null;
  });
```

**Install dependencies:**

```bash
cd functions
npm install firebase-functions firebase-admin
npm install -D @types/node
```

## 4. Firestore Security Rules

**File: `firestore.rules`**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to figma_auth collection without authentication
    // This is needed because the Figma plugin can't authenticate to Firestore
    match /figma_auth/{sessionId} {
      // Anyone can read (plugin needs this to poll for token)
      allow read: if true;
      
      // Only authenticated users can create
      allow create: if request.auth != null;
      
      // Allow delete for cleanup (plugin deletes after consuming)
      allow delete: if true;
    }
  }
}
```

## 5. Firebase Configuration

**File: `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": {
    "source": "functions"
  },
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "hosting": {
      "port": 5000
    },
    "ui": {
      "enabled": true
    }
  }
}
```

## 6. Running Locally

### Start Firebase Emulators

```bash
# From your project root
firebase emulators:start
```

This will start:
- **Auth Emulator**: http://127.0.0.1:9099
- **Firestore Emulator**: http://127.0.0.1:8080
- **Functions Emulator**: http://127.0.0.1:5001
- **Hosting Emulator**: http://127.0.0.1:5000 (serves auth.html)
- **Emulator UI**: http://127.0.0.1:4000

### Build and Test Plugin

```bash
# Build the plugin
npm run build

# Load plugin in Figma:
# 1. Go to Figma
# 2. Right-click → Plugins → Development → Import plugin from manifest
# 3. Select your manifest.json
# 4. Run the plugin
# 5. Click "Authenticate"
# 6. Sign in with test account in browser
# 7. Return to Figma - should show "Authentication successful!"
```

## 7. Testing the Flow

### Create Test User

In the Firebase Emulator UI (http://127.0.0.1:4000):
1. Go to Authentication tab
2. Click "Add user"
3. Enter email and password
4. Save

### Test Authentication

1. **Start emulators**: `firebase emulators:start`
2. **Build plugin**: `npm run build`
3. **Open Figma** and run your plugin
4. **Click "Authenticate"** button
5. **Browser opens** to http://127.0.0.1:5000/auth.html?sessionId=figma_xxx
6. **Sign in** with test credentials
7. **Function generates** custom token
8. **Token stored** in Firestore: `figma_auth/figma_xxx`
9. **Plugin polls** Firestore every second
10. **Token retrieved** and saved to `clientStorage`
11. **Document deleted** from Firestore
12. **Success!** Plugin shows "Authentication successful!"

## 8. Deploying to Production

### Deploy to Firebase

```bash
# Deploy everything
firebase deploy

# Or deploy individually
firebase deploy --only firestore:rules
firebase deploy --only functions
firebase deploy --only hosting
```

### Update URLs in Plugin

Change in `ui.html`:

```javascript
// From local:
const FIREBASE_AUTH_URL = 'http://127.0.0.1:5000/auth.html';
const FIRESTORE_EMULATOR_URL = 'http://127.0.0.1:8080/v1/projects/my-auth-figma/databases/(default)/documents';

// To production:
const FIREBASE_AUTH_URL = 'https://my-auth-figma.web.app/auth.html';
const FIRESTORE_API_URL = 'https://firestore.googleapis.com/v1/projects/my-auth-figma/databases/(default)/documents';
```

Update `auth.html`:

```javascript
// Remove emulator connection
// firebase.auth().useEmulator('http://127.0.0.1:9099');

// Update function URL
const functionUrl = 'https://us-central1-my-auth-figma.cloudfunctions.net/generateCustomToken';
```

Update `manifest.json`:

```json
"networkAccess": {
  "allowedDomains": [
    "https://my-auth-figma.web.app",
    "https://my-auth-figma.firebaseapp.com",
    "https://firestore.googleapis.com",
    "https://us-central1-my-auth-figma.cloudfunctions.net"
  ]
}
```

## 9. Security Considerations

1. **Token Expiry**: Tokens auto-expire after 5 minutes
2. **Immediate Cleanup**: Tokens deleted after plugin consumes them
3. **HTTPS Only**: Use HTTPS in production
4. **Rate Limiting**: Add rate limiting to your function
5. **Session IDs**: Use unpredictable random session IDs
6. **CORS**: Restrict CORS in production to specific origins

## Troubleshooting

### Plugin can't reach emulators
- Check manifest.json has correct emulator URLs
- Ensure emulators are running
- Check browser console for CORS errors

### Token not appearing in Firestore
- Check Functions emulator logs
- Verify ID token is valid
- Check Firestore rules

### Polling times out
- Check Firestore emulator is running on port 8080
- Verify sessionId matches between auth page and plugin
- Check network tab in browser console

### Function errors
- Check Functions logs: `firebase functions:log`
- Verify Firebase Admin SDK is initialized
- Check user has valid ID token

## Using the Token

Once authenticated, use the token:

```typescript
// Get token from storage
const customToken = await figma.clientStorage.getAsync('accessToken');

// Use it to authenticate with Firebase
// Or send to your backend for validation
```

## Next Steps

- Add user logout functionality
- Implement token refresh
- Add error handling for network failures
- Store user profile data
- Add analytics tracking
