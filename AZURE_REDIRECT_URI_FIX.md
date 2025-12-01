# Azure Redirect URI Error Fix

## ❌ Error You're Seeing
- "Wildcard characters, HTTP scheme not allowed"
- "Must be a valid URL in email"

## 🔍 The Problem

Azure AD may not accept `.trycloudflare.com` domains for redirect URIs due to:
1. Domain restrictions/whitelisting
2. Security policies
3. Domain validation requirements

## ✅ Solution Options

### **Option 1: Use localhost (Recommended for Development)**

For local development, use `localhost` instead of the Cloudflare Tunnel URL:

**Redirect URI:**
```
http://localhost:4000/api/oauth/callback
```

**Steps:**
1. Go to Azure Portal → App registrations → Your app
2. Click **"Authentication"**
3. Under **"Platform configurations"** → **"Web"**:
   - Remove any Cloudflare Tunnel URLs
   - Add: `http://localhost:4000/api/oauth/callback`
4. Click **"Save"**

**Note:** This works for local development. The OAuth flow will redirect to localhost, which your app can handle.

---

### **Option 2: Use Cloudflare Tunnel with localhost fallback**

Your app can handle both:
- Cloudflare Tunnel URL for webhooks (WhatsApp)
- localhost for OAuth callbacks (Azure)

**Configuration:**
- **Azure Redirect URI:** `http://localhost:4000/api/oauth/callback`
- **WhatsApp Webhook:** `https://xxxxx.trycloudflare.com/webhooks/whatsapp`

This way:
- WhatsApp webhooks come through Cloudflare Tunnel (public URL needed)
- OAuth callbacks go to localhost (Azure accepts this)

---

### **Option 3: Verify URL Format**

If you want to try the Cloudflare URL again, ensure:

1. **Exact format:**
   ```
   https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback
   ```

2. **No trailing slash:**
   - ✅ `https://...trycloudflare.com/api/oauth/callback`
   - ❌ `https://...trycloudflare.com/api/oauth/callback/`

3. **HTTPS (not HTTP):**
   - ✅ `https://...`
   - ❌ `http://...`

4. **No query parameters:**
   - ✅ `https://...trycloudflare.com/api/oauth/callback`
   - ❌ `https://...trycloudflare.com/api/oauth/callback?param=value`

---

### **Option 4: Use a Custom Domain (Production)**

For production, you'll need:
1. A custom domain (e.g., `yourapp.com`)
2. Point it to your server
3. Use SSL certificate
4. Use: `https://yourapp.com/api/oauth/callback`

---

## 🎯 Recommended Setup

**For Development:**
- **Azure Redirect URI:** `http://localhost:4000/api/oauth/callback`
- **WhatsApp Webhook:** `https://xxxxx.trycloudflare.com/webhooks/whatsapp`

**Why this works:**
- Azure accepts `localhost` redirect URIs
- WhatsApp needs a public HTTPS URL (Cloudflare Tunnel provides this)
- Your app handles both endpoints

---

## 📝 Step-by-Step Fix

### **Step 1: Update Azure Portal**

1. Go to: https://portal.azure.com
2. App registrations → Your app
3. Click **"Authentication"**
4. Under **"Platform configurations"** → **"Web"**:
   - Remove: `https://wheel-baking-survivors-budgets.trycloudflare.com/api/oauth/callback`
   - Add: `http://localhost:4000/api/oauth/callback`
5. Click **"Save"**
6. Wait 3-5 minutes for changes to propagate

### **Step 2: Verify Your App Configuration**

Your app should already be configured to accept OAuth callbacks at:
- `http://localhost:4000/api/oauth/callback`

This endpoint is already set up in your code.

### **Step 3: Test**

1. Start your app: `npm start`
2. Try connecting Outlook email
3. OAuth should redirect to `localhost:4000/api/oauth/callback`
4. Your app will handle it

---

## ⚠️ Important Notes

1. **localhost works for OAuth:** Azure allows `localhost` redirect URIs for development
2. **Cloudflare Tunnel still needed:** Keep it running for WhatsApp webhooks
3. **Both can coexist:** Your app can handle:
   - OAuth callbacks on localhost
   - Webhooks on Cloudflare Tunnel URL

---

## 🔧 If localhost Doesn't Work

If Azure still rejects `localhost`:

1. **Check your app registration type:**
   - Personal Microsoft accounts: Should accept localhost
   - Organizational accounts: May have restrictions

2. **Try these variations:**
   - `http://localhost:4000/api/oauth/callback`
   - `http://127.0.0.1:4000/api/oauth/callback` (less common)

3. **Check Azure AD tenant settings:**
   - Some organizations restrict redirect URIs
   - Contact your Azure AD admin if needed

---

## ✅ Quick Checklist

- [ ] Removed Cloudflare Tunnel URL from Azure
- [ ] Added `http://localhost:4000/api/oauth/callback` to Azure "Web" platform
- [ ] Saved changes in Azure Portal
- [ ] Waited 3-5 minutes
- [ ] App is running on port 4000
- [ ] Cloudflare Tunnel is running (for WhatsApp webhooks)
- [ ] Tried connecting Outlook email again

