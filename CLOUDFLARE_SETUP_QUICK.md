# Quick Cloudflare Setup for Your App

## ✅ What You Have:
- **Account ID**: `fd11ab247a2ee76e8af41cb2b0408386`
- **Zone ID**: `434f7b95819b4afe3fad1e08c4669be9` (optional, not needed for Workers)

## ⚠️ What You Still Need:
- **API Token** (you need to create this)

---

## Step 1: Create API Token

1. Go to [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Click **Create Custom Token**

### Token Settings:

**Token Name:** `GlobalReach Worker Deployment`

**Permissions:**
- **Account** → **Cloudflare Workers** → **Edit**
- **Account** → **Workers Scripts** → **Edit**

**Account Resources:**
- Include → **All accounts** (or select your specific account)

**Zone Resources:**
- Include → **All zones** (or leave blank - not needed for Workers)

4. Click **Continue to summary**
5. Click **Create Token**
6. **⚠️ COPY THE TOKEN IMMEDIATELY** - it looks like:
   ```
   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   You won't be able to see it again!

---

## Step 2: Set Environment Variables in Back4App

1. Go to your Back4App dashboard
2. Navigate to: **App Settings** → **Environment Variables** (or **Core Settings** → **Environment Variables**)
3. Add these two environment variables:

### Variable 1:
```
Name:  CLOUDFLARE_API_TOKEN
Value: [paste your API token here]
```

### Variable 2:
```
Name:  CLOUDFLARE_ACCOUNT_ID
Value: fd11ab247a2ee76e8af41cb2b0408386
```

4. Click **Save** or **Add** for each variable

---

## Step 3: Deploy Worker (Optional - Auto or Manual)

### Option A: Auto-Deploy on Server Start
Add this environment variable:
```
Name:  ENABLE_AUTO_WORKER_DEPLOY
Value: true
```

The worker will automatically deploy when your Back4App server starts.

### Option B: Manual Deploy via Settings
1. Open your app
2. Go to **Settings**
3. Find the **Cloudflare Worker** section
4. Click **Deploy Worker**

---

## Step 4: Verify Deployment

After deployment, check:
1. Go to Cloudflare Dashboard → **Workers & Pages**
2. You should see a worker named something like: `shreenathji-oauth-worker` or `globalreach-oauth-worker`
3. Click on it to see the URL: `https://your-worker-name.your-account.workers.dev`

---

## Your OAuth Callback URL

Once deployed, your OAuth callback URL will be:
```
https://your-worker-name.your-account.workers.dev/api/oauth/callback
```

Use this URL in:
- Azure App Registration (Redirect URIs)
- Google OAuth Console
- Other OAuth providers

---

## Troubleshooting

### "Invalid API Token" Error
- Make sure you copied the entire token (no spaces)
- Verify the token has **Edit** permissions for Workers
- Check that the token hasn't been deleted

### "Account ID not found" Error
- Verify: `fd11ab247a2ee76e8af41cb2b0408386` is correct
- Make sure there are no extra spaces

### Worker Not Deploying
- Check Back4App logs for error messages
- Verify both environment variables are set correctly
- Try manual deployment from Settings

---

## Quick Checklist

- [ ] Created API Token in Cloudflare
- [ ] Copied API Token (saved securely)
- [ ] Added `CLOUDFLARE_API_TOKEN` to Back4App
- [ ] Added `CLOUDFLARE_ACCOUNT_ID` to Back4App
- [ ] (Optional) Added `ENABLE_AUTO_WORKER_DEPLOY=true`
- [ ] Deployed worker (auto or manual)
- [ ] Got worker URL from Cloudflare Dashboard
- [ ] Updated OAuth redirect URIs with worker URL

---

## Need Help?

If you encounter issues:
1. Check Back4App deployment logs
2. Check Cloudflare Dashboard → Workers & Pages for errors
3. Verify environment variables are set correctly in Back4App

