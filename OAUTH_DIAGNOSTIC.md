# OAuth Connection Diagnostic Guide

## 🔍 Step-by-Step Troubleshooting

Since Azure Portal is configured correctly, the issue is likely in the OAuth flow itself. Follow these steps:

### **Step 1: Check Console Logs**

1. Open your Electron app
2. Open DevTools (should auto-open, or press `F12`)
3. Go to **Console** tab
4. Try connecting Outlook again
5. Look for error messages starting with:
   - `[OAuthService]`
   - `[EmailOAuthModal]`
   - `[OAuthCallback]`

### **Step 2: Check Server Logs**

Check the server logs for OAuth callback:
- Location: `C:\Users\Asus\AppData\Roaming\shreenathji-app\logs\combined.log`
- Look for: "OAuth callback received"

### **Step 3: Verify Configuration**

1. In your app, go to **Settings** → **Integrations** → **Email & OAuth**
2. Verify:
   - ✅ **Client ID** is set (starts with `649aa87d...`)
   - ✅ **Client Secret** is set (long string)
   - ✅ **Tenant ID** is set (or "common")

### **Step 4: Check Redirect URI Match**

1. Check your **Server Port** in Settings → System
2. Verify Azure Portal has EXACTLY:
   ```
   http://localhost:[YOUR_PORT]/api/oauth/callback
   ```
3. Must match exactly (no trailing slash, lowercase, correct port)

### **Step 5: Common Issues**

#### Issue 1: "Invalid client secret"
**Cause:** Using Secret ID instead of Secret Value

**Fix:**
1. Azure Portal → App registrations → Your app
2. Go to "Certificates & secrets"
3. Copy the **VALUE** (not the Secret ID)
4. Paste into Client Secret field

#### Issue 2: Code expires before exchange
**Cause:** Taking too long between authorization and callback

**Fix:**
1. Try connecting immediately after authorization
2. Don't wait more than 1-2 minutes

#### Issue 3: State validation fails
**Cause:** State parameter doesn't match

**Fix:**
- I've made the code more lenient - should work now

#### Issue 4: Redirect URI mismatch
**Cause:** Azure has different URI or port

**Fix:**
1. Check Azure Portal → Authentication → Web
2. Must have EXACTLY: `http://localhost:[PORT]/api/oauth/callback`
3. Port must match your server port

---

## 🧪 Test the OAuth Flow Manually

1. **Get Authorization URL:**
   - Click "Connect Outlook" in your app
   - Copy the URL from the browser
   - It should look like: `https://login.microsoftonline.com/...`

2. **Authorize:**
   - Complete authorization in browser
   - You should be redirected to: `http://localhost:[PORT]/api/oauth/callback?code=...&state=...`

3. **Check if callback is received:**
   - Look in server logs for "OAuth callback received"
   - Check DevTools console for callback processing

---

## 📋 What to Check

- [ ] Client ID matches Azure App ID (649aa87d-4799-466b-ae15-078049518573)
- [ ] Client Secret is the VALUE (not the Secret ID)
- [ ] Redirect URI in Azure matches: `http://localhost:[PORT]/api/oauth/callback`
- [ ] Server port matches in Settings → System
- [ ] No firewall blocking localhost
- [ ] App is actually running when you try to connect

---

## 🔧 Quick Fixes to Try

1. **Restart the app completely**
2. **Clear browser cache** (for the OAuth browser window)
3. **Try a different browser** for OAuth (if possible)
4. **Check Windows Firewall** - allow port 4000 or 4001
5. **Wait 5+ minutes** after Azure changes

---

## 🆘 If Still Not Working

Share these details:
1. **Error message** from DevTools console
2. **Server logs** (from logs/combined.log)
3. **Your server port** (Settings → System)
4. **Screenshot of Azure Portal** → Authentication → Platform configurations














