# How to Get Cloudflare API Key and Account ID

This guide will help you get the Cloudflare API token and Account ID needed to deploy the OAuth callback proxy worker.

## Step 1: Sign in to Cloudflare

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign in with your Cloudflare account (or create one if you don't have one - it's free!)

## Step 2: Get Your Account ID

1. After logging in, select any domain from your dashboard (or create a free domain if you don't have one)
2. On the right sidebar, you'll see your **Account ID** listed
3. Copy this ID - you'll need it for the `CLOUDFLARE_ACCOUNT_ID` environment variable

**Alternative method:**
- Go to the Workers & Pages section
- Your Account ID is displayed at the top of the page

## Step 3: Create an API Token

1. Click on your profile icon (top right) → **My Profile**
2. Go to the **API Tokens** tab
3. Click **Create Token**
4. Click **Create Custom Token** (or use the **Edit Cloudflare Workers** template)

### Recommended Permissions:

If creating a custom token, use these settings:

**Permissions:**
- **Account** → **Cloudflare Workers** → **Edit**
- **Account** → **Workers Scripts** → **Edit**
- **Zone** → **Zone Settings** → **Read** (optional, for domain management)

**Account Resources:**
- Include → **All accounts** (or select your specific account)

**Zone Resources:**
- Include → **All zones** (or specific zones if you prefer)

5. Click **Continue to summary**
6. Review the permissions and click **Create Token**
7. **IMPORTANT:** Copy the token immediately - you won't be able to see it again!
   - It will look like: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 4: Set Environment Variables

### For Back4App Deployment:

1. Go to your Back4App dashboard
2. Navigate to **App Settings** → **Environment Variables**
3. Add these environment variables:

```
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

### For Local Development:

Create a `.env` file in your project root:

```env
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

**⚠️ Security Note:** Never commit your API token to Git! Add `.env` to your `.gitignore` file.

## Step 5: Verify Setup

After setting the environment variables, you can test the deployment:

1. The worker will be automatically deployed when you:
   - Deploy to Back4App (if `ENABLE_AUTO_WORKER_DEPLOY=true` is set)
   - Or manually via the Settings modal in your app

2. Check the deployment logs to verify it worked

## Troubleshooting

### "Invalid API Token" Error
- Make sure you copied the entire token (no spaces or line breaks)
- Verify the token hasn't expired (tokens don't expire, but check if it was deleted)
- Ensure the token has the correct permissions

### "Account ID not found" Error
- Double-check you copied the Account ID correctly
- Make sure you're using the Account ID, not a Zone ID

### Worker Deployment Fails
- Verify both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set
- Check that Wrangler CLI is installed (it's installed automatically in the Docker build)
- Review the deployment logs for specific error messages

## What the Worker Does

The Cloudflare Worker acts as a permanent OAuth callback proxy:
- Provides a stable HTTPS URL for OAuth redirects
- Forwards OAuth callbacks to your Back4App server
- Solves the problem of Back4App preview URLs expiring after 1 hour

## Worker URL Format

Once deployed, your worker will be available at:
```
https://your-worker-name.your-account.workers.dev
```

This URL is permanent and won't expire, making it perfect for OAuth redirect URIs in Azure/Microsoft, Google, etc.

## Need Help?

- Cloudflare API Token Docs: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Wrangler CLI Docs: https://developers.cloudflare.com/workers/wrangler/

