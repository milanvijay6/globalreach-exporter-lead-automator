# Redeploy Cloudflare Worker for Gmail OAuth Support

## ✅ Fix Applied

The Cloudflare Worker code has been updated to support Gmail OAuth callbacks. The worker now handles:
- `/auth/outlook/callback` ✅
- `/auth/gmail/callback` ✅ (NEW)
- `/auth/whatsapp/callback` ✅
- `/auth/wechat/callback` ✅

## 🚀 How to Redeploy the Worker

### Option 1: Automatic Deployment (Recommended)

If you have the deployment script set up:

1. **Make sure you have Cloudflare credentials configured:**
   - `CLOUDFLARE_API_TOKEN` environment variable
   - `CLOUDFLARE_ACCOUNT_ID` environment variable (optional)

2. **Run the deployment script:**
   ```bash
   node scripts/deploy-cloudflare-worker.js
   ```

3. **The script will:**
   - Update the worker code
   - Deploy to Cloudflare
   - Save the worker URL to config

### Option 2: Manual Deployment with Wrangler

1. **Navigate to the worker directory:**
   ```bash
   cd cloudflare-worker
   ```

2. **Make sure Wrangler is installed:**
   ```bash
   npm install -g wrangler
   # Or use npx: npx wrangler deploy
   ```

3. **Authenticate with Cloudflare (if not already):**
   ```bash
   wrangler login
   ```

4. **Deploy the worker:**
   ```bash
   wrangler deploy
   ```

5. **Note the deployed URL** (it will be shown in the output)

### Option 3: Deploy via Back4App API

If you have the deployment API endpoint set up:

1. **Call the deployment endpoint:**
   ```bash
   curl -X POST https://your-back4app-url.com/api/cloudflare-worker/deploy
   ```

2. **Or use the UI:**
   - Go to Settings → Integrations → OAuth Configuration
   - Click "Deploy" button next to Cloudflare Worker URL

## 📋 After Deployment

1. **Verify the worker URL:**
   - The worker URL should be: `https://shreenathji-oauth-1764836486387.milanvijay24.workers.dev`
   - Or similar format: `https://your-worker-name.your-subdomain.workers.dev`

2. **Test the Gmail callback route:**
   - Visit: `https://your-worker-url.workers.dev/auth/gmail/callback?test=1`
   - You should see a redirect (not "Not Found")

3. **Update Google Cloud Console:**
   - Make sure the redirect URI is: `https://your-worker-url.workers.dev/auth/gmail/callback`
   - This should already be configured if you're using the worker URL

## 🔍 Verify the Fix

After redeploying, try the Gmail OAuth flow again:

1. Go to Settings → Platforms → Email → Connect
2. Select Gmail
3. Click "Connect Gmail"
4. Complete the OAuth flow
5. You should be redirected back to your app (not see "Not Found")

## ⚠️ Important Notes

- **Worker URL doesn't change**: If you redeploy the same worker, the URL stays the same
- **Changes take effect immediately**: After deployment, the new code is live
- **No downtime**: Worker deployments are instant with no downtime

## 🆘 Troubleshooting

### Still seeing "Not Found"?

1. **Verify deployment succeeded:**
   - Check the deployment output for errors
   - Make sure the worker URL is correct

2. **Check worker logs:**
   ```bash
   wrangler tail
   ```
   - This shows real-time logs from the worker
   - Look for requests to `/auth/gmail/callback`

3. **Verify the route pattern:**
   - The worker should handle: `/auth/gmail/callback`
   - Make sure there are no typos in the URL

### Worker deployment fails?

1. **Check Cloudflare credentials:**
   - Verify `CLOUDFLARE_API_TOKEN` is set
   - Verify `CLOUDFLARE_ACCOUNT_ID` is set (if required)

2. **Check Wrangler installation:**
   ```bash
   wrangler --version
   ```

3. **Check worker directory:**
   - Make sure `cloudflare-worker/src/index.js` exists
   - Make sure `cloudflare-worker/wrangler.toml` exists

## 📝 Current Worker Configuration

Based on your error, your worker URL is:
```
https://shreenathji-oauth-1764836486387.milanvijay24.workers.dev
```

After redeployment, this URL will support:
- ✅ `/auth/outlook/callback`
- ✅ `/auth/gmail/callback` (NEW)
- ✅ `/auth/whatsapp/callback`
- ✅ `/auth/wechat/callback`

## ✅ Checklist

- [ ] Updated Cloudflare Worker code (already done)
- [ ] Redeployed worker using one of the methods above
- [ ] Verified worker URL is correct
- [ ] Tested Gmail OAuth callback route
- [ ] Updated Google Cloud Console redirect URI (if needed)
- [ ] Tested full Gmail OAuth flow

