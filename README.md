<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GlobalReach - Exporter Lead Automator

AI-powered CRM that automates international importer outreach via WhatsApp and Email. Features AI-powered messaging, lead scoring, automated replies, and multi-channel communication.

## Features

- 🤖 **AI-Powered Messaging** - Automated WhatsApp and Email communication using Gemini AI
- 📧 **Email Integration** - Full email sending/receiving with Gmail API and SMTP/IMAP
- 💬 **WhatsApp Cloud API** - Real-time WhatsApp messaging with webhook support
- 🎯 **Lead Scoring** - AI-powered lead qualification and conversion workflows
- 📊 **Analytics Dashboard** - Track performance, conversion rates, and engagement
- 🔄 **Automated Workflows** - Drip campaigns, follow-ups, and trigger-based automation
- 🔒 **Security & Compliance** - CAN-SPAM, GDPR compliance, secure credential storage

## Run Locally

**Prerequisites:** Node.js >= 18.0.0

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the React app:
   ```bash
   npm run build:react
   ```

3. Set your Gemini API key (optional, for AI features):
   - Create `.env.local` file
   - Add: `API_KEY=your_gemini_api_key`

4. Run the Electron app:
   ```bash
   npm start
   ```

5. For development with hot reload:
   ```bash
   npm run dev
   ```

## Deployment to GitHub

This project includes automatic deployment workflows. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

### Quick Setup

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create GitHub Repository**:
   - Go to [GitHub](https://github.com/new)
   - Create a new repository
   - Copy the repository URL

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

4. **Automatic Deployment**:
   - Every push to `main` branch triggers automatic build
   - Create a release tag to build executables:
     ```bash
     git tag v1.0.0
     git push --tags
     ```

## Project Structure

```
├── components/          # React UI components
├── services/           # Business logic services
│   ├── emailService.ts
│   ├── whatsappService.ts
│   ├── geminiService.ts
│   └── ...
├── electron/           # Electron main process
│   ├── main.js        # Main Electron process
│   └── preload.js     # Preload script
└── types.ts           # TypeScript type definitions
```

## Configuration

### WhatsApp Integration
1. Go to Settings → Integrations
2. Click "Connect" on WhatsApp
3. Enter your WhatsApp Cloud API credentials:
   - Access Token
   - Phone Number ID
   - Business Account ID
   - Webhook Verify Token

### Email Integration
1. Go to Settings → Integrations
2. Click "Connect" on Email
3. Choose provider:
   - **Gmail**: OAuth 2.0 (requires setup)
   - **Custom**: SMTP/IMAP credentials

## Documentation

- [Deployment Guide](DEPLOYMENT.md) - Detailed deployment instructions
- [WhatsApp Integration](./whatsapp-cloud-api-integration.plan.md) - WhatsApp setup guide
- [Email Integration](./whatsapp-cloud-api-integration.plan.md) - Email setup guide

## License

ISC
