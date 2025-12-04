# Outlook OAuth Fix - Complete Troubleshooting Guide

## ⚠️ Current Error
```
Azure app registration type mismatch. Your app is configured as "Single-page Application" but needs to be "Web" application.
```

## 🔍 Root Cause
Azure is still detecting your redirect URI as a "Single-page application" even though you added it to "Web". This happens when:
1. The URI exists in BOTH platforms (Azure treats it as SPA)
2. Azure hasn't propagated changes yet (takes 3-5 minutes)
3. There's a typo or case mismatch in the redirect URI

---

## ✅ Step-by-Step Fix (Do This Now)

### **Step 1: Verify Current State in Azure Portal**

1. Go to: https://portal.azure.com
2. Search: **"App registrations"**
3. Click: Your app (**649aa87d-4799-466b-ae15-078049518573**)
4. Click: **"Authentication"** (left sidebar)
5. Scroll to: **"Platform configurations"**

### **Step 2: Check BOTH Sections**

#### **A. Single-page application Section**
- **MUST BE COMPLETELY EMPTY**
- If you see ANY redirect URI here (even if it's different), remove it
- Click on each URI → Click "Remove" → Confirm

#### **B. Web Section**
- **MUST CONTAIN**: `http://localhost:4000/auth/oauth/callback`
- If it's missing, add it (see Step 3)
- If it exists, verify it's EXACTLY: `http://localhost:4000/auth/oauth/callback` (no trailing slash, lowercase)

### **Step 3: Remove from SPA (If Present)**

1. Under **"Single-page application"** section
2. If you see `http://localhost:4000/auth/oauth/callback`:
   - Click on it (or the edit/pencil icon)
   - Click **"Remove"** or trash icon
   - Click **"Yes"** to confirm
3. **VERIFY**: The section should now be empty or show "No redirect URIs configured"

### **Step 4: Add to Web (If Missing)**

1. Under **"Platform configurations"**, click **"+ Add a platform"**
2. Select **"Web"** (NOT "Single-page application")
3. In **"Redirect URIs"** field, enter EXACTLY:
   ```
   http://localhost:4000/auth/oauth/callback
   ```
   - No trailing slash
   - All lowercase
   - Exact spelling
4. Click **"Configure"**
5. Click **"Save"** at the top of the page

### **Step 5: Final Verification**

After saving, check:

✅ **"Web"** platform shows: `http://localhost:4000/auth/oauth/callback`
✅ **"Single-page application"** is EMPTY or shows "No redirect URIs configured"
❌ **"Single-page application"** does NOT contain the redirect URI

### **Step 6: Wait for Azure Propagation**

- ⏰ **Wait 3-5 minutes** after saving
- Azure needs time to propagate changes across all servers
- Don't try connecting immediately

### **Step 7: Clear Cache and Retry**

1. Close your Electron app completely
2. Restart the app
3. Try connecting Outlook again

---

## 🔧 Advanced Troubleshooting

### **Issue: Still Getting Error After Fix**

#### **Check 1: Verify Exact Redirect URI**
The redirect URI must be EXACTLY:
```
http://localhost:4000/auth/oauth/callback
```

Common mistakes:
- ❌ `http://localhost:4000/auth/oauth/callback/` (trailing slash)
- ❌ `http://localhost:4000/auth/OAuth/callback` (uppercase O)
- ❌ `https://localhost:4000/auth/oauth/callback` (https instead of http)
- ❌ `http://127.0.0.1:4000/auth/oauth/callback` (127.0.0.1 instead of localhost)

#### **Check 2: Verify App Registration ID**
Make sure you're editing the correct app:
- App ID: **649aa87d-4799-466b-ae15-078049518573**
- Check the "Application (client) ID" in Azure matches this

#### **Check 3: Check for Multiple Redirect URIs**
Sometimes Azure shows multiple entries. Make sure:
- Only ONE redirect URI exists under "Web"
- No redirect URIs exist under "Single-page application"

#### **Check 4: Azure Portal Cache**
1. Log out of Azure Portal
2. Clear browser cache
3. Log back in
4. Check the configuration again

#### **Check 5: Try Different Browser**
Sometimes browser cache causes issues:
- Try accessing Azure Portal in an incognito/private window
- Or use a different browser

---

## 🧪 Verification Script

Run this to verify your server is ready:

```bash
node test-redirect-uri.js
```

This will check if the callback endpoint is accessible.

---

## 📋 Complete Checklist

Before trying to connect again, verify:

- [ ] Removed ALL redirect URIs from "Single-page application"
- [ ] Added redirect URI to "Web" platform
- [ ] Redirect URI is EXACTLY: `http://localhost:4000/auth/oauth/callback`
- [ ] Saved all changes in Azure Portal
- [ ] Waited 3-5 minutes for Azure propagation
- [ ] Closed and restarted Electron app
- [ ] Verified app registration ID matches (649aa87d-4799-466b-ae15-078049518573)

---

## 🚨 Still Not Working?

If you've completed all steps and still get the error:

### **Option 1: Create New App Registration**
1. Create a new app registration in Azure
2. Configure it as "Web" from the start
3. Add redirect URI: `http://localhost:4000/auth/oauth/callback`
4. Update your app with new Client ID and Secret

### **Option 2: Contact Azure Support**
If the issue persists, it might be an Azure-side caching issue. Contact Azure support.

### **Option 3: Check Application Manifest**
1. In Azure Portal → Your app → "Manifest"
2. Look for `"signInAudience"` - should be `"AzureADMultipleOrgs"` or `"AzureADandPersonalMicrosoftAccount"`
3. Look for `"accessTokenAcceptedVersion"` - should be `2`
4. Save if you made changes

---

## 💡 Quick Reference

**Correct Configuration:**
```
Platform: Web
Redirect URI: http://localhost:4000/auth/oauth/callback
Single-page application: EMPTY
```

**Wrong Configuration:**
```
Platform: Single-page application
Redirect URI: http://localhost:4000/auth/oauth/callback
❌ This will cause the error
```

---

## 📞 Need More Help?

If none of these steps work, provide:
1. Screenshot of Azure Portal → Authentication → Platform configurations
2. The exact error message you're seeing
3. Whether you see the redirect URI in both "Web" and "Single-page application"














