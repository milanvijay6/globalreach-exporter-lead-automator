# How to Add Google OAuth Credentials to the App

This guide shows you how to add Google (Gmail) OAuth credentials to the GlobalReach application for OAuth services.

## Method 1: Using the Configuration Script (Recommended)

Provide your credentials via environment variables, then run:

```bash
node scripts/set-azure-cloudflare-config.js
```

This script automatically configures:
- ✅ Azure OAuth credentials
- ✅ Gmail OAuth credentials (values pulled from `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`)  
- ✅ Cloudflare configuration

**Provide your own Gmail OAuth credentials (not included in the repo):**
- **Client ID:** `YOUR_GOOGLE_OAUTH_CLIENT_ID`
- **Client Secret:** `YOUR_GOOGLE_OAUTH_CLIENT_SECRET`

---

## Method 2: Using the App Settings UI

### Step 1: Open Settings

1. Launch the **GlobalReach** application
2. Click on the **Settings** icon (⚙️) in the navigation menu
3. Click on the **"Integrations"** tab

### Step 2: Find OAuth Configuration Section

1. Scroll down to find the **"OAuth Configuration (Advanced)"** section
2. Click to expand it (it's a collapsible section)

### Step 3: Add Gmail OAuth Credentials

**Note:** The Gmail OAuth fields should appear below the Outlook OAuth section. If they don't appear, you may need to add them manually via Method 3 or 4.

1. Look for **"Gmail OAuth Configuration"** section
2. Enter your credentials:
   - **Gmail Client ID:** Paste your Google OAuth Client ID
   - **Gmail Client Secret:** Paste your Google OAuth Client Secret
3. Click **"Save OAuth Configuration"** button at the bottom

---

## Method 3: Using the Config API (Programmatic)

You can set the Gmail OAuth credentials programmatically using the Config API:

### Using cURL or HTTP Client:

```bash
# Set Gmail Client ID
curl -X POST http://localhost:4000/api/config/gmailClientId \
  -H "Content-Type: application/json" \
  -d '{"value": "YOUR_GOOGLE_OAUTH_CLIENT_ID"}'

# Set Gmail Client Secret
curl -X POST http://localhost:4000/api/config/gmailClientSecret \
  -H "Content-Type: application/json" \
  -d '{"value": "YOUR_GOOGLE_OAUTH_CLIENT_SECRET"}'
```

### Using JavaScript/TypeScript:

```typescript
import { PlatformService } from './services/platformService';

// Set Gmail OAuth credentials
await PlatformService.setAppConfig('gmailClientId', 'YOUR_GOOGLE_OAUTH_CLIENT_ID');
await PlatformService.setAppConfig('gmailClientSecret', 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET');
```

---

## Method 4: Direct Config File Edit (Advanced)

### For Electron App (Desktop):

1. Navigate to the config file location:
   - **Windows:** `%APPDATA%\GlobalReach\config.json`
   - **macOS:** `~/Library/Application Support/GlobalReach/config.json`
   - **Linux:** `~/.config/GlobalReach/config.json`

2. Open `config.json` in a text editor

3. Add or update the `oauthConfig` section:

```json
{
  "oauthConfig": "{\"outlook\":{\"clientId\":\"YOUR_AZURE_APP_CLIENT_ID\",\"clientSecret\":\"YOUR_AZURE_APP_CLIENT_SECRET\",\"tenantId\":\"YOUR_AZURE_TENANT_ID\"},\"gmail\":{\"clientId\":\"YOUR_GOOGLE_OAUTH_CLIENT_ID\",\"clientSecret\":\"YOUR_GOOGLE_OAUTH_CLIENT_SECRET\"}}",
  "gmailClientId": "YOUR_GOOGLE_OAUTH_CLIENT_ID",
  "gmailClientSecret": "YOUR_GOOGLE_OAUTH_CLIENT_SECRET"
}
```

**Note:** The `oauthConfig` is stored as a JSON string, so make sure to properly escape it.

---

## Method 5: Using Parse/Back4App Config (For Web/Server Deployments)

If you're using Back4App or Parse Server, you can set the config via Parse:

```javascript
const Config = require('./server/models/Config');

// Set Gmail OAuth credentials (use master key for server-side)
await Config.set('gmailClientId', 'YOUR_GOOGLE_OAUTH_CLIENT_ID', null, true);
await Config.set('gmailClientSecret', 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET', null, true);

// Or set in oauthConfig object
const oauthConfig = {
  outlook: {
    clientId: 'YOUR_AZURE_APP_CLIENT_ID',
    clientSecret: 'YOUR_AZURE_APP_CLIENT_SECRET',
    tenantId: 'YOUR_AZURE_TENANT_ID'
  },
  gmail: {
    clientId: 'YOUR_GOOGLE_OAUTH_CLIENT_ID',
    clientSecret: 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET'
  }
};
await Config.set('oauthConfig', JSON.stringify(oauthConfig), null, true);
```

---

## Verifying the Configuration

After adding the credentials, verify they're loaded correctly:

### Check in the App:

1. Open Settings → Integrations → OAuth Configuration
2. The Gmail Client ID and Client Secret fields should be populated
3. If they're empty, the credentials weren't saved correctly

### Check via API:

```bash
# Get Gmail Client ID
curl http://localhost:4000/api/config/gmailClientId

# Get Gmail Client Secret (may require authentication)
curl http://localhost:4000/api/config/gmailClientSecret
```

### Check Config File:

Open the config file and verify the values are present:
- `gmailClientId` should be set
- `gmailClientSecret` should be set
- `oauthConfig` should contain the gmail object

---

## Using Gmail OAuth After Configuration

Once the credentials are configured:

1. **Connect Gmail Account:**
   - Go to Settings → Platforms → Email
   - Click "Connect" next to Email
   - Select "Gmail" as the provider
   - Enter your Gmail address
   - Click "Connect with Gmail"

2. **OAuth Flow:**
   - A browser window will open
   - Sign in with your Google account
   - Grant permissions to the app
   - You'll be redirected back to the app
   - The connection should be established

---

## Required Google Cloud Console Setup

Before using Gmail OAuth, make sure you've configured:

1. **OAuth 2.0 Client ID** in Google Cloud Console
2. **Authorized Redirect URIs:**
   - `http://localhost:4000/api/oauth/callback` (for local development)
   - `https://globalreach-exporter-lead-automator.duckdns.org/api/oauth/callback` (for production)
   - Or your Cloudflare Worker URL: `https://your-worker.workers.dev/auth/gmail/callback`

3. **Required Scopes:**
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

See the [Gmail OAuth Setup Guide](GMAIL_OAUTH_SETUP.md) for detailed Google Cloud Console setup instructions.

---

## Troubleshooting

### Credentials Not Saving

- **Check file permissions:** Make sure the app has write access to the config directory
- **Check console errors:** Look for any error messages in the app console
- **Try Method 1:** Use the setup script which handles all edge cases

### Credentials Not Loading

- **Restart the app:** Configuration is loaded on startup
- **Check config file location:** Verify the config file exists and is in the correct location
- **Check JSON format:** If editing manually, ensure valid JSON syntax

### OAuth Not Working

- **Verify redirect URI:** Make sure the redirect URI in Google Cloud Console matches exactly
- **Check credentials:** Verify Client ID and Secret are correct (no extra spaces)
- **Check scopes:** Ensure required scopes are added in Google Cloud Console
- **Check OAuth consent screen:** Make sure it's configured and published (or add test users)

---

## Current Configuration Checklist

- Confirm you've set **Gmail Client ID** to your own `YOUR_GOOGLE_OAUTH_CLIENT_ID`.
- Confirm you've set **Gmail Client Secret** to your own `YOUR_GOOGLE_OAUTH_CLIENT_SECRET`.
- Verify the values are stored in `%APPDATA%\GlobalReach\config.json` (Windows) or the equivalent path per OS.

Restart the app after saving credentials.

---

## Additional Resources

- [Gmail OAuth Setup Guide](GMAIL_OAUTH_SETUP.md) - Complete Google Cloud Console setup
- [Google OAuth Login Guide](GOOGLE_OAUTH_LOGIN_GUIDE.md) - Using OAuth for authentication
- [OAuth Quick Reference](OAUTH_QUICK_REFERENCE.md) - Quick reference card

