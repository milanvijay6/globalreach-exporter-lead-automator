# Azure Portal NUCLEAR RESET - Complete Cleanup

## 🚨 Problem
Azure is STILL detecting your app as SPA even after adding to Web platform. This means the redirect URI likely exists in BOTH places or Azure is caching.

## ✅ NUCLEAR RESET - Complete Cleanup

### **Step 1: Remove EVERYTHING (Complete Clean Slate)**

1. Go to: https://portal.azure.com
2. Navigate to: **App registrations** → Your app (**649aa87d-4799-466b-ae15-078049518573**)
3. Click: **"Authentication"**
4. Scroll to: **"Platform configurations"**

#### **A. Delete "Single-page application" Platform ENTIRELY:**

1. Under **"Single-page application"** section
2. Click the **"Configure"** or edit button (pencil icon)
3. **Remove ALL redirect URIs** listed
4. If the section becomes empty, you may see a **"Delete platform"** option
5. Click **"Delete platform"** or **"Remove platform"** if available
6. This completely removes the SPA platform configuration

#### **B. Delete "Web" Platform (Temporarily):**

1. Under **"Web"** section  
2. Click the **"Configure"** or edit button
3. **Remove ALL redirect URIs**
4. If you see **"Delete platform"** or **"Remove platform"**, click it
5. This removes the Web platform temporarily

5. Click **"Save"** at the top
6. **Wait 10 minutes** for Azure to fully clear everything

---

### **Step 2: Check App Manifest**

Sometimes the platform type is hardcoded in the manifest:

1. In Azure Portal → Your app → Click **"Manifest"** (left sidebar)
2. Look for these fields:
   - `"web"` - should exist
   - `"spa"` - should NOT exist or be empty
3. Find the `"web"` object and ensure it has:
   ```json
   "web": {
     "redirectUris": [
       "http://localhost:4000/api/oauth/callback"
     ]
   }
   ```
4. If `"spa"` exists, DELETE it completely
5. If `"web"` doesn't exist, we'll add it in Step 3
6. Click **"Save"**
7. **Wait 5 minutes**

---

### **Step 3: Add "Web" Platform Fresh**

1. After waiting, go back to **"Authentication"**
2. Click **"+ Add a platform"**
3. Select **"Web"** (NOT "Single-page application")
4. In **"Redirect URIs"**, enter:
   ```
   http://localhost:4000/api/oauth/callback
   ```
5. Click **"Configure"**
6. Click **"Save"**
7. **Wait 10 minutes**

---

### **Step 4: Final Verification**

After all waits, verify:

1. **Refresh Azure Portal page** (Ctrl+F5)
2. Go to **"Authentication"**
3. Check:
   - ✅ **"Web"** platform exists with: `http://localhost:4000/api/oauth/callback`
   - ✅ **"Single-page application"** section does NOT exist OR is completely empty
   - ✅ No other platforms have redirect URIs

---

### **Step 5: Clear ALL Caches**

1. **Log out** of Azure Portal
2. **Clear browser cache completely**:
   - Press `Ctrl + Shift + Delete`
   - Select "All time"
   - Check all boxes
   - Click "Clear data"
3. **Close browser completely**
4. **Restart browser**
5. **Open Azure Portal in incognito/private window**
6. **Log back in**
7. Check configuration again

---

### **Step 6: Check App Manifest Directly**

1. Go to **"Manifest"**
2. Download the manifest (click "Download")
3. Open in text editor
4. Search for `"spa"` - should NOT exist
5. Search for `"web"` - should exist with redirect URI
6. If `"spa"` exists, remove it:
   ```json
   // DELETE THIS ENTIRE SECTION:
   "spa": {
     "redirectUris": [...]
   }
   ```
7. Save and upload manifest back to Azure
8. Wait 10 minutes

---

## 🔧 Alternative Solution: Create NEW App Registration

If the above doesn't work, create a brand new app:

1. **Create New App Registration:**
   - Azure Portal → App registrations → "+ New registration"
   - Name: "GlobalReach Outlook OAuth" (or any name)
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Leave blank for now
   - Click "Register"

2. **Configure as Web from Start:**
   - Go to "Authentication"
   - Click "+ Add a platform" → Select "Web"
   - Add redirect URI: `http://localhost:4000/api/oauth/callback`
   - Click "Configure" → "Save"

3. **Get New Credentials:**
   - Copy the new **Application (client) ID**
   - Go to "Certificates & secrets" → Create new secret → Copy **VALUE**

4. **Update Your App:**
   - Settings → Integrations → Email & OAuth
   - Enter new Client ID
   - Enter new Client Secret (the VALUE)
   - Save

5. **Wait 5 minutes** and try connecting

---

## 📋 Complete Checklist

- [ ] Removed ALL redirect URIs from "Single-page application"
- [ ] Deleted "Single-page application" platform entirely (if possible)
- [ ] Removed ALL redirect URIs from "Web"
- [ ] Saved changes
- [ ] Waited 10 minutes
- [ ] Checked App Manifest - removed "spa" section if exists
- [ ] Added "Web" platform fresh with redirect URI
- [ ] Saved again
- [ ] Waited 10 minutes
- [ ] Cleared browser cache completely
- [ ] Logged out and back into Azure Portal
- [ ] Verified configuration in incognito window
- [ ] Verified "Single-page application" does NOT exist or is empty
- [ ] Verified "Web" has redirect URI

---

## ⚠️ Critical Points

1. **The redirect URI MUST exist ONLY in "Web"**
2. **"Single-page application" MUST be completely empty or deleted**
3. **If redirect URI exists in BOTH, Azure treats it as SPA**
4. **Azure can cache for 10+ minutes - wait longer**
5. **Browser cache can show old configuration - use incognito**

---

## 🎯 Quick Test

After completing all steps:

1. Open Azure Portal in **incognito/private window**
2. Check "Authentication" → Platform configurations
3. Should see:
   - **Web**: `http://localhost:4000/api/oauth/callback` ✅
   - **Single-page application**: Does NOT exist or is empty ✅

If you see the redirect URI in BOTH sections, Azure will still treat it as SPA!




