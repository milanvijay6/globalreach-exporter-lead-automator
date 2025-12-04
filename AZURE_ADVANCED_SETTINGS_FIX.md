# Fix Azure Advanced Settings

## 🚨 Problem Found

Your Azure app has **"Allow public client flows"** set to **"Yes"**.

This setting tells Azure your app is a "public client" (like a mobile app or SPA), which doesn't match your "Web" application configuration.

---

## ✅ The Fix

### **Step 1: Disable Public Client Flows**

1. In Azure Portal → Your app → **"Authentication"** section
2. Scroll down to **"Advanced settings"**
3. Find **"Allow public client flows"**
4. **Change it from "Yes" to "No"**
5. Click **"Save"** at the top
6. **Wait 5-10 minutes** for Azure to propagate the change

---

## 🔍 Why This Matters

**"Allow public client flows" = "Yes":**
- ❌ Azure treats your app as a public client (SPA/mobile app)
- ❌ Doesn't match "Web" application type
- ❌ Can cause "Single-Page Application" errors

**"Allow public client flows" = "No":**
- ✅ Azure treats your app as a confidential client (Web app)
- ✅ Matches your "Web" platform configuration
- ✅ Allows server-side token exchange with client secret

---

## 📋 Complete Configuration Checklist

After changing this setting, verify:

### ✅ Platform Configurations:
- [ ] "Single-page application" section is EMPTY
- [ ] "Web" section has redirect URIs:
  - [ ] `http://localhost:4000/api/oauth/callback`
  - [ ] `http://localhost:4001/api/oauth/callback`

### ✅ Advanced Settings:
- [ ] "Allow public client flows" = **"No"**

### ✅ Certificates & Secrets:
- [ ] Client secret exists and is valid
- [ ] You have the secret VALUE (not just the ID)

---

## 🎯 After Making the Change

1. **Change "Allow public client flows" to "No"**
2. **Click "Save"**
3. **Wait 10 minutes** (Azure needs time to propagate)
4. **Restart your Electron app**
5. **Try connecting Outlook again**

---

## ⚠️ Important Note

Your Electron app is a **confidential client** because:
- ✅ It has a client secret
- ✅ Token exchange happens on the server (Express backend)
- ✅ The secret is stored securely (not exposed in browser)

This means "Allow public client flows" should be **"No"**.

---

## 🔄 Alternative: If You Must Keep Public Client Flows

If you need "Allow public client flows" = "Yes" for some reason, then:
1. Remove redirect URIs from "Web" platform
2. Add them to "Single-page application" instead
3. Remove client secret (use PKCE flow)

**But for your current setup, set it to "No"!**











