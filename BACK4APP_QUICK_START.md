# Back4App Quick Start Guide

This guide will help you deploy GlobalReach to Back4App.

## Prerequisites

1. **Back4App Account**: Sign up at https://www.back4app.com
2. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, etc.)

## Step 1: Create Back4App App

1. Log in to Back4App dashboard
2. Click "New App"
3. Choose "Backend as a Service"
4. Enter app name: `globalreach-exporter-lead-automator`
5. Click "Create"

## Step 2: Get Parse Keys

1. In your Back4App app dashboard, go to **Server Settings** → **Security & Keys**
2. Copy the following:
   - **Application ID**
   - **JavaScript Key**
   - **Master Key** (keep this secret!)

## Step 3: Configure Environment Variables

In Back4App dashboard, go to **Server Settings** → **Environment Variables** and add:

```
PARSE_APPLICATION_ID=your_application_id_here
PARSE_JAVASCRIPT_KEY=your_javascript_key_here
PARSE_MASTER_KEY=your_master_key_here
PARSE_SERVER_URL=https://parseapi.back4app.com/
WEBHOOK_TOKEN=your_webhook_verification_token_here
NODE_ENV=production
```

## Step 4: Deploy to Back4App

### Option A: Deploy via Git (Recommended)

1. In Back4App dashboard, go to **Server Settings** → **Deployment**
2. Connect your Git repository
3. Select branch: `main`
4. Set build command: `npm install && npm run build:web`
5. Set start command: `npm start`
6. Click "Deploy"

### Option B: Deploy via Back4App CLI

```bash
# Install Back4App CLI
npm install -g back4app-cli

# Login
back4app login

# Deploy
back4app deploy
```

## Step 5: Update Webhook URLs

After deployment, Back4App will provide you with a URL like:
`https://your-app-name.b4a.app`

1. **WhatsApp Webhook URL**: `https://your-app-name.b4a.app/webhooks/whatsapp`
   - Update this in Meta for Developers → Your App → Webhooks

2. **WeChat Webhook URL**: `https://your-app-name.b4a.app/webhooks/wechat`
   - Update this in WeChat Official Account settings

## Step 6: Test the Deployment

1. Visit your app URL: `https://your-app-name.b4a.app`
2. Verify webhooks are working:
   - Test WhatsApp webhook verification
   - Test WeChat webhook verification

## Troubleshooting

### Build Fails

- Check that all dependencies are in `package.json`
- Verify Node.js version is 18.x
- Check build logs in Back4App dashboard

### App Won't Start

- Verify all environment variables are set
- Check server logs in Back4App dashboard
- Ensure `server/index.js` is the entry point

### Webhooks Not Working

- Verify webhook URLs are correct
- Check `WEBHOOK_TOKEN` matches in both app and Meta/WeChat
- Review server logs for errors

## Data Migration

If you have existing data from the Electron app:

1. Export data from Electron app (Settings → Backup)
2. Use the migration script: `npm run migrate:parse`
3. Or manually import via Back4App dashboard

## Support

For issues:
- Check Back4App documentation: https://www.back4app.com/docs
- Review server logs in Back4App dashboard
- Check GitHub issues




