# Azure Portal Redirect URI Verification Steps

## Current Redirect URI Configuration
- **Redirect URI**: `http://localhost:4000/auth/oauth/callback`
- **Platform Type**: Must be **"Web"** (NOT "Single-page application")
- **App Registration ID**: `YOUR_AZURE_APP_CLIENT_ID`

## Step-by-Step Verification in Azure Portal

### 1. Access Your App Registration
1. Go to https://portal.azure.com
2. Sign in with your Microsoft account
3. Search for "App registrations" in the top search bar
4. Click on "App registrations"
5. Find and click your app: **YOUR_AZURE_APP_CLIENT_ID**

### 2. Go to Authentication Section
1. In the left sidebar, click **"Authentication"**
2. Scroll down to **"Platform configurations"** section

### 3. Verify "Web" Platform Configuration
**Check the "Web" section:**
- ✅ Should show: `http://localhost:4000/auth/oauth/callback`
- ✅ Platform type should be: **"Web"**
- ✅ Status should be: Active/Configured

**If missing:**
1. Click **"+ Add a platform"**
2. Select **"Web"** (NOT "Single-page application")
3. In "Redirect URIs", enter exactly: `http://localhost:4000/auth/oauth/callback`
4. Click **"Configure"**
5. Click **"Save"** at the top

### 4. Verify "Single-page application" is EMPTY
**Check the "Single-page application" section:**
- ✅ Should be **EMPTY** or show "No redirect URIs configured"
- ❌ Should **NOT** contain `http://localhost:4000/auth/oauth/callback`

**If it contains the redirect URI:**
1. Click on the redirect URI entry
2. Click **"Remove"** or the trash icon
3. Confirm removal
4. Click **"Save"** at the top

### 5. Final Verification Checklist
- [ ] Redirect URI exists under **"Web"** platform
- [ ] Redirect URI does **NOT** exist under "Single-page application"
- [ ] Redirect URI is exactly: `http://localhost:4000/auth/oauth/callback` (no trailing slash, exact case)
- [ ] All changes are saved
- [ ] Waited 3-5 minutes for Azure to propagate changes

## Testing the Redirect URI Locally

### Option 1: Use the Test Script
1. Start your Electron app
2. Run: `node test-redirect-uri.js`
3. Should see: "✓ Endpoint is accessible and working!"

### Option 2: Manual Browser Test
1. Start your Electron app (server should be running on port 4000)
2. Open browser and go to: `http://localhost:4000/auth/oauth/callback?test=1`
3. Should see: "Authentication Error - Missing authorization code or state parameter"
4. This confirms the endpoint is working (it's expecting OAuth code/state)

### Option 3: Check Server Logs
1. Start your Electron app
2. Look for log message: "Server started on port 4000"
3. Try accessing the endpoint - should see log: "OAuth callback received"

## Common Issues

### Issue: "Cross-origin token redemption" error
**Cause**: Redirect URI is configured as "Single-page application" instead of "Web"
**Fix**: Remove from SPA, add to Web platform

### Issue: "Redirect URI mismatch" error
**Cause**: Redirect URI in Azure doesn't exactly match what's being sent
**Fix**: Verify exact match (case-sensitive, no trailing slash)

### Issue: Endpoint not accessible
**Cause**: Electron app server not running
**Fix**: Start the Electron app first, then test

## Verification Summary

✅ **Correct Configuration:**
```
Platform configurations:
├── Web
│   └── http://localhost:4000/auth/oauth/callback ✓
└── Single-page application
    └── (empty) ✓
```

❌ **Incorrect Configuration:**
```
Platform configurations:
├── Web
│   └── http://localhost:4000/auth/oauth/callback ✓
└── Single-page application
    └── http://localhost:4000/auth/oauth/callback ✗ (MUST REMOVE)
```





















