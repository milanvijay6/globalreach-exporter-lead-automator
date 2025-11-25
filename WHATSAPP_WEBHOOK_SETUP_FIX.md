# Fix: WhatsApp Webhook Validation Error

## Problem
"The callback URL or verify token couldn't be validated"

## Root Cause
Meta cannot access `localhost` URLs. You need a publicly accessible HTTPS URL.

## Your Current Configuration

**Callback URL:** `http://localhost:4000/webhooks/whatsapp`  
**Verify Token:** `globalreach_secret_token`

## Solution: Use ngrok (Easiest Method)

### Step 1: Install ngrok
1. Download from: https://ngrok.com/download
2. Extract the executable
3. (Optional) Add to your PATH for easier access

### Step 2: Start ngrok tunnel
Open a new terminal/command prompt and run:
```bash
ngrok http 4000
```

**Note:** Make sure port 4000 matches your app's server port (check in Settings → System)

### Step 3: Copy the HTTPS URL
You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:4000
```

Copy the **HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Step 4: Update Tunnel URL in App
1. Open your app
2. Go to **Settings** → **System** tab
3. Find **Tunnel URL** field
4. Paste the ngrok HTTPS URL (without `/webhooks/whatsapp`)
5. Click **Save**

### Step 5: Get Your New Webhook URL
After saving, your webhook URL will automatically update to:
```
https://abc123.ngrok.io/webhooks/whatsapp
```

**To verify:**
- Go to **Settings** → **Integrations**
- Find WhatsApp connection
- Check the **Webhook URL** field

### Step 6: Configure in Meta Business Manager
1. Go to [Meta Business Manager](https://business.facebook.com)
2. Navigate to **WhatsApp → Configuration → Webhooks**
3. Click **Edit** or **Configure**
4. Enter **Callback URL:**
   ```
   https://abc123.ngrok.io/webhooks/whatsapp
   ```
   (Replace with YOUR ngrok URL)
5. Enter **Verify Token:**
   ```
   globalreach_secret_token
   ```
6. Subscribe to webhook fields:
   - ✅ `messages`
   - ✅ `message_status`
7. Click **Verify and Save**

## Alternative Tunnel Services

### localtunnel
```bash
npm install -g localtunnel
lt --port 4000
```

### Cloudflare Tunnel
```bash
cloudflared tunnel --url http://localhost:4000
```

Then update the tunnel URL in Settings → System.

## Quick Verification Script

Run this command to get your current webhook configuration:
```bash
node scripts/get-whatsapp-webhook-config.js
```

## Troubleshooting

### Still Getting Validation Error?

1. **Check server is running:**
   - Make sure the app is running (`npm start`)
   - The webhook endpoint should respond at `http://localhost:4000/webhooks/whatsapp`

2. **Verify tunnel is active:**
   - Check ngrok dashboard shows "Active"
   - Test the tunnel URL in browser: `https://your-tunnel.ngrok.io/webhooks/whatsapp`
   - Should return 403 (that's OK - means it's accessible)

3. **Check verify token matches exactly:**
   - Token is case-sensitive: `globalreach_secret_token`
   - No extra spaces or characters
   - Check in Settings → System → Webhook Verify Token

4. **Test webhook endpoint:**
   ```
   https://your-tunnel.ngrok.io/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=globalreach_secret_token&hub.challenge=test123
   ```
   Should return: `test123` (the challenge string)

### Common Issues

**"Connection refused"**
- Server not running → Start app with `npm start`
- Wrong port → Check Settings → System → Server Port

**"Tunnel URL not updating"**
- Close and reopen Settings modal
- Restart the app

**"Token mismatch"**
- Verify token in Settings → System matches exactly in Meta
- Token is case-sensitive!

## For Production

When deploying to production:
1. Use a real domain with HTTPS
2. Update **Production Webhook URL** in Settings → System
3. The app will automatically use production URL over tunnel URL

---

**Quick Command Reference:**
- Get config: `node scripts/get-whatsapp-webhook-config.js`
- Start ngrok: `ngrok http 4000`
- Check webhook: Visit `http://localhost:4000/webhooks/whatsapp` in browser

