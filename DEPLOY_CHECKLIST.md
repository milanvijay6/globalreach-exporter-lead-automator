# Back4App Deployment Checklist

## Pre-Deployment

- [ ] Back4App account created
- [ ] Back4App app created
- [ ] Parse credentials obtained (Application ID, JavaScript Key, Master Key)
- [ ] Environment variables prepared
- [ ] Frontend built (`npm run build:web`)
- [ ] Git repository ready (if using Git deployment)

## Environment Variables Setup

Set these in Back4App dashboard → App Settings → Environment Variables:

- [ ] `PARSE_APPLICATION_ID` - Your Back4App Application ID
- [ ] `PARSE_JAVASCRIPT_KEY` - Your Back4App JavaScript Key  
- [ ] `PARSE_MASTER_KEY` - Your Back4App Master Key
- [ ] `PARSE_SERVER_URL` - `https://parseapi.back4app.com/`
- [ ] `NODE_ENV` - `production`
- [ ] `ENCRYPTION_KEY_SECRET` - Generated random secret
- [ ] `ENCRYPTION_KEY_SALT` - Generated random salt
- [ ] `WEBHOOK_TOKEN` - Your webhook verification token
- [ ] `BASE_URL` - Will be auto-set by Back4App (or set manually)

## Deployment Steps

- [ ] Code pushed to Git repository (if using Git)
- [ ] Back4App connected to Git repository (if using Git)
- [ ] Build command set: `npm install && npm run build:web`
- [ ] Start command set: `npm start`
- [ ] Deployment triggered
- [ ] Deployment successful (check logs)

## Post-Deployment

- [ ] App accessible at Back4App URL
- [ ] Health check working: `/api/health`
- [ ] Parse database classes created (or will be auto-created)
- [ ] Data migrated (if applicable): `npm run migrate:parse`

## Webhook Configuration

- [ ] WhatsApp webhook URL updated: `https://your-app.back4app.io/webhooks/whatsapp`
- [ ] WhatsApp verify token matches `WEBHOOK_TOKEN`
- [ ] WeChat webhook URL updated (if applicable)
- [ ] Webhooks tested and working

## OAuth Configuration

- [ ] Azure redirect URI added: `https://your-app.back4app.io/api/oauth/callback`
- [ ] Gmail redirect URI added (if applicable)
- [ ] OAuth flow tested

## Testing

- [ ] Frontend loads correctly
- [ ] API endpoints respond
- [ ] Webhooks receive and process messages
- [ ] OAuth authentication works
- [ ] Database operations work
- [ ] File uploads work (if applicable)

## Monitoring

- [ ] Logs accessible in Back4App dashboard
- [ ] Error monitoring set up
- [ ] Performance monitoring enabled

## Security

- [ ] Environment variables secured (not in code)
- [ ] Master key kept secret
- [ ] Webhook tokens secure
- [ ] HTTPS enabled (automatic on Back4App)

## Documentation

- [ ] Team members have access to Back4App dashboard
- [ ] Deployment process documented
- [ ] Environment variables documented
- [ ] Troubleshooting guide available

## Rollback Plan

- [ ] Previous version tagged in Git
- [ ] Rollback procedure documented
- [ ] Backup strategy in place

---

**Need Help?**
- Quick Start: See `BACK4APP_QUICK_START.md`
- Full Guide: See `BACK4APP_DEPLOYMENT.md`
- Back4App Docs: https://www.back4app.com/docs

