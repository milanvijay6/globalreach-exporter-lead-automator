# Add Parse Master Key to Back4App - Quick Guide

## ✅ Your Master Key:
```
odGlTFN2QZNmerADS4WKxytfZ4wkNhxdMljNmHnE
```

## Step-by-Step Instructions:

### 1. Go to Environment Variables Tab
- In Back4App Settings page (where you are now)
- Click on the **"Environment Variables"** tab (in the navigation bar)

### 2. Add the Master Key
- Click **"Add Environment Variable"** or **"Edit"** button
- Add this variable:

**Variable Name:**
```
PARSE_MASTER_KEY
```

**Variable Value:**
```
odGlTFN2QZNmerADS4WKxytfZ4wkNhxdMljNmHnE
```

### 3. Save
- Click **Save** or **Add**
- The variable should now appear in your environment variables list

### 4. Verify All Required Variables

Make sure you have these 4 environment variables set:

1. ✅ **CLOUDFLARE_API_TOKEN** = `TMBjozKlShmeEytu93qfEYfpIZzWuix2DgVwDvpO`
2. ✅ **CLOUDFLARE_ACCOUNT_ID** = `fd11ab247a2ee76e8af41cb2b0408386`
3. ✅ **PARSE_MASTER_KEY** = `odGlTFN2QZNmerADS4WKxytfZ4wkNhxdMljNmHnE` (add this now!)
4. ⚠️ **ENABLE_AUTO_WORKER_DEPLOY** = `true` (optional, but recommended)

### 5. Redeploy Your App
- After adding the Master Key, go to **Deployments** in Back4App
- Click **Deploy** to redeploy your app
- The Cloudflare Worker should now deploy automatically!

## What Happens Next:

1. ✅ Server starts with all environment variables
2. ✅ Cloudflare Worker deployment script runs
3. ✅ Worker deploys successfully
4. ✅ Worker URL is saved to Parse Config
5. ✅ OAuth callback URL is ready to use!

## Your OAuth Callback URL Will Be:

Once deployed, your OAuth callback URL will be:
```
https://your-worker-name.your-account.workers.dev/api/oauth/callback
```

Use this URL in:
- Azure App Registration (Redirect URIs)
- Google OAuth Console
- Other OAuth providers

## Troubleshooting:

If deployment still fails:
- Check Back4App logs for error messages
- Verify all 4 environment variables are set correctly
- Make sure Cloudflare API token has "Edit" permission for Workers Scripts

---

**Quick Checklist:**
- [ ] Added `PARSE_MASTER_KEY` to Environment Variables
- [ ] Verified all 4 environment variables are set
- [ ] Redeployed the app
- [ ] Checked deployment logs for success
- [ ] Got worker URL from logs or Cloudflare Dashboard

