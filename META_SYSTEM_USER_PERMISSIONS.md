# Meta System User Permissions - WhatsApp Setup

## ❌ Error You're Seeing

```
No permissions available

Assign an app role to the system user, or select another app to continue.
```

## 🔍 What This Means

This error occurs when:
1. The System User doesn't have access to your WhatsApp Business App
2. The app doesn't have WhatsApp product added
3. The System User needs to be assigned to the app first

---

## ✅ Solution: Step-by-Step Fix

### **Step 1: Verify WhatsApp Product is Added to Your App**

Before assigning permissions, make sure WhatsApp is added to your app:

1. Go to: https://developers.facebook.com/apps
2. Select your app
3. Check the left sidebar - you should see **"WhatsApp"** in the menu
4. If you don't see "WhatsApp":
   - Click **"+ Add Product"** or **"Add Product"**
   - Find **"WhatsApp"** in the list
   - Click **"Set Up"** or **"Add"**
   - Follow the setup wizard

---

### **Step 2: Assign System User to Your App**

**Important:** You must assign the System User to your app BEFORE assigning permissions.

1. Go to: https://business.facebook.com
2. Navigate to: **Business Settings** → **Users** → **System Users**
3. Find your System User (or create a new one)
4. Click on the System User name
5. Click **"Assign Assets"** tab (or **"Assets"**)
6. Click **"Assign Assets"** button
7. Select **"Apps"** from the dropdown
8. Find and select your WhatsApp Business App
9. Click **"Assign"** or **"Save"**

---

### **Step 3: Assign Permissions to System User**

Now that the System User is assigned to your app:

1. Still in the System User page
2. Click **"Assign Assets"** tab
3. You should now see your app listed
4. Click on your app
5. Click **"Edit"** or the permissions icon
6. You should now see available permissions:
   - ✅ **`whatsapp_business_messaging`** - Send/receive messages
   - ✅ **`whatsapp_business_management`** - Manage business account
7. Check both permissions
8. Click **"Save"**

---

### **Step 4: Generate Access Token**

After assigning permissions:

1. Still in the System User page
2. Click **"Generate New Token"** button
3. Select your app from the dropdown
4. Select the permissions:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
5. Click **"Generate Token"**
6. **Copy the token immediately** (you can only see it once!)
7. Use this token in your app

---

## 🔧 Alternative: Use App-Level Access Token

If System User setup is too complex, you can use a temporary token for testing:

### **Option 1: Temporary Token (Quick Testing)**

1. Go to: https://developers.facebook.com/apps
2. Select your WhatsApp Business App
3. Click **"WhatsApp"** → **"API Setup"**
4. Find **"Temporary access token"** section
5. Click **"Generate Token"**
6. Copy the token
7. **Note:** This token expires in 1 hour, but works for testing

### **Option 2: Use Existing Token**

If you already have a token that works for sending messages:
- You can use it even if it doesn't have query permissions
- The app will allow connection with a warning
- Test by sending a message to verify it works

---

## 📋 Complete Setup Checklist

### **App Setup:**
- [ ] WhatsApp product is added to your app
- [ ] App is connected to WhatsApp Business Account
- [ ] Phone number is registered in WhatsApp Business Account

### **System User Setup:**
- [ ] System User is created in Business Settings
- [ ] System User is assigned to your app
- [ ] Permissions are assigned:
  - [ ] `whatsapp_business_messaging`
  - [ ] `whatsapp_business_management`
- [ ] Access Token is generated with these permissions

### **App Configuration:**
- [ ] Access Token is entered in app
- [ ] Phone Number ID is correct
- [ ] Business Account ID is correct
- [ ] Webhook is configured

---

## 🆘 Troubleshooting

### **Issue: "No permissions available"**

**Cause:** System User is not assigned to the app

**Fix:**
1. Assign System User to your app first (Step 2)
2. Then assign permissions (Step 3)

### **Issue: Can't find WhatsApp in permissions**

**Cause:** WhatsApp product not added to app

**Fix:**
1. Add WhatsApp product to your app (Step 1)
2. Then try assigning permissions again

### **Issue: System User not showing in dropdown**

**Cause:** System User doesn't have access to your Business Account

**Fix:**
1. Make sure you're using the correct Business Account
2. Create System User in the same Business Account as your app
3. Assign System User to Business Account first

### **Issue: Token works but can't query phone number**

**Cause:** Token missing `whatsapp_business_management` permission

**Fix:**
1. Generate new token with both permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`

---

## 💡 Quick Reference

**Where to go:**
- **Meta for Developers:** https://developers.facebook.com/apps
- **Meta Business Settings:** https://business.facebook.com

**Required Permissions:**
- `whatsapp_business_messaging` - Required for sending/receiving messages
- `whatsapp_business_management` - Required for querying phone number info

**Token Types:**
- **Temporary Token:** Expires in 1 hour, good for testing
- **System User Token:** Permanent, good for production

---

## ✅ After Setup

Once you have the token:

1. **Copy the token** (you can only see it once!)
2. **Go to your app** → Settings → Integrations → WhatsApp
3. **Paste the token** in "Access Token" field
4. **Enter other credentials:**
   - Phone Number ID
   - Business Account ID
   - Webhook Verify Token
5. **Click "Test Connection"** or **"Connect"**
6. **Test by sending a message**

---

## 🎯 Summary

The error "No permissions available" means:
1. ✅ First: Add WhatsApp product to your app
2. ✅ Second: Assign System User to your app
3. ✅ Third: Assign permissions to System User
4. ✅ Fourth: Generate token with permissions

Follow the steps in order, and you'll be able to assign permissions successfully!


