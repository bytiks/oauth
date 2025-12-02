# Figma Plugin OAuth Authentication Setup

This plugin implements OAuth authentication using an iframe redirect to a domain under your control.

## How It Works

1. **User clicks "Authenticate" button** - The plugin UI displays an authentication button
2. **Iframe loads your auth page** - The iframe redirects to `https://your-domain.com/auth`
3. **User authenticates** - On your server, user logs in via OAuth provider
4. **Callback to your domain** - OAuth provider redirects to `https://your-domain.com/callback`
5. **Token sent to plugin** - Your callback page sends the token back to the plugin via `postMessage`
6. **Token stored securely** - Plugin stores the token in Figma's `clientStorage`

## Setup Instructions

### 1. Update the Domain

Replace `https://your-domain.com` in the following files with your actual domain:

- **manifest.json**: Update `networkAccess.allowedDomains`
- **ui.html**: Update `AUTH_URL` and `REDIRECT_URI` constants
- **callback.html**: This file should be hosted on your server

### 2. Configure OAuth Client

In `ui.html`, update the OAuth parameters:

```javascript
const authParams = new URLSearchParams({
  response_type: 'token', // or 'code' for authorization code flow
  client_id: 'YOUR_CLIENT_ID', // Replace with your OAuth client ID
  redirect_uri: REDIRECT_URI,
  state: state,
  scope: 'read write' // Adjust scopes as needed
});
```

### 3. Host the Callback Page

Upload `callback.html` to your server at `https://your-domain.com/callback`

This page:
- Receives the OAuth callback with the access token
- Sends the token back to the plugin iframe via `postMessage`
- Verifies origin for security

### 4. Update Network Access

The `manifest.json` includes:

```json
"networkAccess": {
  "allowedDomains": [
    "https://your-domain.com"
  ],
  "reasoning": "Required for OAuth authentication flow"
}
```

### 5. Build and Test

```bash
npm run build
```

Then load the plugin in Figma and test the authentication flow.

## Security Considerations

1. **Origin Verification**: The plugin verifies the origin of messages using:
   ```javascript
   if (event.origin !== 'https://your-domain.com') {
     return;
   }
   ```

2. **CSRF Protection**: Uses state parameter to prevent CSRF attacks

3. **Secure Storage**: Tokens are stored in Figma's `clientStorage` (encrypted at rest)

4. **Non-null Origin**: The iframe redirects to your domain, placing it on a non-null origin for secure identity verification

## OAuth Flow Types

### Implicit Flow (Recommended for Client-Side)
- Set `response_type: 'token'`
- Token returned in URL hash
- Suitable for plugins without backend

### Authorization Code Flow (More Secure)
- Set `response_type: 'code'`
- Requires server-side token exchange
- Better for sensitive operations

## Server-Side Example

If you need a simple auth server, here's a basic Node.js/Express example:

```javascript
app.get('/auth', (req, res) => {
  // Redirect to OAuth provider (e.g., Google, GitHub, Auth0)
  const authUrl = `https://oauth-provider.com/authorize?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${REDIRECT_URI}&` +
    `response_type=token&` +
    `state=${req.query.state}`;
  
  res.redirect(authUrl);
});
```

## Troubleshooting

- **Network Access Denied**: Make sure your domain is in `manifest.json` under `networkAccess.allowedDomains`
- **postMessage Not Working**: Verify origin checking in the message event listener
- **Token Not Stored**: Check browser console for errors in the plugin UI

## Using the Token

After authentication, retrieve the token in your plugin code:

```typescript
const token = await figma.clientStorage.getAsync('authToken');

// Make authenticated API requests
fetch('https://your-api.com/data', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```
