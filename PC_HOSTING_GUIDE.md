# PC Hosting Guide - Electron Desktop App

This guide explains how to run GlobalReach as a desktop application on your PC.

## Overview

The Electron app runs entirely on your local PC:
- ✅ No cloud hosting required
- ✅ All data stored locally
- ✅ Built-in web server for webhooks
- ✅ Automatic Cloudflare Tunnel for public access
- ✅ Works offline (except webhooks)

## System Requirements

- **OS**: Windows 10/11, macOS, or Linux
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 500MB free space
- **Node.js**: 18.0.0 or higher (included in installer)

## Installation

### Option 1: Installer (Recommended)

1. Download the installer from releases
2. Run the installer
3. Follow the installation wizard
4. Launch the app from Start Menu

### Option 2: From Source

1. **Install Node.js** (if not already installed):
   - Download from: https://nodejs.org
   - Version 18.0.0 or higher

2. **Clone and install:**
   ```bash
   git clone https://github.com/yourusername/globalreach-exporter-lead-automator.git
   cd globalreach-exporter-lead-automator
   npm install
   ```

3. **Build and run:**
   ```bash
   npm run build:react
   npm start
   ```

## First Launch

1. **App starts automatically:**
   - Express server starts on port 4000
   - Cloudflare Tunnel starts automatically
   - Setup wizard appears

2. **Complete setup:**
   - Enter webhook verification token
   - Configure API keys (Gemini AI, etc.)
   - Set up email/WhatsApp integrations

3. **Get your webhook URL:**
   - Go to Settings → Integrations
   - Copy the Cloudflare Tunnel URL
   - Use this for webhook configuration

## Running the App

### Start the App

- **Windows**: Double-click desktop shortcut or Start Menu
- **Command Line**: `npm start` (from project directory)

### Stop the App

- Close the window or use File → Quit
- Server and tunnel stop automatically

## Webhook Configuration

### WhatsApp Setup

1. **Get webhook URL from app:**
   - Settings → Integrations → WhatsApp
   - Copy the webhook URL (e.g., `https://xxxxx.trycloudflare.com/webhooks/whatsapp`)

2. **Configure in Meta:**
   - Go to Meta for Developers
   - Your App → Webhooks
   - Set callback URL to your webhook URL
   - Set verify token (from app settings)

### WeChat Setup

1. **Get webhook URL:**
   - Same Cloudflare Tunnel URL
   - Use: `https://xxxxx.trycloudflare.com/webhooks/wechat`

2. **Configure in WeChat:**
   - Official Account settings
   - Set webhook URL
   - Set token (from app settings)

## Data Storage

All data is stored locally on your PC:

### Windows
```
%APPDATA%\shreenathji-app\
├── config.json          # App configuration
├── logs/                # Application logs
└── product-photos/      # Product images
```

### macOS
```
~/Library/Application Support/shreenathji-app/
```

### Linux
```
~/.config/shreenathji-app/
```

## Network Configuration

### Port Usage

- **Port 4000**: Express server (default)
- If port 4000 is busy, app uses next available port

### Firewall

Windows Firewall may prompt for permission:
- Click "Allow access" when prompted
- Or manually add rule for port 4000

### Cloudflare Tunnel

- Automatically creates public URL
- No firewall configuration needed
- URL changes on each restart (for free tier)
- For stable URL, use Cloudflare account

## Backup & Restore

### Backup

1. Go to Settings → Backup & Restore
2. Click "Create Backup"
3. Save backup file to safe location

### Restore

1. Go to Settings → Backup & Restore
2. Click "Restore Backup"
3. Select backup file
4. Confirm restore

### Manual Backup

Copy the entire app data directory:
```
%APPDATA%\shreenathji-app\
```

## Troubleshooting

### App won't start

1. **Check Node.js:**
   ```bash
   node --version
   ```
   Should be 18.0.0 or higher

2. **Reinstall dependencies:**
   ```bash
   npm install
   ```

3. **Check logs:**
   - Location: `%APPDATA%\shreenathji-app\logs\`
   - Check `error.log` for errors

### Server won't start

1. **Port in use:**
   - Close other apps using port 4000
   - Or let app use next available port

2. **Firewall blocking:**
   - Allow app through Windows Firewall
   - Add exception for port 4000

### Cloudflare Tunnel not working

1. **Download cloudflared:**
   - https://github.com/cloudflare/cloudflared/releases
   - Place in `%USERPROFILE%\Downloads\cloudflared.exe`

2. **Check internet connection:**
   - Tunnel requires internet access

3. **Restart app:**
   - Tunnel starts automatically on app start

### Webhooks not receiving messages

1. **Verify URL:**
   - Check webhook URL in Meta/WeChat matches app URL
   - URL changes if tunnel restarts

2. **Check verify token:**
   - Must match in both app and Meta/WeChat

3. **Check logs:**
   - Review `logs/combined.log` for webhook activity

## Performance Tips

1. **Close when not in use:**
   - Saves system resources
   - Tunnel stops automatically

2. **Regular backups:**
   - Backup data regularly
   - Store backups in safe location

3. **Monitor logs:**
   - Check logs periodically
   - Clean old logs if needed

## Security

- ✅ All data encrypted locally
- ✅ API keys stored securely
- ✅ OAuth tokens encrypted
- ✅ No data sent to external servers (except webhooks)
- ⚠️ Keep backup files secure

## Updates

The app checks for updates automatically:
- Checks on startup
- Downloads updates in background
- Prompts to install when ready

Manual update:
1. Download latest release
2. Run installer
3. Follow update wizard

## Support

For help:
1. Check logs: `%APPDATA%\shreenathji-app\logs\`
2. Review troubleshooting section
3. Check GitHub issues
4. Contact support

