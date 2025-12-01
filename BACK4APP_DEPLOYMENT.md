# Back4App Deployment Guide

This guide explains how to deploy the GlobalReach Exporter Lead Automator to Back4App.

## Prerequisites

1. **Back4App Account**: Sign up at [https://www.back4app.com](https://www.back4app.com)
2. **Node.js**: Version 18.0.0 or higher
3. **Git**: For version control

## Step 1: Create Back4App App

1. Log in to your Back4App dashboard
2. Click "Create a new app"
3. Choose "Backend as a Service"
4. Enter app name: `globalreach-exporter-lead-automator`
5. Select "Node.js" as the runtime
6. Click "Create"

## Step 2: Configure Environment Variables

In your Back4App dashboard, go to **App Settings → Environment Variables** and add:

```
PARSE_APPLICATION_ID=your_app_id_here
PARSE_JAVASCRIPT_KEY=your_javascript_key_here
PARSE_MASTER_KEY=your_master_key_here
PARSE_SERVER_URL=https://parseapi.back4app.com/
NODE_ENV=production
PORT=4000
ENCRYPTION_KEY_SECRET=your_encryption_secret
ENCRYPTION_KEY_SALT=your_encryption_salt
WEBHOOK_TOKEN=globalreach_secret_token
BASE_URL=https://your-app-name.back4app.io
```

**Important**: 
- Get `PARSE_APPLICATION_ID`, `PARSE_JAVASCRIPT_KEY`, and `PARSE_MASTER_KEY` from Back4App dashboard → App Settings → Security & Keys
- Set `BASE_URL` to your Back4App app URL (e.g., `https://your-app-name.back4app.io`)

## Step 3: Install Dependencies

1. Navigate to the `server` directory:
   ```bash
   cd server
   npm install
   ```

2. Install root dependencies (for building frontend):
   ```bash
   cd ..
   npm install
   ```

## Step 4: Build Frontend

Build the React frontend:

```bash
npm run build:react
```

This creates the `build` directory with static files.

## Step 5: Deploy to Back4App

### Option A: Using Back4App CLI

1. Install Back4App CLI:
   ```bash
   npm install -g back4app-cli
   ```

2. Login:
   ```bash
   back4app login
   ```

3. Deploy:
   ```bash
   back4app deploy
   ```

### Option B: Using Git

1. Initialize git (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Back4App deployment"
   ```

2. In Back4App dashboard:
   - Go to **App Settings → Deployment**
   - Connect your Git repository
   - Set build command: `cd server && npm install && cd .. && npm run build:react`
   - Set start command: `cd server && node index.js`
   - Set root directory: `/`

3. Deploy from Back4App dashboard

## Step 6: Configure Parse Database Schema

After deployment, you need to create the Parse classes in Back4App:

1. Go to **Database → Browser** in Back4App dashboard
2. Create the following classes (they will be created automatically when first used, or create them manually):

   - **Config** (fields: `key` String, `value` Any)
   - **Product** (fields: `name` String, `description` String, `category` String, etc.)
   - **Lead** (fields: `name` String, `email` String, `phone` String, etc.)
   - **Integration** (fields: `service` String, `accessToken` String, `refreshToken` String, etc.)
   - **Message** (fields: `leadId` String, `channel` String, `content` String, etc.)
   - **WebhookLog** (fields: `channel` String, `payload` Object, `processed` Boolean, etc.)

## Step 7: Migrate Existing Data

If you have existing data from the Electron app:

1. Export your `config.json` file
2. Run the migration script:
   ```bash
   node scripts/migrate-to-parse.js path/to/config.json
   ```

   Make sure to set environment variables:
   ```bash
   export PARSE_APPLICATION_ID=your_app_id
   export PARSE_MASTER_KEY=your_master_key
   export PARSE_SERVER_URL=https://parseapi.back4app.com/
   ```

## Step 8: Update Webhook URLs

After deployment, update your webhook URLs:

1. **WhatsApp Webhooks**:
   - Go to Meta for Developers → Your App → Webhooks
   - Update callback URL to: `https://your-app-name.back4app.io/webhooks/whatsapp`
   - Verify token: Use the `WEBHOOK_TOKEN` you set in environment variables

2. **WeChat Webhooks**:
   - Update callback URL in WeChat Official Account settings
   - URL: `https://your-app-name.back4app.io/webhooks/wechat`

3. **Azure OAuth**:
   - Go to Azure Portal → App registrations → Your app → Authentication
   - Add redirect URI: `https://your-app-name.back4app.io/api/oauth/callback`

## Step 9: Test Deployment

1. Visit your app: `https://your-app-name.back4app.io`
2. Check health endpoint: `https://your-app-name.back4app.io/api/health`
3. Test webhooks by sending a test message
4. Test OAuth flow by connecting an email account

## Troubleshooting

### Server won't start
- Check Back4App logs in dashboard
- Verify all environment variables are set
- Ensure Node.js version is 18.0.0 or higher

### Webhooks not working
- Verify webhook URLs are correct
- Check `WEBHOOK_TOKEN` matches in both Back4App and Meta/WeChat
- Check Back4App logs for errors

### OAuth not working
- Verify `BASE_URL` environment variable is set correctly
- Check redirect URIs in Azure/Google OAuth settings
- Ensure OAuth callback URL matches exactly

### Parse errors
- Verify Parse credentials in environment variables
- Check Parse database classes exist
- Review Back4App logs for Parse errors

## Additional Configuration

### Custom Domain

1. In Back4App dashboard, go to **App Settings → Custom Domain**
2. Add your custom domain
3. Update DNS records as instructed
4. Update `BASE_URL` environment variable

### SSL Certificate

Back4App provides SSL certificates automatically. No additional configuration needed.

### Scaling

Back4App automatically scales your app based on traffic. For higher limits, upgrade your plan in Back4App dashboard.

## Support

For issues specific to:
- **Back4App**: Check [Back4App Documentation](https://www.back4app.com/docs)
- **Parse**: Check [Parse Documentation](https://docs.parseplatform.org)
- **This App**: Check the main README.md

