# Complete Azure OAuth Fix Guide

## 🔴 Problem
Azure is treating your redirect URI as "Single-Page Application" instead of "Web" application.

## ✅ Solution - Step by Step

### **Step 1: Check Your Server Port**

1. Open your Electron app
2. Go to **Settings** → **System**
3. Note the **Server Port** number (e.g., 4000, 4001, etc.)
4. **IMPORTANT:** Use this exact port in Step 2

### **Step 2: Go to Azure Portal**

1. Go to: https://portal.azure.com
2. Sign in with your Microsoft account
3. Search for: **"App registrations"** (in top search bar)
4. Click: **"App registrations"**
5. Find and click: Your app with ID **649aa87d-4799-466b-ae15-078049518573**

### **Step 3: Go to Authentication Settings**

1. In the left sidebar, click **"Authentication"**
2. Scroll down to **"Platform configurations"** section

### **Step 4: REMOVE from Single-page Application (CRITICAL)**

1. Look for **"Single-page application"** section
2. **IMPORTANT:** Check if there are ANY redirect URIs listed here
3. If you see ANY redirect URIs (even if different):
   - Click on each redirect URI entry
   - Click **"Remove"** or trash icon
   - Click **"Yes"** to confirm
   - **Repeat for ALL redirect URIs in this section**
4. **VERIFY:** The "Single-page application" section should be:
   - ✅ Empty, OR
   - ✅ Show "No redirect URIs configured"

### **Step 5: ADD to Web Platform**

1. Under **"Platform configurations"**, look for **"Web"** section
2. If "Web" section doesn't exist:
   - Click **"+ Add a platform"** button
   - Select **"Web"** (NOT "Single-page application")
   - Click **"Configure"**

3. In the **"Redirect URIs"** field, add:
   ```
   http://localhost:[YOUR_PORT]/api/oauth/callback
   ```
   Replace `[YOUR_PORT]` with your actual server port from Step 1.
   
   **Examples:**
   - If port is 4000: `http://localhost:4000/api/oauth/callback`
   - If port is 4001: `http://localhost:4001/api/oauth/callback`
   - If port is 5000: `http://localhost:5000/api/oauth/callback`

4. Click **"Configure"** (if adding new platform) or **"Save"** (if editing existing)

### **Step 6: Save All Changes**

1. Click **"Save"** at the top of the Authentication page
2. Wait for the "Successfully saved" message

### **Step 7: Final Verification**

After saving, double-check:

- ✅ **"Web"** platform shows: `http://localhost:[YOUR_PORT]/api/oauth/callback`
- ✅ **"Single-page application"** is COMPLETELY EMPTY
- ✅ No redirect URIs exist under "Single-page application"
- ✅ Port number matches your server port exactly

### **Step 8: Wait for Azure Propagation**

- ⏰ **Wait 3-5 minutes** after saving
- Azure needs time to propagate changes across all servers
- Don't try connecting immediately

### **Step 9: Restart Your App**

1. Close your Electron app completely
2. Restart the app
3. Go to Settings → Integrations → Email & OAuth
4. Try connecting Outlook again

---

## 🎯 Common Mistakes to Avoid

❌ **Mistake 1:** Redirect URI in BOTH "Web" and "Single-page application"
- **Fix:** Remove from "Single-page application" completely

❌ **Mistake 2:** Wrong port number
- **Fix:** Check Settings → System → Server Port and use exact number

❌ **Mistake 3:** Typo in redirect URI
- **Fix:** Must be exactly: `http://localhost:[PORT]/api/oauth/callback`
- No trailing slash
- All lowercase
- Exact spelling

❌ **Mistake 4:** Not saving changes
- **Fix:** Click "Save" at the top of the page

❌ **Mistake 5:** Trying immediately after saving
- **Fix:** Wait 3-5 minutes for Azure to propagate

---

## 📋 Quick Checklist

Before trying to connect:

- [ ] Checked server port in Settings → System
- [ ] Removed ALL redirect URIs from "Single-page application"
- [ ] Added redirect URI to "Web" platform with correct port
- [ ] Verified redirect URI is ONLY in "Web", not in "Single-page application"
- [ ] Saved all changes in Azure Portal
- [ ] Waited 3-5 minutes for Azure propagation
- [ ] Restarted Electron app
- [ ] Tried Outlook connection again

---

## 🔍 How to Verify Your Configuration is Correct

### **Correct Configuration:**
```
Platform: Web
Redirect URI: http://localhost:[YOUR_PORT]/api/oauth/callback
Single-page application: EMPTY (no redirect URIs)
```

### **Wrong Configuration:**
```
Platform: Single-page application
Redirect URI: http://localhost:[PORT]/api/oauth/callback
❌ This will cause the error
```

OR

```
Platform: Web AND Single-page application
Both have redirect URI
❌ This will also cause the error (Azure treats as SPA)
```

---

## 🆘 Still Not Working?

### **Check 1: Verify Exact Redirect URI**
1. Go to Settings → System → Note the Server Port
2. The redirect URI in Azure must be EXACTLY:
   ```
   http://localhost:[EXACT_PORT]/api/oauth/callback
   ```
3. No trailing slash, all lowercase

### **Check 2: Clear Browser Cache**
1. Close Azure Portal
2. Clear browser cache or use incognito/private window
3. Log back into Azure Portal
4. Check configuration again

### **Check 3: Check App Registration ID**
Make sure you're editing the correct app:
- App ID: **649aa87d-4799-466b-ae15-078049518573**
- Check "Application (client) ID" in Azure matches

### **Check 4: Try Different Browser**
Sometimes browser cache causes issues:
- Try accessing Azure Portal in incognito/private window
- Or use a different browser

### **Check 5: Wait Longer**
Azure propagation can be slow:
- Wait 5-10 minutes after saving
- Try connecting again

---

## 📞 Need More Help?

If none of these steps work, provide:
1. Screenshot of Azure Portal → Authentication → Platform configurations
2. Your server port (from Settings → System)
3. The exact error message you're seeing














