# Back4App Environment Variables Setup

## ✅ Your Cloudflare Credentials:

- **API Token**: `TMBjozKlShmeEytu93qfEYfpIZzWuix2DgVwDvpO`
- **Account ID**: `fd11ab247a2ee76e8af41cb2b0408386`

---

## Step-by-Step: Add to Back4App

### Method 1: Via Back4App Dashboard (Recommended)

1. **Go to Back4App Dashboard**
   - Visit: https://www.back4app.com
   - Log in to your account

2. **Navigate to Your App**
   - Click on your app: `globalreachexporterleadautomator` (or your app name)

3. **Go to Environment Variables**
   - Click on **App Settings** (or **Core Settings**)
   - Find **Environment Variables** section
   - Click **Add Environment Variable** or **Edit**

4. **Add First Variable:**
   ```
   Variable Name:  CLOUDFLARE_API_TOKEN
   Variable Value: TMBjozKlShmeEytu93qfEYfpIZzWuix2DgVwDvpO
   ```
   - Click **Save** or **Add**

5. **Add Second Variable:**
   ```
   Variable Name:  CLOUDFLARE_ACCOUNT_ID
   Variable Value: fd11ab247a2ee76e8af41cb2b0408386
   ```
   - Click **Save** or **Add**

6. **Add Third Variable (REQUIRED for Worker Deployment):**
   ```
   Variable Name:  PARSE_MASTER_KEY
   Variable Value: [Your Parse Master Key - see below how to find it]
   ```
   - This is required for the worker deployment script to access Parse Config
   - Click **Save** or **Add**

7. **Optional - Enable Auto-Deploy:**
   ```
   Variable Name:  ENABLE_AUTO_WORKER_DEPLOY
   Variable Value: true
   ```
   - This will automatically deploy the worker when the server starts

---

## ⚠️ IMPORTANT: How to Find Your Parse Master Key

The Parse Master Key is required for the worker deployment script. Here's how to find it:

### Step-by-Step Guide:

1. **Go to Back4App Dashboard**
   - Visit: https://www.back4app.com
   - Log in to your account

2. **Navigate to Your App**
   - Click on your app: `globalreachexporterleadautomator` (or your app name)

3. **Try These Locations (in order):**

   **Option A: App Settings**
   - Click **App Settings** in the left sidebar
   - Look for tabs/sections: **Security**, **Keys**, **API Keys**, or **Server Keys**
   - Click on the relevant tab to find **Master Key**

   **Option B: Core Settings**
   - Click **Core Settings** in the left sidebar
   - Look for **Security** or **Keys** section
   - Find **Master Key** listed there

   **Option C: Server Settings**
   - Click **Server Settings** in the left sidebar
   - Look for **Security** tab or **Keys** section
   - Find **Master Key**

   **Option D: Dashboard Home**
   - On the main app dashboard
   - Look for a section showing your app credentials
   - You should see: **Application ID**, **JavaScript Key**, **Master Key**

   **Option E: Settings Menu**
   - Click **Settings** (if available)
   - Look through all tabs/sections for **Security**, **Keys**, or **API**

4. **When You Find It:**
   - Look for **Master Key** or **Master Key (read-only)**
   - Click **Show**, **Reveal**, or **View** button to see the key
   - Copy the entire key (it's a long string like: `abc123def456...`)

5. **Add to Environment Variables**
   - Go to **Environment Variables** section (usually in App Settings or Core Settings)
   - Click **Add Environment Variable** or **Edit**
   - Add: `PARSE_MASTER_KEY` = [paste your master key]
   - Click **Save**

### Still Can't Find It?

- **Check Back4App Documentation**: Search for "Master Key" in their help docs
- **Contact Back4App Support**: They can guide you to the exact location
- **Check Your Email**: Sometimes Back4App sends keys in welcome emails
- **See Detailed Guide**: Check `FIND_BACK4APP_MASTER_KEY.md` for more options

---

### Method 2: Via Back4App CLI (Alternative)

If you have Back4App CLI installed:

```bash
back4app env set CLOUDFLARE_API_TOKEN=TMBjozKlShmeEytu93qfEYfpIZzWuix2DgVwDvpO
back4app env set CLOUDFLARE_ACCOUNT_ID=fd11ab247a2ee76e8af41cb2b0408386
back4app env set PARSE_MASTER_KEY=your_master_key_here
back4app env set ENABLE_AUTO_WORKER_DEPLOY=true
```

---

## Verify Setup

After adding the variables:

1. **Check Environment Variables List**
   - You should see all four variables listed:
     - `CLOUDFLARE_API_TOKEN`
     - `CLOUDFLARE_ACCOUNT_ID`
     - `PARSE_MASTER_KEY` ⚠️ **REQUIRED**
     - `ENABLE_AUTO_WORKER_DEPLOY` (optional)
   - Make sure there are no typos in the variable names

2. **Redeploy Your App** (if needed)
   - Go to **Deployments**
   - Click **Deploy** or wait for auto-deployment
   - The worker should deploy automatically if `ENABLE_AUTO_WORKER_DEPLOY=true`

3. **Check Deployment Logs**
   - Look for messages like:
     - `[Deploy Worker] Starting Cloudflare Worker deployment...`
     - `[Deploy Worker] Worker deployed successfully: https://...`

---

## What Happens Next

Once the environment variables are set and the app redeploys:

1. **Worker Auto-Deployment** (if enabled):
   - Server starts → Detects Cloudflare credentials → Deploys worker automatically

2. **Worker URL Generated**:
   - Format: `https://your-worker-name.your-account.workers.dev`
   - This URL is saved in Parse Config as `cloudflareWorkerUrl`

3. **OAuth Callback URL**:
   - Your OAuth callback will be: `https://your-worker-name.your-account.workers.dev/api/oauth/callback`
   - Use this in Azure App Registration, Google OAuth, etc.

---

## Manual Deployment (If Auto-Deploy Doesn't Work)

If you prefer to deploy manually:

1. **Via App Settings:**
   - Open your app
   - Go to **Settings** → **Cloudflare Worker** section
   - Click **Deploy Worker** button

2. **Via API:**
   ```bash
   POST /api/cloudflare-worker/deploy
   ```

---

## Security Notes

⚠️ **Important:**
- Never commit API tokens to Git
- The token is now stored securely in Back4App environment variables
- If you need to regenerate the token, create a new one in Cloudflare and update Back4App

---

## Troubleshooting

### Worker Not Deploying
- Check Back4App logs for errors
- Verify both environment variables are set correctly
- Check Cloudflare Dashboard → Workers & Pages for any errors

### "Invalid API Token" Error
- Verify the token is correct (no extra spaces)
- Check token permissions in Cloudflare Dashboard
- Make sure token hasn't been deleted

### "Account ID not found" Error
- Verify Account ID: `fd11ab247a2ee76e8af41cb2b0408386`
- Check for typos or extra spaces

### "Cannot use the Master Key, it has not been provided" Error
- ⚠️ **This means `PARSE_MASTER_KEY` is missing!**
- Go to Back4App → App Settings → Security & Keys
- Find your Master Key and add it as `PARSE_MASTER_KEY` environment variable
- Make sure the variable name is exactly: `PARSE_MASTER_KEY` (all caps, with underscores)
- Redeploy your app after adding it

---

## Next Steps

After setting up environment variables:

1. ✅ Environment variables added to Back4App
2. ⏳ Wait for deployment or trigger manual deployment
3. ⏳ Check Cloudflare Dashboard for worker URL
4. ⏳ Update OAuth redirect URIs with worker URL
5. ⏳ Test OAuth connection

---

## Quick Reference

**Environment Variables to Add:**
```
CLOUDFLARE_API_TOKEN=TMBjozKlShmeEytu93qfEYfpIZzWuix2DgVwDvpO
CLOUDFLARE_ACCOUNT_ID=fd11ab247a2ee76e8af41cb2b0408386
PARSE_MASTER_KEY=your_master_key_here (REQUIRED - find it in Back4App App Settings → Security & Keys)
ENABLE_AUTO_WORKER_DEPLOY=true (optional)
```

**Where to Add:**
- Back4App Dashboard → Your App → App Settings → Environment Variables

**What It Does:**
- Enables automatic Cloudflare Worker deployment
- Creates permanent OAuth callback URL
- Solves Back4App preview URL expiration issue

