# Azure Redirect URI - Updated to localhost

## ✅ New Azure Redirect URI

**Use this URL in Azure Portal:**
```
http://localhost:4000/api/oauth/callback
```

---

## 🔧 How to Update in Azure Portal

### **Step 1: Go to Azure Portal**
1. Visit: https://portal.azure.com
2. Sign in with your Microsoft account
3. Search for **"App registrations"** in the top search bar
4. Click on **"App registrations"**
5. Select your app registration

### **Step 2: Go to Authentication**
1. In the left sidebar, click **"Authentication"**
2. Scroll down to **"Platform configurations"** section

### **Step 3: Remove Old URL (if exists)**
If you see the Cloudflare Tunnel URL:
- `https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback`

**Remove it:**
1. Click on the redirect URI
2. Click **"Remove"** button
3. Confirm removal

### **Step 4: Update "Web" Platform**

**Check "Web" section:**
- If it shows: `http://localhost:4000/api/oauth/callback` → ✅ Already correct!
- If it shows a different URL → Update it (see below)
- If it's empty → Add it (see below)

**To Update/Add:**
1. If "Web" platform doesn't exist, click **"+ Add a platform"** → Select **"Web"**
2. If "Web" platform exists, click on it to edit
3. In **"Redirect URIs"** field, enter EXACTLY:
   ```
   http://localhost:4000/api/oauth/callback
   ```
4. Click **"Configure"** (if adding new) or **"Save"** (if editing)

### **Step 5: Verify "Single-page application" is Empty**
**Check "Single-page application" section:**
- ✅ Should be **EMPTY** or show "No redirect URIs configured"
- ❌ Should **NOT** contain any redirect URIs

**If it contains redirect URIs:**
1. Click on each redirect URI
2. Click **"Remove"**
3. Confirm removal
4. Remove ALL redirect URIs from this section

### **Step 6: Save and Wait**
1. Click **"Save"** at the top of the page
2. **Wait 3-5 minutes** for Azure to propagate changes
3. Refresh the page (F5) to verify

---

## ✅ Final Verification

After waiting, verify:

**"Web" platform:**
- [ ] Contains: `http://localhost:4000/api/oauth/callback`
- [ ] This is the ONLY redirect URI in "Web"

**"Single-page application" platform:**
- [ ] Is EMPTY (no redirect URIs)
- [ ] Does NOT contain any redirect URIs

---

## 📋 Important Notes

1. **Use localhost, not Cloudflare URL:**
   - ✅ `http://localhost:4000/api/oauth/callback` (correct)
   - ❌ `https://xxxxx.trycloudflare.com/api/oauth/callback` (wrong for Azure)

2. **Why localhost?**
   - Azure accepts `localhost` redirect URIs for development
   - Your app already uses localhost for OAuth (configured in code)
   - Cloudflare Tunnel is only needed for WhatsApp webhooks (public URL)

3. **Both can work together:**
   - **Azure OAuth:** Uses `localhost` (this URL)
   - **WhatsApp Webhooks:** Uses Cloudflare Tunnel URL (keep tunnel running)

4. **Exact format required:**
   - Use `http://` (not `https://`) for localhost
   - Use `localhost` (not `127.0.0.1`)
   - Port `4000` (or your actual server port)
   - Path `/api/oauth/callback` (exact)
   - No trailing slash

---

## 🧪 Test After Update

1. **Wait 3-5 minutes** after saving in Azure
2. **Start your app:** `npm start`
3. **Try connecting Outlook email** in your app
4. OAuth should redirect to `localhost:4000/api/oauth/callback`
5. Your app will handle the callback automatically

---

## 🆘 If It Still Doesn't Work

1. **Check your app is running on port 4000:**
   - Go to Settings → System
   - Verify Server Port is 4000

2. **Clear browser cache:**
   - Azure Portal might show cached configuration
   - Try incognito/private mode

3. **Wait longer:**
   - Azure can take up to 10 minutes to propagate changes
   - Be patient and try again

4. **Verify the exact URL:**
   - Must be exactly: `http://localhost:4000/api/oauth/callback`
   - No typos, no extra characters, no trailing slash

