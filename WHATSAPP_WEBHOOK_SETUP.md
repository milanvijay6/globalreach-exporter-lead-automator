# WhatsApp Webhook Setup Guide

## 📋 What You Need to Configure

In Meta for Developers, you need to set up:
1. **Callback URL** - Where Meta will send webhook notifications
2. **Verify Token** - A secret token to verify webhook requests

---

## 🔍 Step-by-Step Setup

### **Step 1: Check Your Current App Settings**

First, find out what your app is configured with:

1. **Open your app**
2. Go to **Settings → Integrations → WhatsApp**
3. Look for **"Webhook Verify Token"** - note this value
4. Check **Settings → System** for **"Server Port"** (usually 4000 or 4001)

---

### **Step 2: Determine Your Webhook URL**

Your app needs a public URL that Meta can reach. You have 3 options:

#### **Option A: Using a Tunnel (For Local Development)**

If your app is running on your computer:

1. **Use ngrok or similar tunnel service:**
   - Install ngrok: https://ngrok.com/download
   - Run: `ngrok http 4000` (replace 4000 with your server port)
   - Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
   - Your webhook URL will be: `https://abc123.ngrok.io/webhooks/whatsapp`

2. **Or use another tunnel service:**
   - Cloudflare Tunnel, localtunnel, etc.

#### **Option B: Production URL (Recommended for Production)**

If you've deployed your app to a server:

- Your webhook URL will be: `https://your-domain.com/webhooks/whatsapp`
- Make sure your server is publicly accessible

#### **Option C: Local Testing (Limited)**

⚠️ **Important:** Meta requires HTTPS and a public URL. `localhost` won't work directly.

If your app is unpublished, you can only receive test webhooks from the dashboard.

---

### **Step 3: Configure in Meta for Developers**

1. **Go to Meta for Developers:**
   - Visit: https://developers.facebook.com/apps
   - Select your WhatsApp Business App

2. **Navigate to Webhook Configuration:**
   - Click **"WhatsApp"** in left sidebar
   - Go to **"Configuration"** tab
   - Scroll to **"Webhook"** section

3. **Enter Callback URL:**
   - In the **"Callback URL"** field, enter:
     ```
     https://your-tunnel-url.ngrok.io/webhooks/whatsapp
     ```
     OR
     ```
     https://your-domain.com/webhooks/whatsapp
     ```
   - **Important:** Must be HTTPS and publicly accessible
   - **Must end with:** `/webhooks/whatsapp`

4. **Enter Verify Token:**
   - In the **"Verify token"** field, enter the token from your app settings
   - Default token is: `globalreach_secret_token`
   - Or whatever you configured in Settings → Integrations → WhatsApp
   - **Must match exactly** what you entered in the app

5. **Click "Verify and save"**

6. **Subscribe to Webhook Fields:**
   After saving, click **"Manage"** next to "Webhook fields"
   - Check these fields:
     - ✅ `messages` - Receive incoming messages
     - ✅ `message_status` - Track message delivery status
   
   Click **"Done"** to save

---

## 🔧 Detailed Configuration

### **Verify Token**

Your verify token should match what's in your app:

**Default token:** `globalreach_secret_token`

**To find your token:**
- Settings → Integrations → WhatsApp → Look for "Webhook Verify Token"

**To change your token:**
- Enter a new token in Settings → Integrations → WhatsApp
- Use the same token in Meta for Developers

**Example tokens (use something secure):**
- `my_secure_token_12345`
- `whatsapp_webhook_secret_2024`
- `globalreach_verify_token`

---

### **Callback URL Format**

The callback URL must be exactly:
```
https://your-domain.com/webhooks/whatsapp
```

**Important points:**
- ✅ Must start with `https://` (not `http://`)
- ✅ Must be publicly accessible (not localhost)
- ✅ Must end with `/webhooks/whatsapp`
- ✅ No trailing slash

**Examples:**
- ✅ `https://abc123.ngrok.io/webhooks/whatsapp`
- ✅ `https://myapp.example.com/webhooks/whatsapp`
- ❌ `http://localhost:4000/webhooks/whatsapp` (not HTTPS, not public)
- ❌ `https://abc123.ngrok.io/webhooks/whatsapp/` (trailing slash)

---

## 🧪 Testing Your Webhook

### **Step 1: Verify Webhook**

1. After entering Callback URL and Verify Token, click **"Verify and save"**
2. Meta will send a GET request to your webhook URL
3. If verification succeeds, you'll see a green checkmark ✅
4. If it fails, check:
   - ✅ URL is correct and publicly accessible
   - ✅ Verify token matches your app settings
   - ✅ Your app server is running
   - ✅ Firewall allows incoming connections

### **Step 2: Test Webhook (If App is Unpublished)**

If your app is still in development (unpublished):

1. In Meta → WhatsApp → Configuration → Webhook
2. Click **"Test"** button
3. Select a webhook event to test
4. This will send a test webhook to your callback URL
5. Check your app logs to see if it received the webhook

### **Step 3: Send Test Message**

1. Send a WhatsApp message to your business number
2. Check your app logs to see if the webhook was received
3. The message should appear in your app's chat interface

---

## 🚨 Troubleshooting

### **Issue: "Webhook verification failed"**

**Possible causes:**
- Verify token doesn't match
- Server is not accessible
- URL is incorrect

**Fix:**
1. Check verify token in app settings
2. Verify token in Meta matches exactly
3. Test if your webhook URL is accessible: Open `https://your-url/webhooks/whatsapp` in browser (should show 403 or 400, not connection error)
4. Make sure your app server is running

### **Issue: "Callback URL not accessible"**

**Fix:**
- URL must be HTTPS (not HTTP)
- URL must be publicly accessible (not localhost)
- Check firewall settings
- Verify tunnel/domain is working

### **Issue: "No webhooks received"**

**Check:**
1. Webhook fields are subscribed (messages, message_status)
2. App is published (or testing with dashboard test button)
3. Phone number is connected and verified
4. Webhook URL is verified (green checkmark)

---

## 📝 Quick Reference

### **For Local Development (Using ngrok):**

1. **Start your app:**
   ```
   npm start
   ```
   Note the server port (usually 4000)

2. **Start ngrok:**
   ```
   ngrok http 4000
   ```
   Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

3. **Configure in Meta:**
   - Callback URL: `https://abc123.ngrok.io/webhooks/whatsapp`
   - Verify Token: `globalreach_secret_token` (or your custom token)

4. **Click "Verify and save"**

### **For Production:**

1. **Deploy your app** to a server with a public domain
2. **Configure in Meta:**
   - Callback URL: `https://your-domain.com/webhooks/whatsapp`
   - Verify Token: Your secure token

3. **Click "Verify and save"**

---

## ✅ Checklist

Before saving in Meta, verify:

- [ ] Callback URL is HTTPS (starts with `https://`)
- [ ] Callback URL is publicly accessible
- [ ] Callback URL ends with `/webhooks/whatsapp`
- [ ] Verify Token matches your app settings exactly
- [ ] Your app server is running
- [ ] Firewall allows incoming connections
- [ ] You've subscribed to `messages` and `message_status` fields

---

## 💡 Important Notes

1. **HTTPS Required:** Meta requires HTTPS for webhooks. Use a tunnel or deploy to HTTPS server.

2. **Token Security:** Use a secure, random token. Don't use the default `globalreach_secret_token` in production.

3. **URL Changes:** If you change your webhook URL or token, you need to update both in Meta and in your app.

4. **Testing:** Unpublished apps can only receive test webhooks from the dashboard. Publish your app to receive real webhooks.

5. **Tunnel URLs Change:** ngrok free URLs change each time. You'll need to update the webhook URL in Meta if you restart ngrok.

---

**Need help?** Check the error message in Meta - it usually tells you exactly what's wrong!










