# Back4App Deployment

This app is configured to run on Back4App, a Backend as a Service (BaaS) platform that provides Parse Server hosting.

## Architecture

- **Frontend**: React app built with Vite, served as static files
- **Backend**: Express.js server with Parse Database integration
- **Database**: Parse Database (MongoDB) via Back4App
- **File Storage**: Back4App File Storage for product photos

## Key Features

- ✅ RESTful API endpoints
- ✅ Parse Database for data persistence
- ✅ Webhook support (WhatsApp, WeChat)
- ✅ OAuth callback handling
- ✅ Static file serving
- ✅ CORS enabled for web access

## Environment Variables

Required environment variables in Back4App:

```
PARSE_APPLICATION_ID=your_app_id
PARSE_JAVASCRIPT_KEY=your_js_key
PARSE_MASTER_KEY=your_master_key
PARSE_SERVER_URL=https://parseapi.back4app.com/
WEBHOOK_TOKEN=your_webhook_token
NODE_ENV=production
```

## Deployment

See [BACK4APP_QUICK_START.md](BACK4APP_QUICK_START.md) for detailed deployment instructions.

## API Endpoints

### Webhooks
- `GET /webhooks/whatsapp` - WhatsApp webhook verification
- `POST /webhooks/whatsapp` - WhatsApp webhook handler
- `GET /webhooks/wechat` - WeChat webhook verification
- `POST /webhooks/wechat` - WeChat webhook handler

### Products
- `GET /api/products` - List products
- `GET /api/products/:id` - Get product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/search` - Search products

### Integrations
- `GET /api/integrations/status` - Get integration status
- `POST /api/integrations/:service/authorize` - Get OAuth URL
- `GET /api/integrations/:service/callback` - OAuth callback
- `POST /api/integrations/:service/refresh` - Refresh token
- `POST /api/integrations/:service/disconnect` - Disconnect service

### Config
- `GET /api/config/:key` - Get config value
- `POST /api/config/:key` - Set config value
- `GET /api/config` - Get all config

### OAuth
- `GET /api/oauth/callback` - OAuth callback handler

## Data Models

### Config
- `key` (String) - Config key
- `value` (Any) - Config value

### Product
- `name` (String)
- `description` (String)
- `price` (Number)
- `category` (String)
- `tags` (Array)
- `photos` (Array of File objects)
- `status` (String)

### Lead
- `name` (String)
- `email` (String)
- `phone` (String)
- `company` (String)
- `status` (String)
- `notes` (String)

### Integration
- `service` (String) - 'outlook', 'whatsapp', or 'wechat'
- `tokens` (Object) - OAuth tokens
- `tokenExpiry` (Date)
- `errorMessage` (String)

### Message
- `leadId` (Pointer to Lead)
- `channel` (String)
- `content` (String)
- `status` (String)
- `timestamp` (Date)

### WebhookLog
- `channel` (String)
- `payload` (Object)
- `timestamp` (Date)

## Migration

To migrate existing data from Electron app:

```bash
npm run migrate:parse
```

This will migrate config.json data to Parse Database.

## Development

For local development:

```bash
# Install dependencies
npm install

# Set environment variables
export PARSE_APPLICATION_ID=your_app_id
export PARSE_JAVASCRIPT_KEY=your_js_key
export PARSE_MASTER_KEY=your_master_key
export PARSE_SERVER_URL=https://parseapi.back4app.com/

# Build frontend
npm run build:web

# Start server
npm start
```

## Troubleshooting

### Build fails
- Ensure all dependencies are in package.json
- Check Node.js version (18.x required)
- Review build logs

### Server won't start
- Verify all environment variables are set
- Check Parse initialization
- Review server logs

### Webhooks not working
- Verify webhook URLs are correct
- Check WEBHOOK_TOKEN matches
- Review webhook logs









