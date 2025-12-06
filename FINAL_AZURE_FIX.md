# FINAL AZURE FIX - Exact Steps

## 🎯 The Problem
Your redirect URI `http://localhost:4000/api/oauth/callback` exists in BOTH "Single-page application" AND "Web" platforms. Azure treats it as SPA when it exists in both.

---

## ✅ THE FIX (Do This Now)

### **Step 1: Open Azure Portal**
1. Go to: https://portal.azure.com
2. App registrations → Your app (**649aa87d-4799-466b-ae15-078049518573**)
3. Click **"Authentication"**

---

### **Step 2: CHECK "Single-page application" Section**

**Look at "Single-page application" section:**

**Do you see `http://localhost:4000/api/oauth/callback` listed there?**

- ✅ **If NO** → Good! Continue to Step 3
- ❌ **If YES** → This is the problem! Remove it:
  1. Click on the redirect URI
  2. Click **"Remove"**
  3. Click **"Yes"** to confirm
  4. Remove ALL redirect URIs from this section

---

### **Step 3: Verify "Web" Section**

**Look at "Web" section:**

- ✅ Should show: `http://localhost:4000/api/oauth/callback`
- ❌ If empty or missing → Add it (see Step 4)

---

### **Step 4: If "Web" is Empty, Add Redirect URI**

1. Click **"+ Add a platform"**
2. Select **"Web"**
3. Enter: `http://localhost:4000/api/oauth/callback`
4. Click **"Configure"**

---

### **Step 5: Save and Wait**

1. Click **"Save"** at the top
2. **Wait 10 minutes** (Azure needs time to propagate)
3. Refresh the page (F5)

---

### **Step 6: Final Check**

After waiting, verify:

**"Single-page application" section:**
- [ ] EMPTY (no redirect URIs)
- [ ] Does NOT contain `http://localhost:4000/api/oauth/callback`

**"Web" section:**
- [ ] Contains: `http://localhost:4000/api/oauth/callback`
- [ ] This is the ONLY place this URI exists

---

## ⚠️ CRITICAL RULE

**The redirect URI `http://localhost:4000/api/oauth/callback` must exist ONLY in "Web" platform.**

**If it exists in BOTH "Web" AND "Single-page application", Azure will treat it as SPA!**

---

## 🚨 If It's Still Not Working

1. **Check App Manifest:**
   - Azure Portal → Your app → "Manifest"
   - Look for `"spa"` section - DELETE it if it exists
   - Ensure `"web"` section exists with your redirect URI

2. **Clear Browser Cache:**
   - Log out of Azure Portal
   - Clear cache (Ctrl+Shift+Delete)
   - Open Azure Portal in incognito mode
   - Check configuration again

3. **Create New App Registration:**
   - Create brand new app
   - Configure as "Web" from the start
   - Use new Client ID and Secret

---

## 📋 Quick Checklist

- [ ] "Single-page application" section is EMPTY
- [ ] "Web" section has: `http://localhost:4000/api/oauth/callback`
- [ ] Saved changes in Azure Portal
- [ ] Waited 10 minutes after saving
- [ ] Restarted your Electron app
- [ ] Tried connecting Outlook again

---

The error message will now guide you through the exact steps. Follow it carefully!














