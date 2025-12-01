# GlobalReach - Exporter Lead Automator

AI-powered CRM for international importer outreach via WhatsApp and Email.

**Version:** 1.0.2  
**Platform:** Electron Desktop App (Windows, macOS, Linux)  
**Tech Stack:** Electron + React + TypeScript + Vite  
**AI Engine:** Google Gemini AI  
**Node.js Requirement:** >= 18.0.0

## 🚀 Quick Start

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/milanvijay6/globalreach-exporter-lead-automator.git
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

The app will:
- Start the Electron desktop application
- Launch a local Express server on port 4000
- Automatically start Cloudflare Tunnel for webhooks (if configured)
- Open the application window

## 📦 Building the App

### Development Build
```bash
npm run build:react
npm start
```

### Production Build (Installer)
```bash
npm run build
```

This creates installers for:
- Windows: `.exe` installer
- macOS: `.dmg` installer
- Linux: `.AppImage` or `.deb` package

### Custom Installer
```bash
npm run build:installer
```

## 🖥️ Local PC Hosting

The app runs as a desktop application on your PC:

- **Server:** Express server runs locally on port 4000
- **Storage:** Data stored locally in `config.json` (in app user data directory)
- **Webhooks:** Cloudflare Tunnel automatically exposes local server for webhooks
- **Access:** App accessible via Electron window + localhost:4000

### Accessing the App

- **Desktop App:** Launch via Electron window (default)
- **Web Interface:** Open `http://localhost:4000` in browser (optional)

### Configuration

Configuration is stored in:
- **Windows:** `%APPDATA%/shreenathji-app/config.json`
- **macOS:** `~/Library/Application Support/shreenathji-app/config.json`
- **Linux:** `~/.config/shreenathji-app/config.json`

## 🌐 Web Deployment (Optional)

For web hosting on Back4App, see:
- `BACK4APP_QUICK_START.md` - Quick deployment guide
- `BACK4APP_DEPLOYMENT.md` - Full deployment guide
- `README_BACK4APP.md` - Back4App-specific documentation

**Note:** The app defaults to Electron desktop mode. Web deployment is optional.

## 🔧 Development

### Development Mode
```bash
npm run dev
```

This starts:
- Vite dev server on port 3000
- Hot module replacement
- Fast refresh

### Project Structure

```
.
├── electron/          # Electron main process
│   ├── main.js       # Main Electron process
│   ├── preload.js    # Preload script
│   └── build/        # Built frontend (production)
├── components/       # React components
├── services/         # Business logic services
├── server/           # Standalone server (for web deployment)
└── build/            # Web build (for Back4App)
```

## 📋 Features

- ✅ AI-powered messaging (Gemini AI)
- ✅ WhatsApp Cloud API integration
- ✅ Email integration (Gmail OAuth, Outlook OAuth, SMTP/IMAP)
- ✅ Lead management and automation
- ✅ Product catalog management
- ✅ Analytics and monitoring
- ✅ Webhook support for real-time updates
- ✅ Cloudflare Tunnel integration
- ✅ Local data storage
- ✅ Secure credential management

## 🔐 Security

- Encrypted credential storage (OS keychain)
- Secure API key management
- Webhook token verification
- Rate limiting
- Input sanitization

## 📚 Documentation

- **Setup Guides:**
  - `GET_YOUR_CALLBACK_URL_NOW.md` - Cloudflare Tunnel setup
  - `WHATSAPP_WEBHOOK_FIELDS.md` - WhatsApp webhook configuration
  - `AZURE_URL_UPDATE_INSTRUCTIONS.md` - Azure OAuth setup

- **Deployment:**
  - `BACK4APP_QUICK_START.md` - Web deployment (optional)
  - `DEPLOYMENT.md` - General deployment guide

## 🆘 Troubleshooting

### App won't start
- Check Node.js version: `node --version` (must be >= 18.0.0)
- Check logs in app user data directory
- Try: `npm install` again

### Server port in use
- Change port in settings
- Or kill process using port 4000

### Webhooks not working
- Check Cloudflare Tunnel is running
- Verify webhook URL in Meta/WeChat settings
- Check webhook token matches

## 📝 License

ISC

## 👤 Author

User

---

**For web deployment options, see `BACK4APP_QUICK_START.md`**
