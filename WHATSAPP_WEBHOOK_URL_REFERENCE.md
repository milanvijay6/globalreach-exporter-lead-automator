# WhatsApp Webhook URL Reference

## Overview

WhatsApp Cloud API uses a **Webhook URL** (not an OAuth redirect URI) to receive incoming messages and status updates from Meta's servers.

## Webhook URL Format

The webhook URL format depends on your setup:

### 1. Local Development (Default)
```
http://localhost:{PORT}/webhooks/whatsapp
```

**Example (default port 4000):**
```
http://localhost:4000/webhooks/whatsapp
```

### 2. With Tunnel Service (Recommended for Testing)
```
https://{tunnel-url}/webhooks/whatsapp
```

**Example (using ngrok):**
```
https://abc123.ngrok.io/webhooks/whatsapp
```

### 3. Production URL (If Configured)
```
https://{your-production-domain}/webhooks/whatsapp
```

**Example:**
```
https://yourdomain.com/webhooks/whatsapp
```

## How to Get Your Webhook URL

### Option 1: From Settings (Recommended)
1. Open the app
2. Go to **Settings** → **Integrations** tab
3. Find your WhatsApp connection
4. The **Webhook URL** is displayed in the connection details
5. Click **Copy** button to copy it to clipboard

### Option 2: Check Your Server Port
The webhook URL is automatically generated based on:
- Your configured server port (default: 4000)
- Tunnel URL (if configured)
- Production URL (if configured)

## Where to Configure in Meta

1. Go to [Meta Business Manager](https://business.facebook.com)
2. Navigate to **WhatsApp → Configuration → Webhooks**
3. Click **Edit** or **Configure**
4. Enter your webhook URL in the **Callback URL** field
5. Enter your **Verify Token** (default: `globalreach_secret_token` or your custom token)
6. Subscribe to webhook fields:
   - ✅ `messages` - Incoming messages
   - ✅ `message_status` - Message delivery status

## Important Notes

### For Local Development:
- **HTTP is allowed** for localhost (`http://localhost`)
- Meta requires a **publicly accessible URL** for webhooks
- Use a tunneling service (ngrok, localtunnel, etc.) to make localhost accessible

### For Production:
- **HTTPS is required** (Meta requires secure connections)
- Use a valid SSL certificate
- Ensure your server is publicly accessible
- Configure firewall rules to allow incoming webhook requests

## Webhook Verify Token

The verify token is used to authenticate webhook requests from Meta:

**Default Token:** `globalreach_secret_token`

**To Set Custom Token:**
1. Go to **Settings** → **System** tab
2. Find **Webhook Verify Token** field
3. Enter your custom token
4. Use the same token in Meta's webhook configuration

## Webhook Endpoint Details

### Verification Request (GET)
When you configure the webhook in Meta, Meta sends a GET request:
```
GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
```

Your app responds with the challenge string if the token matches.

### Incoming Messages (POST)
Meta sends incoming messages via POST requests:
```
POST /webhooks/whatsapp
Content-Type: application/json
```

## Troubleshooting

### Webhook Not Receiving Messages
- ✅ Verify webhook URL is publicly accessible
- ✅ Check webhook is subscribed in Meta
- ✅ Verify token matches in both places
- ✅ Check firewall/network settings
- ✅ Verify server is running and accessible

### "Webhook Verification Failed"
- ✅ Check verify token matches exactly (case-sensitive)
- ✅ Ensure webhook endpoint responds correctly to GET requests
- ✅ Check server logs for errors

### "Connection Refused"
- ✅ Ensure your server is running
- ✅ Verify the port is correct
- ✅ Check if firewall is blocking the port
- ✅ For localhost, use a tunnel service

## Quick Reference

| Setting | Default | Location |
|---------|---------|----------|
| **Webhook URL** | `http://localhost:4000/webhooks/whatsapp` | Settings → Integrations |
| **Verify Token** | `globalreach_secret_token` | Settings → System |
| **Server Port** | `4000` | Settings → System |
| **Endpoint Path** | `/webhooks/whatsapp` | Fixed (in code) |

## Testing Your Webhook

1. Configure webhook in Meta Business Manager
2. Send a test message to your WhatsApp Business number
3. Check app logs for incoming webhook
4. Verify message appears in the chat interface

## Example Webhook URLs

### Development (Local)
```
http://localhost:4000/webhooks/whatsapp
http://localhost:5000/webhooks/whatsapp  (if port is 5000)
```

### Development (With Tunnel)
```
https://a1b2c3.ngrok.io/webhooks/whatsapp
https://your-app.loca.lt/webhooks/whatsapp  (localtunnel)
```

### Production
```
https://api.yourcompany.com/webhooks/whatsapp
https://webhooks.yourcompany.com/whatsapp
```

---

**Note:** This is NOT an OAuth redirect URI. WhatsApp Cloud API uses direct access tokens, not OAuth flows like email providers (Gmail/Outlook).

