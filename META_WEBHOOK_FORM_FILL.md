# Meta Webhook Form - What to Fill In

## 📝 Based on the Meta for Developers Webhook Configuration Form

You're seeing a form with these fields. Here's exactly what to enter:

---

## 🔵 **Callback URL** Field

Enter your webhook URL in this format:

### **If Using ngrok (Local Development):**
```
https://your-ngrok-id.ngrok.io/webhooks/whatsapp
```

**Example:**
```
https://abc123def456.ngrok.io/webhooks/whatsapp
```

### **If Using Production Domain:**
```
https://your-domain.com/webhooks/whatsapp
```

**Example:**
```
https://myapp.example.com/webhooks/whatsapp
```

### **⚠️ Important Notes:**
- Must start with `https://` (NOT `http://`)
- Must end with `/webhooks/whatsapp`
- No trailing slash
- Must be publicly accessible (Meta can't reach localhost)

---

## 🔵 **Verify Token** Field

Enter the verify token that matches your app settings.

### **Default Token:**
```
globalreach_secret_token
```

### **Or Your Custom Token:**
Enter the exact same token you set in:
- Settings → Integrations → WhatsApp → Webhook Verify Token

**⚠️ Must match exactly:**
- Same case (uppercase/lowercase)
- No extra spaces
- Must be identical in both places

---

## ✅ Complete Example

### **Scenario: Using ngrok for local development**

1. **Start your app:** `npm start`
2. **Start ngrok:** `ngrok http 4000` 
3. **Copy the HTTPS URL** from ngrok (e.g., `https://abc123.ngrok.io`)

**In Meta form, enter:**

| Field | Value |
|-------|-------|
| **Callback URL** | `https://abc123.ngrok.io/webhooks/whatsapp` |
| **Verify Token** | `globalreach_secret_token` |

4. Click **"Verify and save"**

---

## 📋 Step-by-Step Process

### **Step 1: Prepare Your Webhook URL**

**Option A - Using ngrok:**
1. Install ngrok: https://ngrok.com/download
2. Run: `ngrok http 4000` (or your app's port)
3. Copy the HTTPS URL shown (e.g., `https://abc123.ngrok.io`)
4. Add `/webhooks/whatsapp` to get: `https://abc123.ngrok.io/webhooks/whatsapp`

**Option B - Using your domain:**
- Your webhook URL is: `https://your-domain.com/webhooks/whatsapp`

### **Step 2: Find Your Verify Token**

1. Open your app
2. Go to **Settings → Integrations → WhatsApp**
3. Find **"Webhook Verify Token"** field
4. Note the value (default is `globalreach_secret_token`)

### **Step 3: Fill in Meta Form**

1. Go to: https://developers.facebook.com/apps
2. Select your WhatsApp Business App
3. Click **"WhatsApp"** → **"Configuration"**
4. Scroll to **"Webhook"** section
5. Fill in:
   - **Callback URL:** `https://your-url/webhooks/whatsapp`
   - **Verify Token:** `globalreach_secret_token` (or your custom token)
6. Click **"Verify and save"**

### **Step 4: Subscribe to Fields**

After verification succeeds:
1. Click **"Manage"** next to "Webhook fields"
2. Check:
   - ✅ `messages`
   - ✅ `message_status`
3. Click **"Done"**

---

## 🧪 Testing

### **After Saving:**

1. **Verification Test:**
   - Meta will immediately test your webhook
   - If successful: ✅ Green checkmark
   - If failed: ❌ Error message

2. **Manual Test (if app unpublished):**
   - Click **"Test"** button in Meta
   - Select a test event
   - Check your app logs to see if webhook received

3. **Real Test:**
   - Send a WhatsApp message to your business number
   - Check if it appears in your app

---

## 🚨 Troubleshooting

### **"Webhook verification failed"**

**Check:**
- ✅ Callback URL is correct and accessible
- ✅ Verify token matches your app exactly
- ✅ Your app server is running
- ✅ URL starts with `https://`
- ✅ URL ends with `/webhooks/whatsapp` (no trailing slash)

**Test your URL:**
- Open the callback URL in browser
- Should show error (403/400) - this means it's reachable
- If connection error: URL is not accessible

### **"Callback URL not accessible"**

**Fix:**
- Use HTTPS (not HTTP)
- Use public URL (not localhost)
- Check ngrok is running (if using ngrok)
- Check firewall allows connections

---

## 💡 Quick Tips

1. **For Development:** Use ngrok to create a public URL for your local app
2. **For Production:** Deploy to a server with HTTPS domain
3. **Token Security:** Use a strong, unique token (not default in production)
4. **URL Changes:** If you change ngrok URL, update Meta webhook URL too
5. **Testing:** Unpublished apps can only use test webhooks from dashboard

---

## 📞 Need Help?

- **Full Guide:** See `WHATSAPP_WEBHOOK_SETUP.md`
- **Quick Reference:** See `WHATSAPP_WEBHOOK_QUICK_SETUP.md`
- **Connection Issues:** See `WHATSAPP_CONNECTION_FIX.md`











