# Azure Portal Configuration Fix - Step by Step

## Problem
Azure app registration has redirect URI configured as "Single-page application" but needs to be "Web".

## Solution - Detailed Steps

### Step 1: Access Your App Registration
1. Go to https://portal.azure.com
2. Sign in
3. Search for "App registrations" in top search bar
4. Click on "App registrations"
5. Find and click your app: **649aa87d-4799-466b-ae15-078049518573**

### Step 2: Go to Authentication
1. In the left sidebar, click **"Authentication"**
2. Scroll down to **"Platform configurations"** section

### Step 3: Remove from Single-page Application (CRITICAL)
1. Look for **"Single-page application"** section
2. If you see `http://localhost:4000/auth/oauth/callback` listed there:
   - Click on the redirect URI (or the pencil/edit icon)
   - Click **"Remove"** or the trash icon
   - Confirm removal
   - **IMPORTANT**: Make sure it's completely removed from SPA

### Step 4: Add to Web Platform
1. Click **"+ Add a platform"** button
2. In the modal, select **"Web"** (NOT "Single-page application")
3. In the "Redirect URIs" field, enter exactly:
   ```
   http://localhost:4000/auth/oauth/callback
   ```
4. Click **"Configure"**
5. Click **"Save"** at the top of the page

### Step 5: Verify Configuration
After saving, verify:
- ✅ Under **"Web"** platform: `http://localhost:4000/auth/oauth/callback` exists
- ✅ Under **"Single-page application"**: Should be empty or NOT contain this URI

### Step 6: Wait for Propagation
- Azure changes can take 1-5 minutes to propagate
- Wait 2-3 minutes before trying again

### Step 7: Test Connection
1. Go back to your Electron app
2. Try connecting Outlook again

## Common Mistakes to Avoid
❌ Having the redirect URI in BOTH "Web" and "Single-page application"
❌ Only removing from SPA but not adding to Web
❌ Typo in redirect URI (must be exactly: `http://localhost:4000/auth/oauth/callback`)
❌ Not saving changes
❌ Trying immediately after saving (need to wait for propagation)

## Verification Checklist
- [ ] Removed redirect URI from "Single-page application"
- [ ] Added redirect URI to "Web" platform
- [ ] Saved all changes
- [ ] Waited 2-3 minutes
- [ ] Verified redirect URI only exists under "Web"
- [ ] Tried connecting again

## Still Not Working?
If after following all steps you still get the error:
1. Double-check the redirect URI is EXACTLY: `http://localhost:4000/auth/oauth/callback` (no trailing slash, exact case)
2. Make sure you're editing the correct app registration (649aa87d-4799-466b-ae15-078049518573)
3. Try clearing browser cache and Azure Portal cache
4. Wait 5 minutes and try again (Azure propagation can be slow)







