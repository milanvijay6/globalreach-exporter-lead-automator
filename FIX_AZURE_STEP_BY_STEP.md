# Fix Azure Configuration - Step by Step (With Screenshots Guide)

## 🎯 Your Problem
Azure Portal shows "Web" is selected, but you're still getting "Single-Page Application" error. This means the redirect URI exists in BOTH places.

---

## ✅ SOLUTION: Remove from SPA FIRST, Then Add to Web

### **STEP 1: Open Azure Portal**

1. Go to: https://portal.azure.com
2. Sign in
3. Search: **"App registrations"**
4. Click: **"App registrations"**
5. Click: Your app (**649aa87d-4799-466b-ae15-078049518573**)

---

### **STEP 2: Go to Authentication**

1. In left sidebar, click **"Authentication"**
2. Scroll down to **"Platform configurations"** section
3. You should see TWO sections: "Web" and "Single-page application"

---

### **STEP 3: REMOVE from "Single-page application" FIRST (CRITICAL)**

**This is the most important step!**

1. Look at **"Single-page application"** section
2. Check if there's ANY redirect URI listed there
3. **If you see ANY redirect URI (even if it's different):**
   - Click on the redirect URI entry (or the pencil/edit icon next to it)
   - Click **"Remove"** button
   - Click **"Yes"** to confirm
   - **Repeat this for EVERY redirect URI** in "Single-page application"
4. **If the section is empty but still exists:**
   - Look for **"Delete platform"** or **"Remove platform"** option
   - Click it to completely remove the SPA platform

5. **VERIFY:** "Single-page application" section should be:
   - Completely empty, OR
   - Show "No redirect URIs configured", OR
   - The entire section should be removed

6. **Click "Save"** at the top of the page
7. **Wait 5 minutes**

---

### **STEP 4: Check "Web" Platform**

After waiting 5 minutes:

1. Refresh the page (F5)
2. Scroll to **"Platform configurations"** again
3. Look at **"Web"** section:

   **If "Web" section EXISTS:**
   - Check what redirect URIs are listed
   - If it has: `http://localhost:4000/api/oauth/callback` - GOOD ✅
   - If it has something else or nothing - continue to Step 5

   **If "Web" section DOES NOT EXIST:**
   - Continue to Step 5 to add it

---

### **STEP 5: Add/Update "Web" Platform**

1. Under "Platform configurations", click **"+ Add a platform"**
2. Select **"Web"** (NOT "Single-page application")
3. In the **"Redirect URIs"** text box, enter EXACTLY:
   ```
   http://localhost:4000/api/oauth/callback
   ```
   - All lowercase
   - No trailing slash
   - Use your actual server port (check Settings → System)

4. Click **"Configure"**
5. Click **"Save"** at the top
6. **Wait 5 minutes**

---

### **STEP 6: Final Verification (CRITICAL)**

After waiting, verify the configuration:

1. **Refresh Azure Portal** (F5 or Ctrl+F5)
2. Go to **"Authentication"**
3. Scroll to **"Platform configurations"**

**Check "Single-page application" section:**
- ✅ Should be **EMPTY** or show "No redirect URIs configured"
- ✅ Should **NOT** contain `http://localhost:4000/api/oauth/callback`
- ✅ Should **NOT** contain ANY redirect URIs

**Check "Web" section:**
- ✅ Should contain: `http://localhost:4000/api/oauth/callback`
- ✅ Should be the ONLY place this URI exists

**❌ If you see the redirect URI in BOTH sections, Azure will treat it as SPA!**

---

## 🔍 What to Check If Still Not Working

### **Check 1: App Manifest**

Sometimes the platform is hardcoded in the manifest:

1. In Azure Portal → Your app → Click **"Manifest"** (left sidebar)
2. Look for a section called `"spa"`:
   ```json
   "spa": {
     "redirectUris": [...]
   }
   ```
3. **If "spa" section exists:**
   - Click **"Edit"**
   - DELETE the entire `"spa"` section
   - OR set `"redirectUris"` to empty array: `[]`
4. Look for `"web"` section - should exist with your redirect URI
5. Click **"Save"**
6. Wait 5 minutes

---

### **Check 2: Use Incognito Mode**

Azure Portal might be showing cached configuration:

1. Close Azure Portal
2. Open browser in **incognito/private mode**
3. Go to Azure Portal again
4. Log in
5. Check "Authentication" → Platform configurations
6. See if it shows differently

---

### **Check 3: Verify Redirect URI Format**

The redirect URI MUST be EXACTLY:
```
http://localhost:4000/api/oauth/callback
```

Common mistakes:
- ❌ `http://localhost:4000/api/oauth/callback/` (trailing slash)
- ❌ `https://localhost:4000/api/oauth/callback` (https)
- ❌ `http://127.0.0.1:4000/api/oauth/callback` (127.0.0.1 instead of localhost)
- ❌ Wrong port number

---

## 🎯 Quick Diagnostic

Answer these questions:

1. **In Azure Portal → Authentication → "Single-page application" section:**
   - [ ] Is it EMPTY? (Good!)
   - [ ] Does it show redirect URIs? (BAD - remove them!)

2. **In Azure Portal → Authentication → "Web" section:**
   - [ ] Does it show `http://localhost:4000/api/oauth/callback`? (Good!)
   - [ ] Is it empty? (Need to add it)

3. **Are there ANY redirect URIs in "Single-page application"?**
   - [ ] NO (Good!)
   - [ ] YES (Remove them!)

---

## 💡 Most Likely Issue

**The redirect URI exists in BOTH "Web" AND "Single-page application".**

**Fix:**
1. Remove it from "Single-page application" FIRST
2. Then verify it's only in "Web"
3. Save and wait 5-10 minutes

---

## 🆘 Still Not Working? 

Try this nuclear option:

1. **Delete ALL redirect URIs** from both platforms
2. **Wait 10 minutes**
3. **Add redirect URI ONLY to "Web"**
4. **Wait 10 minutes**
5. **Check in incognito mode**
6. Try connecting again

If STILL not working after all this, the issue might be:
- Client Secret is wrong
- Client ID is wrong
- Or we need to create a new app registration





