# Azure OAuth with Cloudflare Tunnel - Setup Guide

## ✅ What Changed

The app now uses **Cloudflare Tunnel URL** for Azure OAuth redirect URI instead of localhost.

### **New Azure Redirect URI:**
```
https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback
```

---

## 🔧 Update Azure Portal

### **Step 1: Go to Azure Portal**
1. Visit: https://portal.azure.com
2. Sign in with your Microsoft account
3. Search for **"App registrations"**
4. Click on **"App registrations"**
5. Select your app registration

### **Step 2: Update Authentication Settings**
1. Click **"Authentication"** in the left sidebar
2. Scroll to **"Platform configurations"**

### **Step 3: Update "Web" Platform**

**If "Web" platform exists:**
1. Click on the "Web" platform to edit
2. Remove any old redirect URIs (like `http://localhost:4000/api/oauth/callback`)
3. Add new redirect URI:
   ```
   https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback
   ```
4. Click **"Save"**

**If "Web" platform doesn't exist:**
1. Click **"+ Add a platform"**
2. Select **"Web"** (NOT "Single-page application")
3. In **"Redirect URIs"** field, enter:
   ```
   https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback
   ```
4. Click **"Configure"**
5. Click **"Save"**

### **Step 4: Verify "Single-page application" is Empty**
- ✅ Should be **EMPTY** or show "No redirect URIs configured"
- ❌ Should **NOT** contain any redirect URIs

### **Step 5: Save and Wait**
1. Click **"Save"** at the top
2. **Wait 3-5 minutes** for Azure to propagate changes

---

## ⚠️ Important Notes

### **If Azure Rejects the URL:**

Azure may show an error like:
- "Wildcard characters, HTTP scheme not allowed"
- "Must be a valid URL"

**This can happen if:**
1. Azure doesn't accept `.trycloudflare.com` domains
2. Your Azure AD tenant has domain restrictions

**Solutions:**

**Option 1: Use localhost (Fallback)**
- The app will automatically fallback to localhost if Cloudflare URL is not available
- Use: `http://localhost:4000/api/oauth/callback` in Azure

**Option 2: Try the Cloudflare URL anyway**
- Some Azure configurations accept it
- Make sure the URL is exactly: `https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback`
- No trailing slash, exact format

**Option 3: Use a custom domain (Production)**
- For production, use your own domain with SSL
- Example: `https://yourapp.com/api/oauth/callback`

---

## 🔄 How It Works

The app automatically:
1. **Checks for Cloudflare Tunnel URL** in config
2. **Uses Cloudflare URL** if available: `https://xxxxx.trycloudflare.com/api/oauth/callback`
3. **Falls back to localhost** if Cloudflare URL is not available: `http://localhost:4000/api/oauth/callback`

### **Current Cloudflare Tunnel URL:**
```
https://wheel-baking-survivors-budgets.trycloudflare.com
```

### **OAuth Callback URL:**
```
https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback
```

---

## 📋 Requirements

1. **Cloudflare Tunnel must be running**
   - The tunnel starts automatically when the app starts
   - Check that it's running: Look for `[Cloudflare] ✅ Tunnel started:` in logs

2. **Cloudflare URL must be saved in config**
   - The app saves it automatically when tunnel starts
   - Config key: `cloudflareUrl`

3. **Azure Portal must accept the URL**
   - If Azure rejects it, use localhost fallback

---

## 🧪 Testing

1. **Start your app:**
   ```bash
   npm start
   ```

2. **Verify Cloudflare Tunnel is running:**
   - Check console logs for: `[Cloudflare] ✅ Tunnel started: https://...`
   - The URL should be saved automatically

3. **Update Azure Portal:**
   - Add the Cloudflare URL as redirect URI
   - Save and wait 3-5 minutes

4. **Test OAuth:**
   - Try connecting Outlook email in your app
   - OAuth should redirect to Cloudflare Tunnel URL
   - Your app will handle the callback

---

## 🔄 URL Changes

**Note:** Cloudflare Tunnel URLs change each time you restart the tunnel.

**If the URL changes:**
1. The app will automatically update the config
2. You need to update Azure Portal with the new URL
3. Wait 3-5 minutes for Azure to propagate

**To get the current URL:**
- Check console logs when app starts
- Or check the config file: `cloudflareUrl` key

---

## ✅ Checklist

- [ ] Cloudflare Tunnel is running
- [ ] Cloudflare URL is saved in app config
- [ ] Updated Azure Portal with Cloudflare redirect URI
- [ ] "Single-page application" is empty in Azure
- [ ] Saved changes in Azure Portal
- [ ] Waited 3-5 minutes for Azure to propagate
- [ ] Tested OAuth connection

---

## 🆘 Troubleshooting

### **Azure rejects the URL:**
- Use localhost fallback: `http://localhost:4000/api/oauth/callback`
- The app will automatically use localhost if Cloudflare URL fails

### **OAuth doesn't work:**
- Check that Cloudflare Tunnel is running
- Verify the URL in Azure matches exactly
- Check app logs for errors
- Try using localhost instead

### **URL changed:**
- Update Azure Portal with new URL
- Wait 3-5 minutes
- Try again

