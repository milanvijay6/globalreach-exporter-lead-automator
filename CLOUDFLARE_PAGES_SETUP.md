# Cloudflare Pages Setup Guide

## Overview

This guide explains how to deploy the frontend to Cloudflare Pages for a permanent public URL where users can access the app.

## Prerequisites

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com
2. **Cloudflare API Token**: Create an API token with Pages permissions
3. **Wrangler CLI**: Install globally with `npm install -g wrangler`

## Step 1: Create Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Add these permissions:
   - **Account** → **Cloudflare Pages** → **Edit**
   - **Account** → **Workers Scripts** → **Edit**
5. Click "Continue to summary" and "Create Token"
6. Copy the token (you'll need it for environment variables)

## Step 2: Set Environment Variables

### In Back4App Dashboard:

1. Go to **Server Settings** → **Environment Variables**
2. Add:
   ```
   CLOUDFLARE_API_TOKEN=your_api_token_here
   CLOUDFLARE_ACCOUNT_ID=your_account_id_here (optional)
   BACK4APP_URL=https://your-app.b4a.run
   ```

### To Find Your Account ID:

1. Go to https://dash.cloudflare.com
2. Select any domain
3. Scroll down to "API" section
4. Copy the "Account ID"

## Step 3: Deploy via Settings UI

1. Open the app
2. Go to **Settings** → **OAuth Configuration**
3. Scroll to **"Cloudflare Pages (Main App URL)"** section
4. Click **"Deploy Pages"** button
5. Wait for deployment to complete
6. The URL will be displayed (e.g., `https://shreenathji-app.pages.dev`)

## Step 4: Deploy via API

Alternatively, you can deploy via API:

```bash
curl -X POST https://your-back4app-url.com/api/cloudflare-pages/deploy
```

## Step 5: Deploy via Command Line

1. Build the app:
   ```bash
   npm run build:pages
   ```

2. Deploy using Wrangler:
   ```bash
   wrangler pages deploy cloudflare-pages/dist --project-name=shreenathji-app
   ```

## Step 6: Configure Environment Variables in Cloudflare Pages

1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **Pages**
3. Select your project: **shreenathji-app**
4. Go to **Settings** → **Environment Variables**
5. Add:
   ```
   BACK4APP_URL=https://your-app.b4a.run
   ```

## How It Works

1. **Frontend**: Deployed to Cloudflare Pages (permanent URL)
2. **Backend**: Runs on Back4App
3. **API Proxy**: Cloudflare Pages middleware proxies `/api/*` requests to Back4App
4. **OAuth Callbacks**: Use Cloudflare Worker URL (permanent)

## URLs

After deployment, you'll have:

- **Main App URL**: `https://shreenathji-app.pages.dev` (permanent, public access)
- **OAuth Worker URL**: `https://shreenathji-oauth-proxy.workers.dev` (permanent, for OAuth callbacks)
- **Backend API**: `https://your-app.b4a.run` (Back4App)

## OAuth Configuration

### For Azure (Outlook):

Add redirect URI:
```
https://shreenathji-oauth-proxy.workers.dev/auth/outlook/callback
```

### For Google (Gmail):

Add redirect URI:
```
https://shreenathji-oauth-proxy.workers.dev/auth/gmail/callback
```

### For WhatsApp:

Webhook URL:
```
https://shreenathji-oauth-proxy.workers.dev/auth/whatsapp/callback
```

## Troubleshooting

### Issue: "CLOUDFLARE_API_TOKEN not configured"

**Solution**: Add `CLOUDFLARE_API_TOKEN` to Back4App environment variables.

### Issue: "Wrangler CLI not available"

**Solution**: Install Wrangler globally:
```bash
npm install -g wrangler
```

### Issue: "Build failed"

**Solution**: 
1. Check Node.js version (requires Node 18+)
2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Issue: "API requests fail from Pages"

**Solution**: 
1. Verify `BACK4APP_URL` is set in Cloudflare Pages environment variables
2. Check that middleware function is deployed correctly
3. Verify Back4App backend is accessible

### Issue: "OAuth callbacks not working"

**Solution**:
1. Verify Cloudflare Worker is deployed
2. Check redirect URIs in Azure/Google Cloud Console
3. Ensure worker URL is correct: `https://shreenathji-oauth-proxy.workers.dev`

## Custom Domain (Optional)

To use a custom domain:

1. Go to Cloudflare Pages project settings
2. Click **"Custom domains"**
3. Add your domain
4. Follow DNS configuration instructions
5. SSL will be automatically provisioned

## Benefits

- ✅ **Permanent URL**: Never expires (unlike Back4App preview URLs)
- ✅ **Free**: Cloudflare Pages is free for most use cases
- ✅ **Fast**: Global CDN for fast loading
- ✅ **SSL**: Automatic HTTPS
- ✅ **Custom Domain**: Support for custom domains

## Next Steps

1. Deploy Cloudflare Worker for OAuth callbacks
2. Deploy Cloudflare Pages for main app
3. Configure OAuth redirect URIs
4. Test OAuth flows
5. Share the permanent URL with users


