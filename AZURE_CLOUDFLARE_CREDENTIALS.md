# Azure, Gmail & Cloudflare Credentials Reference

This document contains the Azure OAuth, Gmail OAuth, and Cloudflare API credentials for the GlobalReach application.

## Azure AD OAuth Configuration

### Client (Application) ID
```
649aa87d-4799-466b-ae15-078049518573
```

### Directory (Tenant) ID
```
e87ff696-4a5a-4482-aec1-3ad475608ee1
```

### Client Secret ID
```
6a7e6b99-8edc-4d0e-81cc-d881ac3fa6e1
```

### Client Secret Value
```
qke8Q~Ie5CeQlTfogCm147w.rF~Axl~8mWYb5c8r
```

**⚠️ IMPORTANT:** The client secret value is stored in the app configuration. If you need to regenerate it, create a new secret in Azure Portal.

## Gmail OAuth Configuration

### Client ID
```
393499424376-424k11sm0pij9a49v02atceotjh5f091.apps.googleusercontent.com
```

### Client Secret
```
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
```

**⚠️ IMPORTANT:** The client secret is stored in the app configuration. If you need to regenerate it, create a new secret in Google Cloud Console.

## Cloudflare Configuration

### API Key/Token
```
TMBjozKlShmeEytu93qfEYfpIZzWuix2DgVwDvpO
```

### Domain/URL
```
globalreach-exporter-lead-automator.duckdns.org
```

### Full URLs
- **Base URL:** `https://globalreach-exporter-lead-automator.duckdns.org`
- **Webhook URL:** `https://globalreach-exporter-lead-automator.duckdns.org/webhooks/whatsapp`
- **OAuth Callback URL:** `https://globalreach-exporter-lead-automator.duckdns.org/api/oauth/callback`

## Configuration Status

✅ **All credentials have been configured in the app's config file:**
- Location: `%APPDATA%\GlobalReach\config.json` (Windows)
- Azure OAuth credentials are stored in `oauthConfig.outlook`
- Gmail OAuth credentials are stored in `oauthConfig.gmail`
- Cloudflare URL and API key are stored as separate config keys

## Environment Variables

For server-side usage (Back4App, Docker, etc.), set the Cloudflare API token as an environment variable:

```bash
CLOUDFLARE_API_TOKEN=TMBjozKlShmeEytu93qfEYfpIZzWuix2DgVwDvpO
```

## Azure Portal Configuration

Make sure the following redirect URI is added in Azure Portal:

1. Go to: https://portal.azure.com
2. Navigate to: **Azure Active Directory** → **App registrations** → Your app
3. Go to: **Authentication** → **Platform configurations** → **Web**
4. Add redirect URI:
   ```
   https://globalreach-exporter-lead-automator.duckdns.org/api/oauth/callback
   ```
5. Click **Save**
6. Wait 3-5 minutes for Azure to propagate changes

## Google Cloud Console Configuration

Make sure the following redirect URI is added in Google Cloud Console:

1. Go to: https://console.cloud.google.com
2. Navigate to: **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://globalreach-exporter-lead-automator.duckdns.org/api/oauth/callback
   ```
5. Click **Save**
6. Wait a few minutes for changes to propagate

## Next Steps

1. ✅ Credentials have been added to app configuration
2. ⚠️ Restart the app for changes to take effect
3. ⚠️ Update Azure Portal redirect URI (see above)
4. ⚠️ Update Google Cloud Console redirect URI (see above)
5. ⚠️ Set `CLOUDFLARE_API_TOKEN` environment variable for server deployments

## Security Notes

- 🔒 Never commit this file to version control
- 🔒 Keep credentials secure and private
- 🔒 Rotate secrets periodically
- 🔒 Use environment variables for production deployments

