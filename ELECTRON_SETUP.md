# Electron Desktop App Setup

This guide explains how to run GlobalReach as a desktop application on your PC.

## 🖥️ What is Electron Mode?

Electron mode runs the app as a native desktop application:
- **Window-based UI** - Native desktop window
- **Local server** - Express server runs on your PC (port 4000)
- **Local storage** - Data stored in `config.json` on your computer
- **Auto webhooks** - Cloudflare Tunnel automatically exposes server for webhooks
- **Offline capable** - Works without internet (except webhooks)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Frontend (First Time)

```bash
npm run build:react
```

This builds the React app into `electron/build/` directory.

### 3. Start the App

```bash
npm start
```

The app will:
1. Start Express server on port 4000
2. Start Cloudflare Tunnel (if configured)
3. Open Electron window
4. Load the application

## 📁 Data Storage

Your data is stored locally on your PC:

**Windows:**
```
C:\Users\YourUsername\AppData\Roaming\shreenathji-app\config.json
```

**macOS:**
```
~/Library/Application Support/shreenathji-app/config.json
```

**Linux:**
```
~/.config/shreenathji-app/config.json
```

## 🔧 Configuration

### Server Port

Default port is 4000. To change:
1. Open app settings
2. Change server port
3. Restart app

### Cloudflare Tunnel

The app automatically starts Cloudflare Tunnel for webhooks:
- Downloads `cloudflared.exe` if needed
- Starts tunnel on app launch
- Stops tunnel on app close
- URL changes each restart (free tier)

**For stable URL:**
- Use Cloudflare account
- Create named tunnel
- Configure in app settings

## 🌐 Accessing the App

### Desktop Window (Default)
- App opens in Electron window automatically
- Native desktop experience

### Web Browser (Optional)
- Open: `http://localhost:4000`
- Same interface, browser-based
- Useful for remote access on local network

### Network Access
- Default: Only accessible from your PC
- To access from other devices on network:
  - Change network binding in settings
  - Access via: `http://your-pc-ip:4000`

## 🔄 Development Mode

For development with hot reload:

```bash
npm run dev
```

This:
- Starts Vite dev server (port 3000)
- Enables hot module replacement
- Faster development cycle

## 📦 Building Installer

### Windows Installer
```bash
npm run build
```

Creates `.exe` installer in `dist/` directory.

### Custom Installer
```bash
npm run build:installer
```

## 🆘 Troubleshooting

### Port Already in Use

**Error:** `Port 4000 is already in use`

**Solution:**
1. Find process using port:
   ```bash
   # Windows
   netstat -ano | findstr :4000
   
   # macOS/Linux
   lsof -i :4000
   ```
2. Kill the process or change port in settings

### Cloudflare Tunnel Not Starting

**Check:**
1. `cloudflared.exe` exists in `%USERPROFILE%\Downloads\`
2. Download from: https://github.com/cloudflare/cloudflared/releases
3. Check app logs for errors

### App Window Not Opening

**Check:**
1. Check if process is running: Task Manager / Activity Monitor
2. Check logs in app data directory
3. Try: `npm run build:react` then `npm start`

### Data Not Saving

**Check:**
1. App has write permissions to user data directory
2. Check disk space
3. Check logs for errors

## 🔐 Security

- **Local storage:** Data stored on your PC only
- **Encryption:** Credentials encrypted using OS keychain
- **Network:** Server only accessible locally (unless configured otherwise)
- **Webhooks:** Protected by verification token

## 📊 Logs

Logs are stored in:
```
%APPDATA%/shreenathji-app/logs/
```

Files:
- `error.log` - Error messages
- `combined.log` - All logs
- `exceptions.log` - Uncaught exceptions

## 🔄 Updates

The app checks for updates automatically:
- Checks on startup
- Downloads updates in background
- Prompts to install when ready

Manual update check:
- Menu → Help → Check for Updates

## 💡 Tips

1. **Keep app running:** App must be running for webhooks to work
2. **Backup data:** Regularly backup `config.json` file
3. **Network access:** Use network binding setting to allow LAN access
4. **Stable webhooks:** Use Cloudflare account for permanent URL

## 🌐 Switching to Web Mode

If you want to deploy to Back4App instead:
- See `BACK4APP_QUICK_START.md`
- App supports both Electron and web deployment
- Data can be migrated using migration script

---

**Need help?** Check main `README.md` or open an issue on GitHub.

