# WhatsApp Webhook - Quick Setup Guide

## 🎯 What to Enter in Meta for Developers

### **Step 1: Find Your Values**

**In your app:**
1. Open your app
2. Go to **Settings → Integrations → WhatsApp**
3. Find **"Webhook Verify Token"** (or note what you'll set it to)

**Default token:** `globalreach_secret_token`

---

### **Step 2: Set Up Webhook URL**

**You need a public HTTPS URL.** Choose one:

#### **Option A: Using ngrok (Local Development)**

1. Install ngrok: https://ngrok.com/download
2. Start your app: `npm start`
3. In another terminal, run: `ngrok http 4000` (or your server port)
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

#### **Option B: Your Production Domain**

If you have a deployed server:
- Use: `https://your-domain.com`

---

### **Step 3: Enter in Meta for Developers**

Go to: https://developers.facebook.com/apps → Your App → WhatsApp → Configuration

**Enter these values:**

#### **Callback URL:**
```
https://your-ngrok-url.ngrok.io/webhooks/whatsapp
```
OR
```
https://your-domain.com/webhooks/whatsapp
```

**⚠️ Important:**
- Must start with `https://`
- Must end with `/webhooks/whatsapp`
- Must be publicly accessible (not localhost)

#### **Verify Token:**
```
globalreach_secret_token
```
OR whatever token you configured in your app settings.

**⚠️ Important:**
- Must match exactly what's in your app
- Case-sensitive
- No spaces at the beginning or end

---

### **Step 4: Click "Verify and save"**

Meta will test your webhook. If successful, you'll see a green checkmark ✅

---

### **Step 5: Subscribe to Fields**

After verification, click **"Manage"** next to Webhook fields:
- ✅ Check `messages`
- ✅ Check `message_status`
- Click **"Done"**

---

## 📋 Example Values

### **Using ngrok (Local):**
```
Callback URL: https://abc123.ngrok.io/webhooks/whatsapp
Verify Token: globalreach_secret_token
```

### **Using Production Domain:**
```
Callback URL: https://myapp.example.com/webhooks/whatsapp
Verify Token: globalreach_secret_token
```

---

## ✅ Quick Checklist

- [ ] Webhook URL is HTTPS
- [ ] Webhook URL ends with `/webhooks/whatsapp`
- [ ] Webhook URL is publicly accessible
- [ ] Verify Token matches your app exactly
- [ ] Clicked "Verify and save"
- [ ] Subscribed to `messages` and `message_status` fields

---

## 🚨 Common Mistakes

❌ Using `http://` instead of `https://`
❌ Using `localhost` instead of public URL
❌ Missing `/webhooks/whatsapp` at the end
❌ Verify token doesn't match app settings
❌ Trailing slash in URL (`/webhooks/whatsapp/`)

✅ Use HTTPS
✅ Use public URL (ngrok or domain)
✅ End with `/webhooks/whatsapp` (no trailing slash)
✅ Token matches exactly
✅ Server is running

---

## 🔧 If Verification Fails

1. **Check your app is running**
2. **Test URL in browser:** Open `https://your-url/webhooks/whatsapp` - should show error (403/400), not connection error
3. **Check verify token** matches in both places
4. **Check firewall** allows incoming connections
5. **Check ngrok** is running and URL is correct

---

**For detailed setup instructions, see:** `WHATSAPP_WEBHOOK_SETUP.md`



















