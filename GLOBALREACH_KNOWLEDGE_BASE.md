# GlobalReach - Exporter Lead Automator - Complete Knowledge Base

## Overview

GlobalReach is an AI-powered CRM that automates international importer outreach via WhatsApp and Email. Built with Electron, React, TypeScript, and integrates with Gemini AI, Google APIs, WhatsApp Cloud API, and various email providers.

**Version:** 1.0.2  
**Tech Stack:** Electron + React + TypeScript + Vite  
**AI Engine:** Google Gemini AI  
**Node.js Requirement:** >= 18.0.0

---

## Core Features

### 1. AI-Powered Messaging
- Automated WhatsApp and Email communication using Gemini AI
- Personalized messages using customer data, preferences, and service history
- Dynamic replies that adapt to customer responses
- Conversation context maintained across multi-turn conversations
- Channel adaptation for Email, WhatsApp, WeChat

### 2. Email Integration
- **Gmail OAuth 2.0**: Secure authentication with automatic token refresh
- **Outlook/SMTP/IMAP**: Manual configuration with preset support
- Full email sending/receiving capabilities
- Email threading support (In-Reply-To, References headers)
- Real-time email ingestion via polling or IMAP IDLE

### 3. WhatsApp Cloud API
- Real-time WhatsApp messaging
- Webhook support for incoming messages
- Media attachment support

### 4. Lead Management
- AI-powered lead scoring and qualification
- Automated workflows and drip campaigns
- Lead research service with 7-day caching
- Purchase pattern analysis

### 5. Analytics & Monitoring
- Performance tracking and conversion rates
- Engagement analytics
- API key usage monitoring
- Email analytics and conversion tracking

### 6. Security & Compliance
- CAN-SPAM compliance
- GDPR deletion support
- Encrypted credential storage
- Secure API key management
- Audit logging

---

## Architecture

### Electron Architecture (IPC-Based)

**Key Design Decision:** All Node.js modules (nodemailer, googleapis, imap, mailparser) are isolated in the Electron main process to prevent Vite bundling issues.

#### Main Process (electron/main.js)
- Handles all email operations via IPC handlers
- Manages server creation and window management
- Executes Node.js-only code

#### Renderer Process (React UI)
- Uses `EmailIPCService` to communicate with main process
- No direct Node.js module imports
- All email operations route through IPC

#### IPC Handlers
- `email-test-connection`: Test email credentials
- `email-send-smtp`: Send email via SMTP
- `email-send-gmail`: Send email via Gmail API
- `email-read-imap`: Read emails via IMAP
- `email-read-gmail`: Read emails via Gmail API
- `email-get-connection`: Get current email connection

### Project Structure

```
├── components/              # React UI components
│   ├── PlatformConnectModal.tsx  # Email/WhatsApp connection UI
│   ├── AnalyticsDashboard.tsx
│   ├── CampaignManager.tsx
│   └── ...
├── services/               # Business logic (renderer side)
│   ├── emailIPCService.ts      # IPC wrapper for email operations
│   ├── emailTypes.ts           # TypeScript types (types only)
│   ├── emailSendingService.ts
│   ├── emailIngestionService.ts
│   ├── geminiService.ts        # AI message generation
│   ├── messagingService.ts
│   └── ...
├── electron/              # Electron main process
│   ├── main.js           # Main process with IPC handlers
│   ├── preload.js        # Context bridge for IPC
│   └── services/
│       └── emailService.js    # Node.js email logic (main process only)
└── types.ts              # Shared TypeScript definitions
```

---

## Email Service Architecture

### Email Service Location
- **Renderer Side:** `services/emailIPCService.ts` (IPC wrapper only)
- **Main Process:** `electron/services/emailService.js` (actual implementation)

### Email Providers Supported

1. **Gmail (OAuth 2.0)**
   - Uses Google APIs (googleapis package)
   - OAuth token refresh with automatic retry
   - Scopes: `gmail.modify`, `userinfo.email`, `userinfo.profile`

2. **Outlook/SMTP/IMAP**
   - SMTP for sending (nodemailer)
   - IMAP for receiving (imap package + mailparser)
   - Preset configurations for Outlook.com, Gmail, Yahoo

### Email Flow

**Sending:**
1. Renderer calls `EmailIPCService.sendViaSMTP()` or `sendViaGmail()`
2. IPC message sent to main process
3. Main process calls `EmailService` methods
4. Result returned via IPC

**Receiving:**
1. Main process polls Gmail API or connects via IMAP IDLE
2. New emails trigger callbacks
3. Emails classified, routed, and displayed in UI

---

## Configuration

### Email Setup

#### Gmail OAuth Setup
1. Create Google Cloud Project
2. Enable Gmail API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials (Client ID, Client Secret)
5. Add redirect URI: `http://localhost:4000/auth/oauth/callback`

#### Outlook SMTP/IMAP Setup
**Preset Configuration (Outlook.com):**
- SMTP Host: `smtp-mail.outlook.com`
- SMTP Port: `587` (STARTTLS)
- IMAP Host: `outlook.office365.com`
- IMAP Port: `993` (SSL/TLS)

**Steps:**
1. Go to Settings → Platforms → Email → Connect
2. Click "Outlook.com" preset button (auto-fills settings)
3. Enter email and password
4. Test connection

### WhatsApp Setup
1. Settings → Integrations → WhatsApp → Connect
2. Enter WhatsApp Cloud API credentials:
   - Access Token
   - Phone Number ID
   - Business Account ID
   - Webhook Verify Token

### API Keys (Gemini AI)
1. Settings → API Keys
2. Add Gemini API key
3. Key optimization automatically selects best key based on:
   - Error rates
   - Response times
   - Usage limits
   - Throttling detection

---

## Implementation Status

### ✅ Completed Features

1. **API Key Management**
   - Full lifecycle management
   - Intelligent key selection and load balancing
   - Secure encrypted storage
   - Usage tracking and monitoring

2. **AI-Driven Messaging**
   - Personalized messages with customer data
   - Dynamic replies maintaining conversation context
   - Multi-channel support (Email, WhatsApp, WeChat)
   - Brand voice consistency

3. **Self-Tuning AI**
   - Optimization service analyzing successful/failed interactions
   - Template improvement suggestions
   - Pattern analysis and extraction
   - Automated suggestions for intro templates

4. **Lead Research**
   - Deep lead research with 7-day caching
   - Industry analysis, pain points, opportunities
   - Personalization tips
   - Integration with message generation

5. **Knowledge Base**
   - Effective conversation snippet storage
   - Template effectiveness tracking
   - Automatic snippet extraction
   - Effectiveness scoring

6. **Automated Self-Tuning**
   - Scheduled optimization
   - Continuous learning from conversations
   - Auto-apply improvements option

### 🚧 Future Enhancements

1. External data enrichment (LinkedIn, company websites)
2. Manual override UI components
3. Enhanced compliance (CCPA, data anonymization)
4. Real-time monitoring dashboard
5. Human escalation workflows

---

## Technical Implementation Details

### Email Service IPC Pattern

**Renderer Side (emailIPCService.ts):**
```typescript
export const EmailIPCService = {
  testConnection: async (credentials) => {
    return await (window as any).electronAPI.testEmailConnection(credentials);
  },
  sendViaSMTP: async (credentials, options) => {
    return await (window as any).electronAPI.sendEmailSMTP(credentials, options);
  },
  // ... other methods
};
```

**Main Process (electron/main.js):**
```javascript
ipcMain.handle('email-test-connection', async (event, credentials) => {
  const EmailService = require('./services/emailService');
  return await EmailService.testConnection(
    credentials,
    getConfig,
    loadPlatformConnectionsFromMain,
    savePlatformConnectionsToMain
  );
});
```

### Secure Storage

All sensitive data encrypted using `PlatformService.secureSave()`:
- Email credentials
- API keys
- OAuth tokens
- Platform connections

### Error Handling

- Automatic OAuth token refresh on 401/403 errors
- Exponential backoff retry logic
- Comprehensive error logging
- User-friendly error messages

---

## Dependencies

### Key Packages
- **Electron:** ^29.4.6
- **React:** ^18.3.1
- **TypeScript:** ^5.2.2
- **Vite:** ^5.4.21
- **googleapis:** ^166.0.0 (Gmail OAuth)
- **nodemailer:** ^7.0.10 (SMTP)
- **imap:** ^0.8.19 (IMAP)
- **mailparser:** ^3.6.5 (Email parsing)
- **@google/genai:** ^1.30.0 (Gemini AI)
- **express:** ^4.21.2 (Local server)

---

## Development

### Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm start
   ```
   - Starts Electron with Vite dev server
   - Hot-reload enabled

3. **Build for production:**
   ```bash
   npm run build:react  # Build React app
   npm run build        # Build Electron app
   ```

### Environment Variables

Create `.env.local`:
```
API_KEY=your_gemini_api_key
```

---

## Deployment

### GitHub Deployment
- Automatic deployment via GitHub Actions
- Builds on push to `main` branch
- Creates releases when tags are pushed

### Build Scripts
- `npm run build:react` - Build React app
- `npm run build` - Build Electron app
- `npm run build:installer` - Create installer
- `npm run deploy` - Build and push to GitHub

---

## Troubleshooting

### Common Issues

1. **"Failed to resolve module specifier 'nodemailer'"**
   - Fixed: Email service moved to main process, all operations via IPC
   - Renderer never imports Node.js modules directly

2. **Email Connection Test Fails**
   - Verify server addresses and ports
   - Check password/app password
   - Ensure firewall allows connections
   - Test in Outlook desktop app first

3. **OAuth Token Refresh Issues**
   - Check Client ID and Client Secret
   - Verify redirect URI matches exactly
   - Ensure scopes are correct

---

## Key Services

### Email Services
- `EmailIPCService` - IPC wrapper for email operations
- `EmailSendingService` - Template application, personalization
- `EmailIngestionService` - Email reading and polling
- `EmailClassificationService` - Spam detection, categorization
- `EmailAnalyticsService` - Tracking and metrics

### AI Services
- `GeminiService` - AI message generation
- `LeadResearchService` - Lead analysis and research
- `PersonalizedMessageService` - Message personalization

### Management Services
- `ApiKeyService` - API key management
- `PlatformService` - Platform connection storage
- `OptimizationService` - AI optimization
- `SelfTuningService` - Automated tuning loop

---

## Important Notes

1. **IPC Architecture**: All email operations MUST go through IPC to avoid Vite bundling issues
2. **Type Safety**: Use `emailTypes.ts` for types, never import runtime code
3. **Secure Storage**: Always use `PlatformService.secureSave` for sensitive data
4. **Error Handling**: Implement retry logic with exponential backoff
5. **Token Refresh**: OAuth tokens automatically refresh on 401/403 errors

---

## Contact & Support

**Repository:** https://github.com/milanvijay6/globalreach-exporter-lead-automator  
**License:** ISC  
**Node.js:** >= 18.0.0 required

---

*Last Updated: November 2024*  
*Version: 1.0.2*

