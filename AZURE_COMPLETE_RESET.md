# Azure OAuth Complete Reset - Step by Step

## ⚠️ Problem
Azure is still detecting your app as "Single-Page Application" even though you added it to "Web".

## ✅ Complete Reset Steps

### **STEP 1: Remove EVERYTHING First**

1. Go to: https://portal.azure.com
2. Navigate to: **App registrations** → Your app (**649aa87d-4799-466b-ae15-078049518573**)
3. Click: **"Authentication"**
4. Scroll to: **"Platform configurations"**

#### **A. Clear "Single-page application" COMPLETELY:**
- Look at **"Single-page application"** section
- **Remove EVERY redirect URI** from this section
- Click on each URI → Click **"Remove"** → Confirm
- Keep removing until the section shows: **"No redirect URIs configured"** or is empty

#### **B. Clear "Web" section (temporarily):**
- Look at **"Web"** section
- **Remove ALL redirect URIs** from this section too (we'll add back)
- Click on each URI → Click **"Remove"** → Confirm

5. Click **"Save"** at the top
6. **Wait 5 minutes** for Azure to clear everything

---

### **STEP 2: Add ONLY to "Web" Platform**

1. After waiting 5 minutes, refresh the Azure Portal page
2. Go to **"Authentication"** again
3. Under **"Platform configurations"**, click **"+ Add a platform"**
4. Select **"Web"** (NOT "Single-page application")
5. In **"Redirect URIs"** field, enter EXACTLY:
   ```
   http://localhost:4000/api/oauth/callback
   ```
   - All lowercase
   - No trailing slash
   - Exact spelling
6. Click **"Configure"**
7. Click **"Save"** at the top
8. **Wait another 5 minutes**

---

### **STEP 3: Verify Configuration**

After saving and waiting, check:

- ✅ **"Web"** platform shows ONLY: `http://localhost:4000/api/oauth/callback`
- ✅ **"Single-page application"** is COMPLETELY EMPTY (no URIs)
- ✅ No other redirect URIs exist anywhere

---

### **STEP 4: Additional Azure Settings**

Sometimes you need to check the App Manifest:

1. In Azure Portal → Your app → Click **"Manifest"** (left sidebar)
2. Look for `"accessTokenAcceptedVersion"` - should be `2`
3. Look for `"signInAudience"` - should be `"AzureADMultipleOrgs"` or `"AzureADandPersonalMicrosoftAccount"`
4. If changed, click **"Save"**
5. Wait 5 minutes

---

## 🔄 Alternative: Use Different Redirect URI

If Azure is still caching, try using a completely different redirect URI:

### **New Redirect URI to Try:**
```
http://localhost:4000/auth/outlook/callback
```

This avoids any cached configuration.

---

## 🧹 Clear Azure Cache

1. **Log out** of Azure Portal completely
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Close browser** completely
4. **Open browser in incognito/private mode**
5. **Log back in** to Azure Portal
6. Check configuration again

---

## ✅ Final Verification Checklist

Before trying to connect:

- [ ] Removed ALL redirect URIs from "Single-page application"
- [ ] Removed all redirect URIs from "Web" (then re-added)
- [ ] Added redirect URI ONLY to "Web" platform
- [ ] Redirect URI is EXACTLY: `http://localhost:4000/api/oauth/callback`
- [ ] Saved all changes
- [ ] Waited 5+ minutes after each save
- [ ] Cleared browser cache and refreshed Azure Portal
- [ ] Checked App Manifest settings
- [ ] Verified "Single-page application" is empty

---

## 🚨 If STILL Not Working

Try creating a NEW app registration:

1. Create a brand new app registration in Azure
2. Configure it as "Web" from the start
3. Add redirect URI: `http://localhost:4000/api/oauth/callback`
4. Copy new Client ID and Secret
5. Update your app with new credentials

This avoids any cached/conflicting configurations.








