# Azure Redirect URI Update - New URL

## ⚠️ IMPORTANT: Redirect URI Changed

The redirect URI has been changed to avoid Azure caching issues:

### **OLD Redirect URI:**
```
http://localhost:4000/auth/oauth/callback
```

### **NEW Redirect URI:**
```
http://localhost:4000/api/oauth/callback
```

---

## 🔧 Update Azure Portal Configuration

### **Step 1: Remove Old Redirect URI**

1. Go to Azure Portal → App registrations → Your app
2. Click **"Authentication"**
3. Under **"Platform configurations"**:
   - **"Web"** section: Remove `http://localhost:4000/auth/oauth/callback` if it exists
   - **"Single-page application"** section: Remove `http://localhost:4000/auth/oauth/callback` if it exists
4. Click **"Save"**

### **Step 2: Add New Redirect URI**

1. Under **"Platform configurations"**, click **"+ Add a platform"**
2. Select **"Web"** (NOT "Single-page application")
3. In **"Redirect URIs"** field, enter EXACTLY:
   ```
   http://localhost:4000/api/oauth/callback
   ```
4. Click **"Configure"**
5. Click **"Save"** at the top

### **Step 3: Verify Configuration**

After saving, verify:
- ✅ **"Web"** platform contains: `http://localhost:4000/api/oauth/callback`
- ✅ **"Single-page application"** is EMPTY
- ✅ Old URI (`/auth/oauth/callback`) is completely removed

### **Step 4: Wait and Test**

1. Wait 3-5 minutes for Azure to propagate changes
2. Restart your Electron app
3. Try connecting Outlook again

---

## ✅ What Was Changed in Code

The following files were updated:
- ✅ `electron/main.js` - OAuth callback route changed to `/api/oauth/callback`
- ✅ `components/EmailOAuthModal.tsx` - Redirect URI updated
- ✅ `services/integrationService.ts` - Redirect URI updated
- ✅ `services/oauthService.ts` - Error messages updated
- ✅ `test-redirect-uri.js` - Test script updated

---

## 🧪 Test the New Redirect URI

Run this command to verify the endpoint is working:

```bash
node test-redirect-uri.js
```

Or manually test in browser:
```
http://localhost:4000/api/oauth/callback?test=1
```

---

## 📋 Quick Checklist

- [ ] Removed old redirect URI (`/auth/oauth/callback`) from Azure
- [ ] Added new redirect URI (`/api/oauth/callback`) to Azure "Web" platform
- [ ] Verified "Single-page application" is empty
- [ ] Saved all changes in Azure Portal
- [ ] Waited 3-5 minutes for propagation
- [ ] Restarted Electron app
- [ ] Tested Outlook connection

---

## 💡 Why This Change?

Changing the redirect URI path helps avoid Azure caching issues where the old configuration might still be cached. Using `/api/oauth/callback` is also more standard for API endpoints.

---

## 🚨 If You Still Get Errors

1. **Double-check the redirect URI is EXACTLY:**
   ```
   http://localhost:4000/api/oauth/callback
   ```
   - No trailing slash
   - All lowercase
   - Exact spelling

2. **Verify it's ONLY in "Web" platform:**
   - Not in "Single-page application"
   - Only one entry under "Web"

3. **Clear browser cache and restart app**

4. **Wait 5 minutes** - Azure propagation can be slow
















