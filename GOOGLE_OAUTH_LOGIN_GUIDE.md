# Google OAuth 2.0 Login Guide

This guide explains how to set up and use Google OAuth 2.0 authentication in the GlobalReach application.

## Overview

The application already has Gmail OAuth 2.0 support built-in. This guide will walk you through:
1. Setting up Google Cloud credentials
2. Configuring the application
3. Using Google OAuth to login/authenticate

## Step 1: Create Google Cloud Project & OAuth Credentials

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top
3. Click **"New Project"**
4. Enter a project name (e.g., "GlobalReach")
5. Click **"Create"**
6. Select the new project from the dropdown

### 1.2 Enable Required APIs

1. Navigate to **"APIs & Services" > "Library"**
2. Search for and enable:
   - **Gmail API** (for email access)
   - **Google+ API** or **People API** (for user profile info)

### 1.3 Configure OAuth Consent Screen

1. Navigate to **"APIs & Services" > "OAuth consent screen"**
2. Choose **"External"** (unless you have Google Workspace)
3. Fill in required information:
   - **App name**: GlobalReach (or your app name)
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click **"Save and Continue"**
5. On **Scopes** page, add:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
6. Click **"Save and Continue"**
7. Add test users (for development) - add your Gmail address
8. Click **"Save and Continue"**

### 1.4 Create OAuth 2.0 Credentials

1. Navigate to **"APIs & Services" > "Credentials"**
2. Click **"+ CREATE CREDENTIALS"**
3. Select **"OAuth client ID"**
4. Choose **"Web application"** as application type
5. Configure:
   - **Name**: GlobalReach Web App
   - **Authorized redirect URIs**: 
     - For local development: `http://localhost:4000/api/oauth/callback`
     - For Back4App/web: `https://your-app.b4a.run/api/oauth/callback`
     - For Cloudflare Worker: `https://your-worker.workers.dev/auth/gmail/callback`
   - **Authorized JavaScript origins**:
     - `http://localhost:4000` (for local)
     - `https://your-app.b4a.run` (for Back4App)
6. Click **"Create"**
7. **IMPORTANT**: Copy and save:
   - **Client ID** (you'll need this)
   - **Client Secret** (shown only once - save it securely!)

## Step 2: Configure Application Settings

### 2.1 Store Google OAuth Credentials

The application stores OAuth credentials in the app configuration. You need to set:

- `gmailClientId` - Your Google OAuth Client ID
- `gmailClientSecret` - Your Google OAuth Client Secret

**For Web App (Back4App):**

You can set these via the Settings UI or API:

```javascript
// Via API (if you have access)
POST /api/config/gmailClientId
Body: { "value": "your-client-id-here" }

POST /api/config/gmailClientSecret
Body: { "value": "your-client-secret-here" }
```

**For Electron App:**

1. Open the app
2. Go to **Settings** > **Integrations** or **API Keys**
3. Find **Gmail OAuth Configuration**
4. Enter:
   - **Client ID**: Your Google Client ID
   - **Client Secret**: Your Google Client Secret
5. Click **Save**

### 2.2 Configure Redirect URI

The redirect URI must match what you configured in Google Cloud Console.

**For Back4App deployment:**
- Use your Cloudflare Worker URL: `https://your-worker.workers.dev/auth/gmail/callback`
- Or use your Back4App URL: `https://your-app.b4a.run/api/oauth/callback`

**For local development:**
- Use: `http://localhost:4000/api/oauth/callback`

## Step 3: Using Google OAuth Login

### 3.1 Programmatic Usage (Code)

The application has an `OAuthService` that handles Google OAuth:

```typescript
import { OAuthService } from './services/oauthService';

// 1. Get OAuth configuration
const config = {
  clientId: await PlatformService.getAppConfig('gmailClientId', ''),
  clientSecret: await PlatformService.getAppConfig('gmailClientSecret', ''),
  redirectUri: 'https://your-app.b4a.run/api/oauth/callback'
};

// 2. Initiate OAuth flow
const { authUrl, state } = await OAuthService.initiateGmailOAuth(config, 'user@example.com');

// 3. Open auth URL in browser
window.open(authUrl, '_blank');

// 4. Handle callback (when user returns from Google)
// The callback will contain 'code' parameter
const code = getCodeFromCallback(); // Extract from URL or callback handler

// 5. Exchange code for tokens
const tokens = await OAuthService.exchangeGmailCode(config, code, state);

// tokens will contain:
// {
//   access_token: "...",
//   refresh_token: "...",
//   expiry_date: 1234567890
// }
```

### 3.2 Using the OAuth Service Methods

**Initiate Gmail OAuth:**
```typescript
const { authUrl, state } = await OAuthService.initiateGmailOAuth(
  {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://your-app.com/api/oauth/callback'
  },
  'user@example.com' // optional email
);
```

**Exchange Code for Tokens:**
```typescript
const tokens = await OAuthService.exchangeGmailCode(
  config,
  code,    // Authorization code from callback
  state    // State parameter from initiation
);
```

**Refresh Access Token:**
```typescript
const newTokens = await OAuthService.refreshGmailToken(
  config,
  refreshToken  // Refresh token from initial exchange
);
```

**Revoke Token:**
```typescript
await OAuthService.revokeGmailToken(accessToken);
```

## Step 4: OAuth Flow Overview

### Complete Flow:

1. **User clicks "Login with Google"**
   - App calls `OAuthService.initiateGmailOAuth()`
   - Gets authorization URL and state

2. **Redirect user to Google**
   - Open authorization URL in browser
   - User logs in and grants permissions

3. **Google redirects back**
   - Google redirects to your `redirectUri` with:
     - `code` - Authorization code
     - `state` - State parameter (for security)

4. **Exchange code for tokens**
   - App calls `OAuthService.exchangeGmailCode()`
   - Receives `access_token` and `refresh_token`

5. **Store tokens securely**
   - Save tokens in secure storage
   - Use `access_token` for API calls
   - Use `refresh_token` to get new access tokens when expired

## Step 5: Handling OAuth Callback

### For Web App (Back4App):

The callback is handled by `server/routes/oauth.js`:

1. User is redirected to `/api/oauth/callback?code=...&state=...`
2. Server extracts code and state
3. Server redirects to frontend with parameters:
   - `/?oauth_callback=true&code=...&provider=gmail&state=...`
4. Frontend detects callback in URL
5. Frontend exchanges code for tokens

### For Electron App:

1. OAuth callback is handled via IPC
2. Main process receives callback
3. Sends callback data to renderer via IPC
4. Renderer processes callback and exchanges code

## Step 6: Required Scopes

The application requests these Google OAuth scopes:

- `https://www.googleapis.com/auth/gmail.modify` - Read, send, and modify emails
- `https://www.googleapis.com/auth/userinfo.email` - View email address
- `https://www.googleapis.com/auth/userinfo.profile` - View basic profile

## Step 7: Security Best Practices

1. **Never expose Client Secret** in frontend code
2. **Store tokens securely** - Use secure storage (not localStorage for secrets)
3. **Use HTTPS** in production
4. **Validate state parameter** to prevent CSRF attacks
5. **Refresh tokens** before they expire
6. **Revoke tokens** when user logs out

## Step 8: Troubleshooting

### "redirect_uri_mismatch" Error

**Problem**: Redirect URI doesn't match Google Cloud Console

**Solution**:
1. Check exact redirect URI in your code
2. Ensure it matches exactly in Google Cloud Console (including protocol, port, path)
3. Common redirect URIs:
   - Local: `http://localhost:4000/api/oauth/callback`
   - Back4App: `https://your-app.b4a.run/api/oauth/callback`
   - Cloudflare: `https://your-worker.workers.dev/auth/gmail/callback`

### "invalid_client" Error

**Problem**: Client ID or Secret is incorrect

**Solution**:
1. Verify credentials are correct
2. Check for extra spaces when copying
3. Ensure credentials are for the correct project

### "access_denied" Error

**Problem**: User denied permissions or consent screen not configured

**Solution**:
1. Ensure OAuth consent screen is configured
2. Add your email as a test user (for development)
3. Request permissions again

### Token Refresh Issues

**Problem**: Access token expires and can't refresh

**Solution**:
1. Ensure `access_type: 'offline'` is used (already in code)
2. Ensure `prompt: 'consent'` is used (already in code)
3. Save refresh token securely
4. Use refresh token to get new access token before expiry

## Step 9: Testing

1. **Test OAuth Flow**:
   - Initiate OAuth
   - Complete Google login
   - Verify callback is received
   - Verify tokens are obtained

2. **Test Token Refresh**:
   - Wait for token to expire (or manually expire)
   - Call refresh method
   - Verify new access token is obtained

3. **Test API Calls**:
   - Use access token to call Gmail API
   - Verify emails can be read/sent

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Cloud Console](https://console.cloud.google.com)
- [OAuth 2.0 Scopes for Gmail](https://developers.google.com/gmail/api/auth/scopes)

## Code Examples

### Complete Login Flow Example

```typescript
async function loginWithGoogle() {
  try {
    // 1. Get configuration
    const config = {
      clientId: await PlatformService.getAppConfig('gmailClientId', ''),
      clientSecret: await PlatformService.getAppConfig('gmailClientSecret', ''),
      redirectUri: window.location.origin + '/api/oauth/callback'
    };

    // 2. Initiate OAuth
    const { authUrl, state } = await OAuthService.initiateGmailOAuth(config);
    
    // 3. Store state for verification
    sessionStorage.setItem('oauth_state', state);
    
    // 4. Open Google login
    window.location.href = authUrl;
    
  } catch (error) {
    console.error('Login failed:', error);
  }
}

// Handle callback
async function handleOAuthCallback(code: string, state: string) {
  try {
    // Verify state
    const storedState = sessionStorage.getItem('oauth_state');
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }
    
    // Get configuration
    const config = {
      clientId: await PlatformService.getAppConfig('gmailClientId', ''),
      clientSecret: await PlatformService.getAppConfig('gmailClientSecret', ''),
      redirectUri: window.location.origin + '/api/oauth/callback'
    };
    
    // Exchange code for tokens
    const tokens = await OAuthService.exchangeGmailCode(config, code, state);
    
    // Store tokens securely
    await storeTokensSecurely(tokens);
    
    // Get user info
    const userInfo = await getUserInfo(tokens.access_token);
    
    console.log('Login successful!', userInfo);
    
  } catch (error) {
    console.error('Callback handling failed:', error);
  }
}
```

## Next Steps

After setting up Google OAuth:

1. **Test the login flow** end-to-end
2. **Implement token refresh** logic
3. **Add logout** functionality (revoke tokens)
4. **Store user session** information
5. **Integrate with your app's authentication system**



