# Fix WhatsApp Connection Warning

## ⚠️ The Warning

**"WhatsApp connected with warning: Connection test failed, but credentials saved."**

This means your credentials are saved, but the connection test couldn't verify permissions. The token may still work for sending messages.

---

## 🔍 What the Test Checks

The app tests if your access token can:
- Query phone number information
- Verify the Phone Number ID exists
- Check account permissions

If this fails, it usually means:
- Token doesn't have query permissions (but may still send messages)
- Phone Number ID is incorrect
- Token is expired or invalid

---

## ✅ How to Fix It

### **Step 1: Verify Your Access Token**

1. Go to [Meta for Developers](https://developers.facebook.com/apps)
2. Select your WhatsApp Business App
3. Go to **WhatsApp → API Setup**
4. Check if your **Access Token** is still valid
5. If expired, click **"Generate new token"**

### **Step 2: Check Token Permissions**

Your token needs these permissions:
- ✅ `whatsapp_business_messaging` - Required for sending/receiving messages
- ✅ `whatsapp_business_management` - Required for querying phone info (optional but recommended)

**To add permissions:**

1. In Meta for Developers → Your App → **WhatsApp → API Setup**
2. Scroll to **"Permissions"** section
3. Make sure `whatsapp_business_messaging` is checked
4. Optionally check `whatsapp_business_management` for full access
5. **Generate a new token** with these permissions

### **Step 3: Verify Phone Number ID**

1. In Meta for Developers → Your App → **WhatsApp → API Setup**
2. Find **"Phone number ID"** (starts with numbers like `123456789012345`)
3. Copy it exactly (no spaces)
4. Verify it matches what you entered in the app

### **Step 4: Verify Business Account ID**

1. In Meta for Developers → Go to **Business Settings**
2. Find your **WhatsApp Business Account**
3. Copy the **Business Account ID**
4. Verify it matches what you entered in the app

---

## 🔧 Detailed Fix Steps

### **Option A: Generate New Token with Full Permissions**

1. **Go to Meta for Developers:**
   - Visit: https://developers.facebook.com/apps
   - Select your WhatsApp Business App

2. **Navigate to API Setup:**
   - Click **"WhatsApp"** in left sidebar
   - Click **"API Setup"** tab

3. **Check Current Token:**
   - Look at **"Temporary access token"** section
   - Note expiration date
   - If expired or about to expire, continue to step 4

4. **Generate New Token:**
   - Click **"Generate new token"** button
   - Select your System User (or create one)
   - Make sure these permissions are selected:
     - `whatsapp_business_messaging` ✅
     - `whatsapp_business_management` ✅ (optional but recommended)
   - Click **"Generate token"**
   - **Copy the token immediately** (you can't see it again!)

5. **Update in Your App:**
   - Go to Settings → Integrations → WhatsApp
   - Paste the new Access Token
   - Click "Connect" again

### **Option B: Use System User Token (Recommended)**

For production, use a System User token instead of temporary token:

1. **Create System User:**
   - Meta for Developers → Your App → **Business Settings**
   - Go to **"System Users"** section
   - Click **"Add"** → **"Create new system user"**
   - Name it (e.g., "WhatsApp Bot User")
   - Click **"Create system user"**

2. **Assign Permissions:**
   - Click on your new System User
   - Click **"Assign assets"**
   - Select your WhatsApp Business Account
   - Assign permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Click **"Save changes"**

3. **Generate Token:**
   - Click **"Generate new token"** button
   - Select your WhatsApp Business App
   - Select permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
   - Click **"Generate token"**
   - **Copy the token** (this is permanent, won't expire!)

4. **Update in Your App:**
   - Settings → Integrations → WhatsApp
   - Paste the System User token
   - Click "Connect" again

---

## 🧪 Test After Fixing

After updating your token:

1. **Reconnect WhatsApp:**
   - Settings → Integrations → WhatsApp
   - Enter new Access Token
   - Click "Connect"

2. **Check for Warning:**
   - If connection test passes, no warning will appear ✅
   - If warning still appears, continue troubleshooting

3. **Try Sending a Message:**
   - Test sending a message to a contact
   - If it works, the warning is just about query permissions (not critical)
   - If it fails, see "Troubleshooting" below

---

## 🚨 Troubleshooting

### **Issue: "Invalid access token"**

**Fix:**
- Token is expired → Generate new token
- Token was copied incorrectly → Copy again carefully (no spaces)
- Token doesn't have required permissions → Generate with correct permissions

### **Issue: "Phone number ID not found"**

**Fix:**
- Verify Phone Number ID in Meta → WhatsApp → API Setup
- Copy the ID exactly (it's a long number like `123456789012345`)
- Make sure it's from the same WhatsApp Business Account

### **Issue: "HTTP 403" or "Permission denied"**

**Fix:**
- Token doesn't have `whatsapp_business_messaging` permission
- Generate new token with correct permissions
- Make sure System User has access to WhatsApp Business Account

### **Issue: Messages still don't send**

**Fix:**
1. Verify webhook is configured:
   - Meta → WhatsApp → Configuration
   - Set webhook URL: `http://your-domain.com/webhooks/whatsapp`
   - Set verify token (match what you entered in app)

2. Verify phone number is verified:
   - Meta → WhatsApp → Phone Numbers
   - Make sure your number shows as "Verified" ✅

3. Check message templates:
   - First message must use an approved template
   - After user replies, you can send free-form messages

---

## ✅ Quick Checklist

Before reconnecting, verify:

- [ ] Access Token is valid (not expired)
- [ ] Token has `whatsapp_business_messaging` permission
- [ ] Phone Number ID matches your WhatsApp Business Account
- [ ] Business Account ID is correct
- [ ] Webhook Verify Token matches what's in Meta
- [ ] Phone number is verified in Meta

---

## 📝 Important Notes

1. **Temporary tokens expire in 24 hours** - Use System User tokens for production
2. **First message must use template** - You can't send free-form first messages
3. **Webhook must be configured** - For receiving messages
4. **Phone number must be verified** - In Meta Business Manager

---

## 🎯 If Warning Persists

If you see the warning but messages work:

- ✅ **You're good!** The warning just means query permissions aren't available
- The token can still send/receive messages
- You can safely ignore the warning if everything works

If messages don't work:

- ❌ **Need to fix permissions** - Follow steps above
- Generate new token with `whatsapp_business_messaging` permission
- Verify all credentials are correct

---

**Need help?** Check the error message details - it will tell you exactly what's wrong!












