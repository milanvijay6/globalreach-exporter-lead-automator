# GlobalReach - Back4App Deployment

This app is configured for deployment on Back4App.

## Quick Deploy

See `BACK4APP_QUICK_START.md` for a 5-minute deployment guide.

## Project Structure

```
.
├── server/              # Backend Express server
│   ├── index.js        # Main server entry point
│   ├── config/         # Configuration files
│   ├── models/         # Parse database models
│   ├── services/       # Business logic services
│   ├── routes/         # API route handlers
│   └── middleware/     # Express middleware
├── build/              # Frontend build (created by npm run build:web)
├── components/         # React components
├── services/           # Frontend services
└── package.json        # Root package.json
```

## Environment Variables Required

Set these in Back4App dashboard → App Settings → Environment Variables:

- `PARSE_APPLICATION_ID` - Your Back4App Application ID
- `PARSE_JAVASCRIPT_KEY` - Your Back4App JavaScript Key
- `PARSE_MASTER_KEY` - Your Back4App Master Key
- `PARSE_SERVER_URL` - Usually `https://parseapi.back4app.com/`
- `ENCRYPTION_KEY_SECRET` - Random secret for encryption
- `ENCRYPTION_KEY_SALT` - Random salt for encryption
- `WEBHOOK_TOKEN` - Token for webhook verification
- `BASE_URL` - Your app URL (auto-set by Back4App)

## Build Commands

```bash
# Build frontend for web deployment
npm run build:web

# Start server locally
npm start

# Start server in development mode
npm run start:dev
```

## Deployment

Back4App will automatically:
1. Run `npm install` to install dependencies
2. Run `npm run build:web` to build frontend
3. Run `npm start` to start the server

## Database Schema

The app uses Parse Database with these classes:
- `Config` - Application configuration
- `Product` - Product catalog
- `Lead` - Customer/lead information
- `Integration` - OAuth tokens and integrations
- `Message` - Messages/conversations
- `WebhookLog` - Webhook event logs

These are created automatically on first use, or you can create them manually in Back4App dashboard → Database → Browser.

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/products` - List products
- `GET /api/integrations/status` - Get integration status
- `POST /api/integrations/:service/authorize` - Get OAuth URL
- `GET /api/oauth/callback` - OAuth callback handler
- `GET /webhooks/whatsapp` - WhatsApp webhook verification
- `POST /webhooks/whatsapp` - WhatsApp webhook handler

## Support

- Quick Start: `BACK4APP_QUICK_START.md`
- Full Guide: `BACK4APP_DEPLOYMENT.md`
- Back4App Docs: https://www.back4app.com/docs

