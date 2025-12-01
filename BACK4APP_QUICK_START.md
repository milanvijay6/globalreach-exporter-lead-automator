# Back4App Quick Start Guide

## 🚀 Deploy in 5 Minutes

### Step 1: Create Back4App Account & App

1. Go to [https://www.back4app.com](https://www.back4app.com) and sign up
2. Click **"Create a new app"**
3. Choose **"Backend as a Service"**
4. Name: `globalreach-exporter-lead-automator`
5. Click **"Create"**

### Step 2: Get Your Parse Keys

1. In Back4App dashboard, go to **App Settings → Security & Keys**
2. Copy these values:
   - **Application ID** pN84Fu9R4Xv24p8UBl3r7Nf9r1cdCHqxaqI252iS
   - **JavaScript Key** WjEDPaX3iId5lqKm7icRhkcyD2AsGRoNMF0Me4c1
   - **Master Key**5JqCg7goUSyhLHz00KJ3GVgAL2NDRzrW7E4rwiDS
   - **Server URL** API URL: https://parseapi.back4app.com

### Step 3: Set Environment Variables

In Back4App dashboard → **App Settings → Environment Variables**, add:

```
PARSE_APPLICATION_ID=pN84Fu9R4Xv24p8UBl3r7Nf9r1cdCHqxaqI252iS
PARSE_JAVASCRIPT_KEY=WjEDPaX3iId5lqKm7icRhkcyD2AsGRoNMF0Me4c1
PARSE_MASTER_KEY=5JqCg7goUSyhLHz00KJ3GVgAL2NDRzrW7E4rwiDS
PARSE_SERVER_URL=https://parseapi.back4app.com
NODE_ENV=production
ENCRYPTION_KEY_SECRET=vijayvargiya24
ENCRYPTION_KEY_SALT=vijayvargiya24
WEBHOOK_TOKEN=globalreach_secret_token
```

**Generate secrets:**
```bash
# Generate random secrets (run in terminal)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Deploy

#### Option A: Using Git (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

2. **Connect in Back4App:**
   - Go to **App Settings → Deployment**
   - Click **"Connect GitHub"**
   - Select your repository
   - Set:
     - **Branch**: `main`
     - **Build Command**: `npm install && npm run build:web`
     - **Start Command**: `npm start`
   - Click **"Deploy"**

#### Option B: Using Back4App CLI

1. **Install CLI:**
   ```bash
   npm install -g back4app-cli
   ```

2. **Login:**
   ```bash
   back4app login
   ```

3. **Deploy:**
   ```bash
   back4app deploy
   ```

### Step 5: Update Webhook URLs

After deployment, update your webhook URLs:

1. **WhatsApp (Meta):**
   - Go to [Meta for Developers](https://developers.facebook.com)
   - Your App → Webhooks
   - Update callback URL: `https://your-app-name.back4app.io/webhooks/whatsapp`
   - Verify token: `globalreach_secret_token` (or your custom token)

2. **Azure OAuth:**
   - Azure Portal → App registrations → Your app → Authentication
   - Add redirect URI: `https://your-app-name.back4app.io/api/oauth/callback`

### Step 6: Test

1. Visit: `https://your-app-name.back4app.io`
2. Health check: `https://your-app-name.back4app.io/api/health`
3. Should return: `{"status":"ok","timestamp":"...","version":"1.0.2"}`

## ✅ Done!

Your app is now live on Back4App! 🎉

## 📝 Next Steps

- [ ] Migrate existing data using `npm run migrate:parse`
- [ ] Set up custom domain (optional)
- [ ] Configure email/WhatsApp integrations
- [ ] Test webhooks

## 🆘 Troubleshooting

**App won't start?**
- Check Back4App logs: Dashboard → Logs
- Verify all environment variables are set
- Ensure Node.js version is 18+

**Webhooks not working?**
- Verify URL is correct: `https://your-app.back4app.io/webhooks/whatsapp`
- Check `WEBHOOK_TOKEN` matches
- Review logs for errors

**Parse errors?**
- Verify Parse credentials in environment variables
- Check Parse classes exist in Database → Browser

## 📚 More Help

- Full deployment guide: See `BACK4APP_DEPLOYMENT.md`
- Back4App docs: [https://www.back4app.com/docs](https://www.back4app.com/docs)

