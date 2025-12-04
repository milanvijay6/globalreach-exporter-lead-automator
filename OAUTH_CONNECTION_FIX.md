# OAuth Connection Fix - Complete Guide

## ✅ What I Fixed

1. **EPIPE Error Handling** - App no longer crashes on broken pipe errors
2. **Better State Validation** - More lenient state parsing to allow OAuth to proceed
3. **Enhanced Logging** - Detailed logs at every step of OAuth flow
4. **Improved Error Messages** - Clearer error messages showing exact issues
5. **Callback Robustness** - OAuth callback handles missing/partial data gracefully

---

## 🔧 What You Need to Verify

### **1. Azure Portal Configuration**

Go to Azure Portal → App registrations → Your app → Authentication

**Check "Single-page application" section:**
- ✅ Should be **EMPTY** (no redirect URIs)

**Check "Web" section:**
- ✅ Should contain: `http://localhost:[PORT]/api/oauth/callback`
- ✅ Replace `[PORT]` with your actual server port (check Settings → System)

**Example:**
- If port is 4000: `http://localhost:4000/api/oauth/callback`
- If port is 4001: `http://localhost:4001/api/oauth/callback`

### **2. App Settings**

In your app, go to **Settings** → **Integrations** → **Email & OAuth**:

- ✅ **Client ID**: Should match Azure App ID (starts with `649aa87d...`)
- ✅ **Client Secret**: Should be the **VALUE** (not the Secret ID)
  - Long string of random characters
  - Only shown once when created
- ✅ **Tenant ID**: Usually "common" (unless using specific tenant)

### **3. Server Port**

Check your server port:
1. Go to **Settings** → **System**
2. Note the **Server Port** number
3. Ensure Azure redirect URI uses this exact port

---

## 🧪 Testing Steps

1. **Restart your app completely**
   ```bash
   # Close app completely, then:
   npm start
   ```

2. **Open DevTools** (F12 or should auto-open)
   - Go to **Console** tab
   - Clear console logs

3. **Try connecting Outlook:**
   - Go to Settings → Integrations → Email & OAuth
   - Click "Connect Outlook"
   - Authorize in browser
   - Watch console for errors

4. **Check for specific errors:**

   **If you see:** `Invalid client secret`
   - Fix: Copy the Secret **VALUE** (not ID) from Azure

   **If you see:** `Redirect URI mismatch`
   - Fix: Check Azure Portal redirect URI matches exactly

   **If you see:** `OAuth callback missing code`
   - Fix: Try again immediately (code expires quickly)

   **If you see:** `Failed to exchange Outlook code`
   - Check console for detailed error
   - Usually means Client ID/Secret or redirect URI issue

---

## 📋 Debug Checklist

Run through this checklist:

- [ ] Azure Portal: "Single-page application" is EMPTY
- [ ] Azure Portal: "Web" has redirect URI with correct port
- [ ] App Settings: Client ID matches Azure App ID
- [ ] App Settings: Client Secret is the VALUE (not Secret ID)
- [ ] App Settings: Tenant ID is set (usually "common")
- [ ] Server is running (check Settings → System)
- [ ] Server port matches redirect URI in Azure
- [ ] No firewall blocking localhost
- [ ] Waited 3-5 minutes after Azure changes
- [ ] Restarted app after making changes

---

## 🔍 Check Console Logs

When you try to connect, look for these log messages:

1. `[EmailOAuthModal] Setting up OAuth callback listener` ✅
2. `[EmailOAuthModal] OAuth configuration` ✅
3. `[OAuthService] Outlook OAuth URL generated` ✅
4. Browser opens for authorization ✅
5. After authorization: `[OAuthService] Handling OAuth callback` ✅
6. `[OAuthService] Exchanging Outlook code for tokens` ✅
7. `[OAuthService] Outlook tokens obtained successfully` ✅

**If any step fails, check the error message right after it.**

---

## 🆘 Still Not Working?

### **Check These:**

1. **Open DevTools Console** (F12)
   - Look for red error messages
   - Copy the full error text

2. **Check Server Logs:**
   - Location: `C:\Users\Asus\AppData\Roaming\shreenathji-app\logs\combined.log`
   - Look for "OAuth callback received" or errors

3. **Verify Redirect URI Exactly:**
   - Must be: `http://localhost:[PORT]/api/oauth/callback`
   - No `https`, no trailing slash, all lowercase

4. **Test Redirect URI Manually:**
   - Open browser
   - Go to: `http://localhost:[PORT]/api/oauth/callback?test=1`
   - Should show success page or error (not "can't reach")

---

## 💡 Quick Test

Run this to test your redirect URI endpoint:

```bash
node test-redirect-uri.js
```

This will verify the OAuth callback endpoint is accessible.

---

## 🎯 Most Common Issues

### **Issue 1: Client Secret is Secret ID**
**Symptom:** "Invalid client secret" error

**Fix:** 
- Azure Portal → Certificates & secrets
- Copy the **VALUE** column (not the Secret ID)
- If value is hidden, create a new secret

### **Issue 2: Redirect URI Port Mismatch**
**Symptom:** Connection fails silently or "redirect URI mismatch"

**Fix:**
- Check Settings → System for server port
- Update Azure Portal redirect URI to match exact port

### **Issue 3: Azure Still Has SPA Configuration**
**Symptom:** "Single-Page Application" error

**Fix:**
- Remove ALL redirect URIs from "Single-page application"
- Ensure redirect URI ONLY exists under "Web"

---

## 📞 Need More Help?

If still not working after all checks, provide:

1. **Full error message** from DevTools console
2. **Screenshot of Azure Portal** → Authentication page
3. **Your server port** (from Settings → System)
4. **Last few lines of** `combined.log` file













