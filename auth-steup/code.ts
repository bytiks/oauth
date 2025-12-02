// This plugin demonstrates OAuth authentication flow following Figma's recommended approach
// Uses read/write key pairs and polling for secure token exchange

// Show the UI with appropriate size for authentication
figma.showUI(__html__, { width: 400, height: 500 });

// Check if we already have a token stored
(async () => {
  const existingToken = await figma.clientStorage.getAsync('accessToken');
  const existingEmail = await figma.clientStorage.getAsync('userEmail');
  const existingUid = await figma.clientStorage.getAsync('userUid');
  
  // Send existing token to UI (or null if none exists)
  figma.ui.postMessage({
    type: 'existing-token',
    token: existingToken || null,
    email: existingEmail || null,
    uid: existingUid || null
  });
})();

// Handle messages from the UI
figma.ui.onmessage = async (msg: { type: string; token?: string; email?: string; uid?: string; error?: string; url?: string }) => {
  if (msg.type === 'open-auth-url') {
    // Open the authentication URL in the user's browser
    if (msg.url) {
      figma.openExternal(msg.url);
      figma.notify('Opening authentication page in browser...');
    }
  }

  if (msg.type === 'save-token') {
    // Save the token and user data to clientStorage
    const token = msg.token;
    const email = msg.email;
    const uid = msg.uid;
    
    if (token) {
      await figma.clientStorage.setAsync('accessToken', token);
      if (email) await figma.clientStorage.setAsync('userEmail', email);
      if (uid) await figma.clientStorage.setAsync('userUid', uid);
      
      figma.notify(`Authentication successful! ✓ ${email || ''}`);
      
      // Send confirmation back to UI
      figma.ui.postMessage({
        type: 'token-saved',
        token: token,
        email: email,
        uid: uid
      });
    }
  }

  if (msg.type === 'clear-token') {
    // Clear stored token and user data (for logout)
    await figma.clientStorage.deleteAsync('accessToken');
    await figma.clientStorage.deleteAsync('userEmail');
    await figma.clientStorage.deleteAsync('userUid');
    figma.notify('Logged out successfully');
  }

  if (msg.type === 'auth-error') {
    // Authentication failed
    figma.notify('Authentication failed: ' + (msg.error || 'Unknown error'), { error: true });
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};
