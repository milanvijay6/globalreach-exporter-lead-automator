# Cloudflare Worker OAuth Callback Proxy Setup

## 🎯 Problem Solved

Back4App preview URLs expire after 1 hour, making them unsuitable as permanent Azure OAuth redirect URIs. This solution uses a **permanent Cloudflare Workers.dev URL** that never expires.

## 🏗️ Architecture

```
Azure OAuth → https://shreenathji-oauth-worker.youraccount.workers.dev/auth/outlook/callback
             ↓ (Worker forwards ALL params)
Back4App: https://yourapp.back4app.io/api/oauth/callback?code=ABC123&state=xyz
             ↓ (Exchanges code → Stores tokens)
App Settings → "Connected ✓ user@company.com"
```

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

### Step 3: Configure Back4App URL

Edit `cloudflare-worker/wrangler.toml` and set your Back4App URL:

```toml
[vars]
BACK4APP_BASE_URL = "https://globalreachexporterleadautomator-sozgszuo.b4a.run"
```

Replace with your actual Back4App app URL.

### Step 4: Deploy Worker

```bash
cd cloudflare-worker
wrangler deploy
```

### Step 5: Copy Your Worker URL

After deployment, you'll see output like:
```
✨  Deployed to https://shreenathji-oauth-worker.your-account.workers.dev
```

**Copy this URL** - you'll need it for Azure and app configuration.

## 🔧 Azure App Registration Setup

### Step 1: Go to Azure Portal

1. Visit: https://portal.azure.com
2. Navigate to **App registrations** → Your app
3. Click **"Authentication"** in the left sidebar

### Step 2: Add Cloudflare Worker Redirect URIs

Under **"Platform configurations"** → **"Web"** platform, add these redirect URIs:

```
https://shreenathji-oauth-worker.youraccount.workers.dev/auth/outlook/callback
https://shreenathji-oauth-worker.youraccount.workers.dev/auth/whatsapp/callback
https://shreenathji-oauth-worker.youraccount.workers.dev/auth/wechat/callback
```

**Important:**
- Replace `youraccount` with your actual Cloudflare account subdomain
- Use **exact URLs** from your worker deployment
- Make sure they're in the **"Web"** platform, NOT "Single-page application"

### Step 3: Save and Wait

1. Click **"Save"** at the top
2. Wait **3-5 minutes** for Azure to propagate changes

## ⚙️ App Configuration

### Step 1: Open Settings

1. Open your Shreenathji app
2. Go to **Settings** → **Integrations** tab
3. Scroll to **"OAuth Configuration (Advanced)"** section

### Step 2: Enter Cloudflare Worker URL

In the **"Cloudflare Worker URL"** field, enter:

```
https://shreenathji-oauth-worker.youraccount.workers.dev
```

**Note:** Enter the base URL without the `/auth/outlook/callback` path.

### Step 3: Save Configuration

Click **"Save OAuth Configuration"**

## ✅ Complete Flow Test

1. **Click "Connect Outlook"** in Settings → Integrations
2. **Redirect to Azure** → Login with Microsoft account
3. **Azure redirects to Cloudflare Worker** → `https://shreenathji-oauth-worker.youraccount.workers.dev/auth/outlook/callback?code=...`
4. **Worker forwards to Back4App** → `https://yourapp.back4app.io/api/oauth/callback?code=...`
5. **Back4App exchanges code** → Stores tokens in database
6. **Redirects to app** → Shows "Connected ✓ user@company.com"

## 🛡️ Security Features

- ✅ Worker only handles `/auth/*/callback` paths (404 everything else)
- ✅ No open redirects - only allows redirects to configured Back4App domain
- ✅ Preserves ALL OAuth query parameters (code, state, error, etc.)
- ✅ HTTPS enforced automatically by Cloudflare
- ✅ Logs forwarding for debugging
- ✅ Permanent workers.dev URL (never expires)

## 📊 Monitoring & Debugging

### View Worker Logs

```bash
cd cloudflare-worker
wrangler tail
```

Or check Cloudflare Dashboard:
1. Go to: https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **shreenathji-oauth-worker**
3. Click **"Logs"** tab

### Check Back4App Logs

Verify that `/api/oauth/callback` is receiving forwarded requests:
- Check Back4App dashboard logs
- Look for requests with `x-forwarded-for` header (indicates proxy)

### Common Issues

**Issue: 404 from Worker**
- **Cause:** Path doesn't match `/auth/(outlook|whatsapp|wechat)/callback`
- **Fix:** Ensure Azure redirect URI matches exactly

**Issue: Redirect loop**
- **Cause:** Back4App URL incorrect in `wrangler.toml`
- **Fix:** Verify `BACK4APP_BASE_URL` in `wrangler.toml`

**Issue: OAuth callback not saving**
- **Cause:** Back4App route not receiving forwarded params
- **Fix:** Check Back4App logs, verify query parameters are preserved

## 💰 Cost

- **Cloudflare Workers:** FREE (100k requests/day)
- **Back4App:** FREE (web hosting + database)
- **Azure OAuth:** FREE
- **Total: $0/mo** → Production ready

## 🔄 Updating Worker

If you need to update the worker code:

```bash
cd cloudflare-worker
# Make your changes to src/index.js
wrangler deploy
```

## 📝 Worker Code Location

- **Worker code:** `cloudflare-worker/src/index.js`
- **Configuration:** `cloudflare-worker/wrangler.toml`
- **Package:** `cloudflare-worker/package.json`

## 🎯 Benefits

1. **Permanent URL** - Never expires (unlike Back4App preview URLs)
2. **Free** - No cost for Cloudflare Workers free tier
3. **Fast** - Cloudflare's global CDN
4. **Secure** - HTTPS enforced, no open redirects
5. **Flexible** - Works with any Back4App URL (even if it changes)

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Azure App Registration Guide](./AZURE_AD_OAUTH_SETUP.md)

