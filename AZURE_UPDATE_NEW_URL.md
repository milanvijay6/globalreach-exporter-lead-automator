# Azure Redirect URI - Update with New Cloudflare URL

## ❌ Error You're Seeing

```
AADSTS50011: The redirect URI 'https://developmental-supplemental-alloy-times.trycloudflare.com/api/oauth/callback' 
does not match the redirect URIs configured for the application
```

## 🔍 The Problem

The Cloudflare Tunnel URL has changed. Your app is now using:
- **New URL:** `https://developmental-supplemental-alloy-times.trycloudflare.com`

But Azure Portal only has the old URL configured.

## ✅ Solution: Add New URL to Azure Portal

### **Step 1: Go to Azure Portal**
1. Visit: https://portal.azure.com
2. Sign in with your Microsoft account
3. Search for **"App registrations"**
4. Click on **"App registrations"**
5. Select your app: **649aa87d-4799-466b-ae15-078049518573**

### **Step 2: Update Authentication Settings**
1. Click **"Authentication"** in the left sidebar
2. Scroll to **"Platform configurations"**
3. Click on **"Web"** platform to edit

### **Step 3: Add New Redirect URI**
In the **"Redirect URIs"** field, you should have:
- `http://localhost:4000/api/oauth/callback` (backup)

**Add the new Cloudflare URL:**
- `https://developmental-supplemental-alloy-times.trycloudflare.com/api/oauth/callback`

**You should now have BOTH:**
1. `http://localhost:4000/api/oauth/callback` (backup)
2. `https://developmental-supplemental-alloy-times.trycloudflare.com/api/oauth/callback` (current)

### **Step 4: Save**
1. Click **"Save"** at the top
2. **Wait 3-5 minutes** for Azure to propagate changes

### **Step 5: Verify "Single-page application" is Empty**
- ✅ Should be **EMPTY** or show "No redirect URIs configured"
- ❌ Should **NOT** contain any redirect URIs

---

## 🔄 Why This Happens

Cloudflare Tunnel URLs change each time you restart the tunnel. The app automatically:
1. Starts Cloudflare Tunnel when app starts
2. Gets a new random URL
3. Uses that URL for OAuth

**Solutions:**

### **Option 1: Add Both URLs (Recommended)**
- Keep `localhost` as backup
- Add new Cloudflare URL when it changes
- Both will work

### **Option 2: Use Only localhost**
- Remove Cloudflare URL from Azure
- App will automatically use localhost as fallback
- More stable (URL never changes)

---

## 📋 Quick Checklist

- [ ] Added new Cloudflare URL to Azure Portal
- [ ] Kept localhost URL as backup
- [ ] Saved changes in Azure Portal
- [ ] Waited 3-5 minutes
- [ ] Verified "Single-page application" is empty
- [ ] Tried connecting Outlook again

---

## 🎯 Current URLs to Add

**Add these to Azure Portal → Authentication → Web:**

1. **localhost (Backup):**
   ```
   http://localhost:4000/api/oauth/callback
   ```

2. **Current Cloudflare URL:**
   ```
   https://developmental-supplemental-alloy-times.trycloudflare.com/api/oauth/callback
   ```

---

## ⚠️ Important Notes

1. **URLs change:** Cloudflare Tunnel URLs change each restart
2. **Add both:** Having both URLs ensures it always works
3. **Wait time:** Azure needs 3-5 minutes to propagate changes
4. **localhost is stable:** localhost URL never changes

---

## 🆘 If It Still Doesn't Work

1. **Wait longer:** Azure can take up to 10 minutes
2. **Clear browser cache:** Try incognito mode
3. **Use localhost only:** Remove Cloudflare URL, use only localhost
4. **Check exact match:** URL must match exactly (no trailing slash, exact case)


