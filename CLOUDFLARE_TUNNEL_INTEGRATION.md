# Cloudflare Tunnel Integration - Complete

## ✅ What Was Done

The Electron app has been updated to automatically start and stop Cloudflare Tunnel along with the app.

### **Changes Made:**

1. **Replaced ngrok with Cloudflare Tunnel**
   - All ngrok references replaced with Cloudflare Tunnel
   - Functions renamed: `startNgrok()` → `startCloudflareTunnel()`, `stopNgrok()` → `stopCloudflareTunnel()`

2. **Automatic Startup**
   - Cloudflare Tunnel starts automatically when the app starts
   - Runs on the same port as your server (default: 4000)
   - Extracts the public URL from Cloudflare Tunnel output

3. **Automatic Shutdown**
   - Cloudflare Tunnel stops automatically when the app closes
   - Handles both `window-all-closed` and `before-quit` events

4. **Backward Compatibility**
   - IPC handlers still use 'ngrok' naming for frontend compatibility
   - Config keys support both old and new names
   - Event names remain the same (`ngrok-started`)

## 🚀 How It Works

### **On App Start:**
1. App starts Express server on port 4000 (default)
2. Cloudflare Tunnel automatically starts
3. Tunnel URL is extracted from output
4. URLs are saved to config:
   - `cloudflareUrl` - Main tunnel URL
   - `webhookUrl` - WhatsApp webhook URL
   - `oauthCallbackUrl` - Azure OAuth callback URL

### **On App Close:**
1. Cloudflare Tunnel process is terminated
2. All tunnel-related variables are cleared

## 📋 URLs Generated

When Cloudflare Tunnel starts, it automatically creates:

- **Tunnel URL:** `https://xxxxx-xxxxx-xxxxx.trycloudflare.com`
- **WhatsApp Webhook URL:** `https://xxxxx-xxxxx-xxxxx.trycloudflare.com/webhooks/whatsapp`
- **Azure OAuth Callback URL:** `https://xxxxx-xxxxx-xxxxx.trycloudflare.com/api/oauth/callback`

## ⚙️ Configuration

### **Auto-Start Setting:**
- Config key: `autoStartTunnel` (or `autoStartNgrok` for backward compatibility)
- Default: `true` (enabled)
- To disable: Set `autoStartTunnel` to `false` in app settings

### **Cloudflare Tunnel Location:**
The app looks for `cloudflared.exe` in these locations (in order):
1. `%USERPROFILE%\Downloads\cloudflared.exe` (Windows default)
2. `cloudflared` (in system PATH)
3. Current directory

## 🔧 Manual Control

You can still manually control the tunnel via IPC handlers:

- `ngrok-start` - Start tunnel manually
- `ngrok-stop` - Stop tunnel manually
- `ngrok-get-url` - Get current tunnel URL
- `ngrok-get-webhook-url` - Get webhook URL
- `ngrok-get-oauth-callback-url` - Get OAuth callback URL
- `ngrok-is-running` - Check if tunnel is running

## 📝 Logs

All Cloudflare Tunnel activity is logged:
- `[Cloudflare] Starting Cloudflare Tunnel for port X`
- `[Cloudflare] ✅ Tunnel started: https://...`
- `[Cloudflare] Tunnel stopped`
- Errors and warnings are also logged

## ⚠️ Important Notes

1. **Keep Tunnel Running:** The tunnel runs automatically - don't close it manually
2. **URL Changes:** Free Cloudflare Tunnel URLs change each time you restart the app
3. **Update Webhooks:** If you restart the app, update webhook URLs in:
   - Meta for Developers (WhatsApp)
   - Azure Portal (OAuth)
4. **Port 4000:** Server defaults to port 4000. If port 4000 is in use, it will try 4001, 4002, etc.

## 🎯 Next Steps

1. **Download Cloudflare Tunnel** (if not already downloaded):
   - Go to: https://github.com/cloudflare/cloudflared/releases/latest
   - Download `cloudflared-windows-amd64.exe`
   - Save to: `%USERPROFILE%\Downloads\cloudflared.exe`

2. **Start Your App:**
   ```bash
   npm start
   ```

3. **Check Logs:**
   - Look for `[Cloudflare] ✅ Tunnel started:` in console
   - The tunnel URL will be displayed

4. **Use the URLs:**
   - WhatsApp webhook: Use the webhook URL in Meta
   - Azure OAuth: Use the OAuth callback URL in Azure Portal

## ✅ Status

- ✅ Cloudflare Tunnel integration complete
- ✅ Automatic startup on app launch
- ✅ Automatic shutdown on app close
- ✅ URL extraction and storage
- ✅ Backward compatibility maintained
- ✅ Server defaults to port 4000

