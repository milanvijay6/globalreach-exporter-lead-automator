# Fix OAuth "Not Found" Error

## Problem
Getting "not found" error when logging in to Outlook - not redirecting back to app and not connecting account.

## Possible Causes

### 1. Wrong Redirect URI in Azure
The redirect URI in Azure App Registration must match exactly what you're using.

**Check your Azure App Registration:**
1. Go to Azure Portal → App Registrations → Your App
2. Click **Authentication**
3. Under **Redirect URIs**, check what's configured

**For Web (Back4App):**
- If using Cloudflare Worker: `https://your-worker-name.workers.dev/auth/outlook/callback`
- If using direct Back4App URL: `https://your-app.b4a.run/api/oauth/callback`
- If using current URL: `https://your-current-url.com/api/oauth/callback`

**For Electron (Local):**
- `http://localhost:4000/api/oauth/callback`

### 2. Cloudflare Worker Not Deployed
If you're using Cloudflare Worker URL but it's not deployed, you'll get 404.

**Check:**
1. Go to Cloudflare Dashboard → Workers & Pages
2. Verify your worker exists and is deployed
3. Test the worker URL: `https://your-worker-name.workers.dev/auth/outlook/callback`
4. It should redirect to your Back4App URL

### 3. OAuth Route Not Working
The `/api/oauth/callback` route might not be accessible.

**Test the route:**
1. Visit: `https://your-app-url.com/api/oauth/test`
2. Should return: `{"success": true, "message": "OAuth routes are working"}`
3. If you get 404, the route isn't registered correctly

### 4. Wrong Callback URL in App Settings
The redirect URI used when initiating OAuth must match Azure.

**Check in your app:**
1. Go to Settings → Integrations → Email & OAuth
2. Check what redirect URI is being used
3. It should match what's in Azure

## Step-by-Step Fix

### Step 1: Verify OAuth Route is Working

1. **Test the route:**
   ```
   https://your-app-url.com/api/oauth/test
   ```
   Should return: `{"success": true, "message": "OAuth routes are working"}`

2. **If you get 404:**
   - The route isn't registered
   - Check server logs for errors
   - Verify the route file exists: `server/routes/oauth.js`

### Step 2: Check Your Redirect URI

1. **In your app (Settings → Integrations):**
   - Note the redirect URI being used
   - It should be one of:
     - Cloudflare Worker: `https://worker-name.workers.dev/auth/outlook/callback`
     - Direct Back4App: `https://app.b4a.run/api/oauth/callback`
     - Current URL: `https://current-url.com/api/oauth/callback`

2. **In Azure Portal:**
   - Go to App Registrations → Your App → Authentication
   - Under **Redirect URIs**, verify the exact URL matches
   - Must be EXACT match (case-sensitive, no trailing slash)

### Step 3: Verify Cloudflare Worker (if using)

1. **Check if worker is deployed:**
   - Go to Cloudflare Dashboard → Workers & Pages
   - Find your worker
   - Check if it's active

2. **Test worker URL:**
   ```
   https://your-worker-name.workers.dev/auth/outlook/callback?code=test&state=test
   ```
   - Should redirect to your Back4App URL
   - If you get 404, worker isn't deployed or URL is wrong

3. **Check worker configuration:**
   - Verify `BACK4APP_BASE_URL` is set correctly
   - Should be your Back4App URL (e.g., `https://app.b4a.run`)

### Step 4: Check Server Logs

After trying to connect Outlook, check your Back4App logs for:

1. **OAuth callback received:**
   ```
   [OAuth] Callback route hit: ...
   ```

2. **Redirect happening:**
   ```
   [OAuth] Redirecting to frontend: ...
   ```

3. **Any errors:**
   ```
   [OAuth] Callback error: ...
   ```

### Step 5: Common Issues and Fixes

#### Issue: "Not Found" when visiting callback URL directly
**Fix:** The route should work. If not, check:
- Route is registered in `server/index.js`
- Route file exists: `server/routes/oauth.js`
- Server is running and routes are loaded

#### Issue: Redirect URI mismatch
**Fix:** 
- Azure redirect URI must match EXACTLY
- Check for trailing slashes, http vs https, etc.
- Update Azure to match what your app is using

#### Issue: Cloudflare Worker returns 404
**Fix:**
- Deploy the worker: Go to Settings → Cloudflare Worker → Deploy
- Or deploy manually via API
- Verify worker URL is correct in app settings

#### Issue: Callback redirects but account doesn't connect
**Fix:**
- Check browser console for errors
- Check server logs for OAuth processing errors
- Verify OAuth credentials (Client ID, Client Secret) are correct

## Quick Checklist

- [ ] OAuth route test endpoint works: `/api/oauth/test`
- [ ] Redirect URI in Azure matches what app is using
- [ ] Cloudflare Worker is deployed (if using)
- [ ] Cloudflare Worker URL is correct in app settings
- [ ] OAuth credentials (Client ID, Secret) are correct
- [ ] Server logs show OAuth callback being received
- [ ] No errors in browser console
- [ ] User is logged in to the app

## Testing

1. **Test OAuth route:**
   ```
   Visit: https://your-app-url.com/api/oauth/test
   Expected: {"success": true, "message": "OAuth routes are working"}
   ```

2. **Test callback (simulated):**
   ```
   Visit: https://your-app-url.com/api/oauth/callback?code=test123&state=test456
   Expected: Redirects to frontend with OAuth parameters
   ```

3. **Test full flow:**
   - Click "Connect Outlook" in app
   - Complete Microsoft login
   - Should redirect back to app
   - Account should connect

## Still Not Working?

1. **Check server logs** for detailed error messages
2. **Check browser console** for JavaScript errors
3. **Verify all URLs** match exactly (no typos, correct protocol)
4. **Test with a simple redirect URI** first (e.g., direct Back4App URL)
5. **Check Azure App Registration** - ensure redirect URI is in "Web" platform, not "Single-page application"

## Need More Help?

Check these files for more details:
- `server/routes/oauth.js` - OAuth callback route
- `components/EmailOAuthModal.tsx` - OAuth modal handling
- `services/oauthService.ts` - OAuth service logic

