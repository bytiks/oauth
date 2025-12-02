// This plugin demonstrates OAuth authentication flow following Figma's recommended approach
// Uses read/write key pairs and polling for secure token exchange

// Show the UI with appropriate size for authentication
figma.showUI(__html__, { width: 400, height: 500 });

// Check if we already have a token stored
(async () => {
  const existingToken = await figma.clientStorage.getAsync('accessToken');
  
  // Send existing token to UI (or null if none exists)
  figma.ui.postMessage({
    type: 'existing-token',
    token: existingToken || null
  });
})();

// Handle messages from the UI
figma.ui.onmessage = async (msg: { type: string; token?: string; error?: string; url?: string }) => {
  if (msg.type === 'open-auth-url') {
    // Open the authentication URL in the user's browser
    if (msg.url) {
      figma.openExternal(msg.url);
      figma.notify('Opening authentication page in browser...');
    }
  }

  if (msg.type === 'save-token') {
    // Save the token to clientStorage
    const token = msg.token;
    
    if (token) {
      await figma.clientStorage.setAsync('accessToken', token);
      figma.notify('Authentication successful! ✓');
      
      // Send confirmation back to UI
      figma.ui.postMessage({
        type: 'token-saved',
        token: token
      });
    }
  }

  if (msg.type === 'clear-token') {
    // Clear stored token (for logout)
    await figma.clientStorage.deleteAsync('accessToken');
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
