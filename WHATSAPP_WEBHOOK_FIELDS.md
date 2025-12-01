# WhatsApp Webhook Fields - Which to Subscribe

## ✅ Essential Fields to Subscribe

Based on your app's functionality, subscribe to these fields:

### **1. `messages` (REQUIRED)**
- **Purpose:** Receive incoming messages from users
- **What it does:** 
  - Receives text messages, images, videos, documents, audio
  - Your app processes these and displays them in the chat interface
- **Status:** ✅ **Subscribe to this**

### **2. Status Updates - NO SEPARATE FIELD NEEDED! ✅**

**Important:** There is **NO separate `message_status` field** in WhatsApp Cloud API.

**Status updates come automatically with the `messages` field!**

When you subscribe to `messages`, you automatically receive:
- ✅ Incoming messages from users
- ✅ Status updates (sent, delivered, read, failed) for messages you send

**How it works:**
- When you send a message, WhatsApp sends status updates through the same webhook
- The webhook payload includes a `statuses` array with delivery status
- Your app automatically processes these status updates

**You don't need to subscribe to any additional field for status updates!**

### **Optional: `message_echoes`**

- **`message_echoes`** - Receives echo messages (messages you sent)
- This is optional and mainly for echo functionality
- Status updates work without this field

---

## 📋 Recommended Subscription

### **Required (Only One Field Needed!):**
1. ✅ **`messages`** - For receiving incoming messages AND status updates

**That's it!** Just subscribe to `messages` and you'll get:
- ✅ All incoming messages
- ✅ All status updates (sent, delivered, read, failed)

### **Optional:**
2. **`message_echoes`** - Only if you want echo messages (not required for status updates)

---

## 🔧 How to Subscribe

1. **After setting up your webhook** (Callback URL and Verify Token)
2. **Click "Manage"** next to "Webhook fields"
3. **Subscribe to:**
   - ✅ `messages` (v24.0)
   - ✅ `message_echoes` (v24.0) - if you want echo messages
4. **Click "Done"** to save

---

## 📝 What Each Field Does

### **`messages`**
- Receives all incoming messages from users
- Includes: text, images, videos, documents, audio, location, contacts
- Your app processes these and shows them in chat

### **`message_echoes`**
- Receives echo messages (messages you sent)
- May include delivery status updates
- Useful for confirming messages were sent

### **Other Fields (Not Required for Basic Functionality):**

- `account_alerts` - Account-related alerts
- `account_update` - Account information updates
- `business_status_update` - Business account status changes
- `calls` - Voice/video call events
- `flows` - WhatsApp Flows interactions
- `group_*` - Group-related events (if using groups)
- `message_template_*` - Template message status
- `security` - Security-related events
- `tracking_events` - Analytics/tracking events

**You don't need to subscribe to these unless you specifically need that functionality.**

---

## ✅ Quick Checklist

- [ ] Subscribe to `messages` field
- [ ] Optionally subscribe to `message_echoes` 
- [ ] Click "Done" to save
- [ ] Test by sending a message to your WhatsApp number

---

## 🧪 Testing

After subscribing:

1. **Send a test message** to your WhatsApp Business number
2. **Check your app** - the message should appear
3. **Send a message from your app** - check if status updates appear
4. **Check webhook logs** in Meta to see if webhooks are being received

---

## ⚠️ Important Notes

1. **`messages` is essential** - Without it, you won't receive any incoming messages
2. **Status updates** are usually included with `messages` field
3. **Don't subscribe to everything** - Only subscribe to what you need
4. **Version:** Use v24.0 (as shown in your list)

---

## 🆘 If Messages Aren't Coming Through

1. ✅ Verify `messages` field is subscribed
2. ✅ Check webhook is verified (green checkmark)
3. ✅ Test webhook in Meta (click "Test" button)
4. ✅ Check your app logs for webhook payloads
5. ✅ Verify Cloudflare Tunnel is running
6. ✅ Check callback URL is correct

