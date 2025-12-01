# GlobalReach - Electron Desktop App

This is the Electron desktop application version of GlobalReach Exporter Lead Automator.

## 🚀 Quick Start

### Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Comes with Node.js

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/globalreach-exporter-lead-automator.git
   cd globalreach-exporter-lead-automator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the app:**
   ```bash
   npm start
   ```

## 📦 Building the App

### Development Build

```bash
# Build React frontend
npm run build:react

# Start Electron app
npm start
```

### Production Build (Windows Installer)

```bash
# Build installer
npm run build:installer
```

This will create a Windows installer in the `dist/` directory.

## 🖥️ PC Hosting Setup

The app runs locally on your PC and includes:

### Built-in Express Server

- Runs on `http://localhost:4000` by default
- Handles webhooks (WhatsApp, WeChat)
- Provides REST API endpoints
- Serves the React frontend

### Cloudflare Tunnel Integration

- Automatically starts Cloudflare Tunnel for webhook access
- Provides public URL for webhooks: `https://xxxxx.trycloudflare.com`
- No manual configuration needed

### Data Storage

- All data stored locally in `%APPDATA%/shreenathji-app/`
- Config file: `config.json`
- Logs: `logs/` directory
- Product photos: `product-photos/` directory

## 🔧 Configuration

### First Run

On first launch, the app will:
1. Start the Express server on port 4000
2. Start Cloudflare Tunnel automatically
3. Show the setup wizard
4. Guide you through initial configuration

### Manual Configuration

Edit the config file at:
```
%APPDATA%/shreenathji-app/config.json
```

Or use the Settings panel in the app.

## 🌐 Webhook Setup

### WhatsApp Webhooks

1. The app automatically starts Cloudflare Tunnel
2. Get your webhook URL from the app (Settings → Integrations)
3. Use this URL in Meta for Developers:
   - URL: `https://xxxxx.trycloudflare.com/webhooks/whatsapp`
   - Verify Token: (set in app settings)

### WeChat Webhooks

1. Use the same Cloudflare Tunnel URL
2. Configure in WeChat Official Account settings:
   - URL: `https://xxxxx.trycloudflare.com/webhooks/wechat`
   - Token: (set in app settings)

## 📁 Project Structure

```
.
├── electron/
│   ├── main.js          # Electron main process
│   ├── preload.js       # Preload script
│   └── build/           # Built React app (created by build)
├── components/          # React components
├── services/            # Frontend services
├── package.json         # Main package.json
└── vite.config.ts       # Vite configuration
```

## 🛠️ Development

### Development Mode

```bash
# Start Vite dev server (for hot reload)
npm run dev

# In another terminal, start Electron
npm start
```

### Building for Production

```bash
# Build React app
npm run build:react

# Build Electron app with installer
npm run build
```

## 🔐 Security

- All sensitive data encrypted using OS keychain (Windows Credential Manager)
- API keys stored securely
- OAuth tokens encrypted
- Local file storage with encryption

## 📝 Logs

Logs are stored in:
```
%APPDATA%/shreenathji-app/logs/
```

- `error.log` - Error logs
- `combined.log` - All logs
- `exceptions.log` - Uncaught exceptions

## 🐛 Troubleshooting

### App won't start

1. Check Node.js version: `node --version` (should be 18+)
2. Reinstall dependencies: `npm install`
3. Check logs in `%APPDATA%/shreenathji-app/logs/`

### Port 4000 already in use

The app will automatically try the next available port (4001, 4002, etc.)

### Cloudflare Tunnel not starting

1. Download cloudflared from: https://github.com/cloudflare/cloudflared/releases
2. Place `cloudflared.exe` in `%USERPROFILE%\Downloads\`
3. Restart the app

### Webhooks not working

1. Check Cloudflare Tunnel is running (Settings → Integrations)
2. Verify webhook URL in Meta/WeChat settings
3. Check verify token matches
4. Review logs for errors

## 📦 Distribution

### Windows Installer

```bash
npm run build:installer
```

Creates installer in `dist/` directory.

### Manual Distribution

1. Build the app: `npm run build:react`
2. Package Electron app: `npm run build`
3. Distribute the files from `dist/` directory

## 🔄 Updates

The app includes automatic updates:
- Checks for updates on startup
- Downloads and installs updates automatically
- Notifies user when update is available

## 📚 Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

## 🆘 Support

For issues or questions:
1. Check the logs in `%APPDATA%/shreenathji-app/logs/`
2. Review troubleshooting section above
3. Check GitHub issues

