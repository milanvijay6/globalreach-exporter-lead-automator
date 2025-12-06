# Cloudflare Worker Deployment Fix

## Overview

The Cloudflare Worker has been updated to use a permanent worker name, ensuring the OAuth callback URL never changes.

## Changes Made

### 1. Permanent Worker Name

The worker now uses a fixed default name: `shreenathji-oauth-proxy`

- **Previous**: Generated new name with timestamp each time
- **Current**: Uses permanent name for stable URL
- **URL Format**: `https://shreenathji-oauth-proxy.workers.dev`

### 2. Supported OAuth Services

The worker handles all OAuth callbacks:
- ✅ Outlook (`/auth/outlook/callback`)
- ✅ Gmail (`/auth/gmail/callback`)
- ✅ WhatsApp (`/auth/whatsapp/callback`)
- ✅ WeChat (`/auth/wechat/callback`)

## How to Deploy

### Method 1: Via Settings UI

1. Open the app
2. Go to **Settings** → **OAuth Configuration**
3. Scroll to **"Cloudflare Worker OAuth Proxy"** section
4. Click **"Deploy"** button
5. Wait for deployment to complete
6. Copy the worker URL

### Method 2: Via API

```bash
curl -X POST https://your-back4app-url.com/api/cloudflare-worker/deploy
```

### Method 3: Via Command Line

```bash
node scripts/deploy-cloudflare-worker.js
```

## Configuration

### Required Environment Variables

In Back4App dashboard, add:
```
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here (optional)
PARSE_MASTER_KEY=your_master_key_here (for saving URL to Config)
```

### Worker Configuration

The worker automatically:
1. Detects Back4App URL from environment
2. Uses permanent worker name
3. Proxies OAuth callbacks to Back4App
4. Preserves all OAuth parameters (code, state, etc.)

## OAuth Redirect URIs

### Azure (Outlook)

Add to Azure Portal → App registrations → Authentication:
```
https://shreenathji-oauth-proxy.workers.dev/auth/outlook/callback
```

### Google (Gmail)

Add to Google Cloud Console → APIs & Services → Credentials:
```
https://shreenathji-oauth-proxy.workers.dev/auth/gmail/callback
```

### WhatsApp

Use as webhook URL:
```
https://shreenathji-oauth-proxy.workers.dev/auth/whatsapp/callback
```

## Verification

### Test Worker URL

Visit in browser:
```
https://shreenathji-oauth-proxy.workers.dev/auth/outlook/callback?test=1
```

Should redirect to Back4App with test parameter.

### Check Worker Status

```bash
wrangler tail --name shreenathji-oauth-proxy
```

## Troubleshooting

### Issue: "Worker name already exists"

**Solution**: The worker name is permanent. If you need a new worker, use the "Reset" button in Settings, which creates a new worker with timestamp.

### Issue: "BACK4APP_BASE_URL not configured"

**Solution**: 
1. Check that Back4App URL is detected correctly
2. Verify environment variables in Back4App
3. Manually set in `cloudflare-worker/wrangler.toml` if needed

### Issue: "OAuth callback returns 404"

**Solution**:
1. Verify worker is deployed: `wrangler list`
2. Check worker URL is correct
3. Ensure redirect URI matches exactly (case-sensitive)

### Issue: "Redirect URI mismatch"

**Solution**:
1. Copy exact worker URL from deployment output
2. Add to Azure/Google Cloud Console
3. Wait 3-5 minutes for changes to propagate
4. Try OAuth flow again

## Benefits

- ✅ **Permanent URL**: Never changes (unless reset manually)
- ✅ **All Services**: Supports Outlook, Gmail, WhatsApp, WeChat
- ✅ **Automatic**: Detects Back4App URL automatically
- ✅ **Secure**: Only allows redirects to configured Back4App domain

## Next Steps

1. Deploy worker using one of the methods above
2. Copy worker URL
3. Add redirect URIs to OAuth providers
4. Test OAuth flows
5. Share worker URL for OAuth configuration


