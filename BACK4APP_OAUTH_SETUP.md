# Back4App OAuth Setup Guide

## Your App URL
```
https://globalreachexporterleadautomator-sozgszuo.b4a.run
```

## OAuth Callback URL
```
https://globalreachexporterleadautomator-sozgszuo.b4a.run/api/oauth/callback
```

---

## Azure Portal Configuration

### Step 1: Update Redirect URI in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Select your app registration (the one you're using for Outlook OAuth)
4. Click **"Authentication"** in the left sidebar
5. Scroll down to **"Platform configurations"**

### Step 2: Add Web Platform (if not already added)

1. If you don't see a **"Web"** platform, click **"+ Add a platform"**
2. Select **"Web"** (NOT "Single-page application")
3. In the **"Redirect URIs"** field, add:
   ```
   https://globalreachexporterleadautomator-sozgszuo.b4a.run/api/oauth/callback
   ```
4. Click **"Configure"**
5. Click **"Save"** at the top

### Step 3: Remove Old/localhost Redirect URIs (Optional but Recommended)

If you have `http://localhost:4000/api/oauth/callback` in your redirect URIs:
- You can keep it for local development, OR
- Remove it if you only want to use the Back4App URL

**Important**: Make sure the Back4App URL is in the **"Web"** platform section, NOT in "Single-page application".

### Step 4: Verify Configuration

After saving, verify:
- ✅ **"Web"** platform contains: `https://globalreachexporterleadautomator-sozgszuo.b4a.run/api/oauth/callback`
- ✅ **"Single-page application"** is EMPTY (or doesn't contain this URL)
- ✅ URL is exactly as shown above (no trailing slash, https://)

### Step 5: Wait for Propagation

- Wait **3-5 minutes** for Azure to propagate the changes
- Azure sometimes caches redirect URIs, so changes may take a few minutes to take effect

---

## How It Works Now

The app has been updated to **automatically detect** your Back4App URL when running in a web environment:

1. **Web Environment (Back4App)**: Automatically uses `window.location.origin` to get your app URL
2. **Electron with Tunnel**: Uses Cloudflare Tunnel URL if configured
3. **Electron without Tunnel**: Falls back to `http://localhost:4000`

This means:
- ✅ No manual configuration needed in the app
- ✅ Automatically uses the correct URL based on where it's running
- ✅ Works seamlessly on Back4App

---

## Testing

1. **Deploy your updated code** to Back4App
2. **Wait 3-5 minutes** after updating Azure Portal
3. **Open your app**: https://globalreachexporterleadautomator-sozgszuo.b4a.run
4. **Go to Settings → Integrations**
5. **Click "Connect" for Email/Outlook**
6. **Sign in with Microsoft**
7. **You should be redirected back** to your app after authentication

---

## Troubleshooting

### Error: "redirect_uri_mismatch"

**Cause**: The redirect URI in Azure doesn't match what the app is sending.

**Solution**:
1. Verify the redirect URI in Azure Portal is exactly: `https://globalreachexporterleadautomator-sozgszuo.b4a.run/api/oauth/callback`
2. Make sure it's in the **"Web"** platform, not "Single-page application"
3. Wait 3-5 minutes and try again

### Error: "Single-page Application" error

**Cause**: Azure is detecting your redirect URI as a Single-page Application.

**Solution**:
1. Remove the redirect URI from "Single-page application" section
2. Add it only to "Web" platform section
3. Save and wait 3-5 minutes

### Still redirecting to localhost

**Cause**: The app might be detecting it as Electron instead of web.

**Solution**:
1. Make sure you're accessing the app via the Back4App URL (not localhost)
2. Clear browser cache and cookies
3. Try in an incognito/private window

---

## Code Changes Made

The following files were updated to automatically detect the Back4App URL:

1. **`services/integrationService.ts`**: Updated `authorize()` method to use `window.location.origin` in web environments
2. **`components/EmailOAuthModal.tsx`**: Updated OAuth redirect URI logic to auto-detect web URL
3. **`server/routes/oauth.js`**: Improved redirect URL construction to handle production environments
4. **`App.tsx`**: Added OAuth callback detection from URL parameters
5. **`components/SettingsModal.tsx`**: Added automatic EmailOAuthModal opening on OAuth callback

---

## Next Steps

1. ✅ Update Azure Portal with the redirect URI (see Step 1-4 above)
2. ✅ Deploy the updated code to Back4App
3. ✅ Test the OAuth login flow
4. ✅ Verify Outlook email connection works

---

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check Back4App logs for server-side errors
3. Verify the redirect URI in Azure Portal matches exactly
4. Ensure you waited 3-5 minutes after updating Azure Portal


