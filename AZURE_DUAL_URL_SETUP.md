# Azure OAuth - Dual URL Setup (Cloudflare + localhost)

## ✅ Configuration

The app now uses **both URLs**:
1. **Primary:** Cloudflare Tunnel URL (when available)
2. **Backup:** localhost (always available)

### **URLs to Add in Azure Portal:**

1. **Cloudflare Tunnel URL:**
   ```
   https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback
   ```

2. **localhost (Backup):**
   ```
   http://localhost:4000/api/oauth/callback
   ```

---

## 🔧 Update Azure Portal - Add Both URLs

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
2. In **"Redirect URIs"** field, add BOTH URLs (one per line or separate entries):
   ```
   https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback
   http://localhost:4000/api/oauth/callback
   ```
3. Click **"Save"**

**If "Web" platform doesn't exist:**
1. Click **"+ Add a platform"**
2. Select **"Web"** (NOT "Single-page application")
3. In **"Redirect URIs"** field, add BOTH URLs:
   ```
   https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback
   http://localhost:4000/api/oauth/callback
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

## 🔄 How It Works

The app automatically:
1. **Checks for Cloudflare Tunnel URL** in config
2. **Uses Cloudflare URL first** if available: `https://xxxxx.trycloudflare.com/api/oauth/callback`
3. **Falls back to localhost** if Cloudflare URL is not available: `http://localhost:4000/api/oauth/callback`

### **Priority:**
- ✅ **Primary:** Cloudflare Tunnel URL (when tunnel is running)
- ✅ **Backup:** localhost (always works)

---

## ⚠️ Important Notes

### **If Azure Rejects Cloudflare URL:**

If Azure shows an error for the Cloudflare URL:
- **Don't worry!** The app will automatically use localhost
- Keep both URLs in Azure if possible
- If Azure only accepts localhost, that's fine - the app will use it

### **URL Changes:**

**Cloudflare Tunnel URLs change** each time you restart the tunnel:
- The app automatically updates the config
- You may need to update Azure Portal with the new URL
- localhost URL never changes

**To get current Cloudflare URL:**
- Check console logs when app starts
- Look for: `[Cloudflare] ✅ Tunnel started: https://...`

---

## 📋 Requirements

1. **Cloudflare Tunnel should be running** (for primary URL)
   - Starts automatically when app starts
   - Check logs: `[Cloudflare] ✅ Tunnel started:`

2. **Both URLs in Azure Portal:**
   - Cloudflare URL: `https://xxxxx.trycloudflare.com/api/oauth/callback`
   - localhost URL: `http://localhost:4000/api/oauth/callback`

3. **App automatically selects the best URL:**
   - Uses Cloudflare if available
   - Falls back to localhost if needed

---

## 🧪 Testing

1. **Start your app:**
   ```bash
   npm start
   ```

2. **Verify Cloudflare Tunnel is running:**
   - Check console logs for: `[Cloudflare] ✅ Tunnel started: https://...`
   - The URL is saved automatically

3. **Update Azure Portal:**
   - Add both redirect URIs
   - Save and wait 3-5 minutes

4. **Test OAuth:**
   - Try connecting Outlook email
   - App will use Cloudflare URL if available
   - Falls back to localhost if Cloudflare is not available

---

## ✅ Checklist

- [ ] Cloudflare Tunnel is running (optional, but recommended)
- [ ] Added Cloudflare URL to Azure Portal
- [ ] Added localhost URL to Azure Portal
- [ ] Both URLs are in "Web" platform (not "Single-page application")
- [ ] "Single-page application" is empty
- [ ] Saved changes in Azure Portal
- [ ] Waited 3-5 minutes for Azure to propagate
- [ ] Tested OAuth connection

---

## 🆘 Troubleshooting

### **Azure rejects Cloudflare URL:**
- ✅ That's okay! The app will use localhost automatically
- Keep localhost URL in Azure
- OAuth will still work

### **OAuth doesn't work:**
- Check that at least localhost URL is in Azure
- Verify Cloudflare Tunnel is running (if using Cloudflare)
- Check app logs for errors
- Try using localhost only if needed

### **Cloudflare URL changed:**
- Update Azure Portal with new Cloudflare URL
- Keep localhost URL as backup
- Wait 3-5 minutes
- Try again

---

## 💡 Benefits of Dual URL Setup

1. **Reliability:** If Cloudflare URL fails, localhost works
2. **Flexibility:** Works with or without Cloudflare Tunnel
3. **Development:** localhost always works for local testing
4. **Production:** Cloudflare URL works for public access

