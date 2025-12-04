# Google Cloud Console - Redirect URI Setup for Gmail OAuth

## ❌ Error You're Seeing

```
Error 400: redirect_uri_mismatch
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy.
If you're the app developer, register the redirect URI in the Google Cloud Console.
```

## 🔍 The Problem

The redirect URI being used by your app is not registered in Google Cloud Console. The app is using:
```
https://globalreachexporterleadautomator-5fgtxjmf.b4a.run/api/oauth/callback
```

This URL needs to be added to your OAuth 2.0 Client ID in Google Cloud Console.

---

## ✅ Solution: Add Redirect URI to Google Cloud Console

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com
2. Sign in with your Google account
3. Select your project (or create one if you haven't)

### Step 2: Navigate to OAuth Credentials

1. In the left sidebar, go to **"APIs & Services"** → **"Credentials"**
2. Find your **OAuth 2.0 Client ID** (the one you're using for Gmail OAuth)
3. Click on the **Client ID** to edit it

### Step 3: Add Authorized Redirect URIs

1. Scroll down to **"Authorized redirect URIs"** section
2. Click **"+ ADD URI"** button
3. Add the following redirect URIs (add ALL of them):

#### For Back4App/Web Deployment:
```
https://globalreachexporterleadautomator-5fgtxjmf.b4a.run/api/oauth/callback
```

#### For Local Development (Electron):
```
http://localhost:4000/api/oauth/callback
```

#### For Cloudflare Worker (if configured):
```
https://your-worker.workers.dev/auth/gmail/callback
```

#### For Cloudflare Tunnel (if using):
```
https://your-tunnel-url.trycloudflare.com/api/oauth/callback
```

#### For Custom Domain (if configured):
```
https://globalreach-exporter-lead-automator.duckdns.org/api/oauth/callback
```

### Step 4: Save Changes

1. Click **"SAVE"** at the bottom
2. Wait 1-2 minutes for changes to propagate

---

## 📋 Complete List of Redirect URIs to Add

Copy and paste these into Google Cloud Console (one per line):

```
https://globalreachexporterleadautomator-5fgtxjmf.b4a.run/api/oauth/callback
http://localhost:4000/api/oauth/callback
https://globalreach-exporter-lead-automator.duckdns.org/api/oauth/callback
```

**Note:** If you have a Cloudflare Worker URL, also add:
```
https://your-worker.workers.dev/auth/gmail/callback
```

---

## 🔍 How to Find Your Current Redirect URI

The app automatically detects the redirect URI based on your environment:

1. **Back4App/Web**: Uses `window.location.origin/api/oauth/callback`
   - Current: `https://globalreachexporterleadautomator-5fgtxjmf.b4a.run/api/oauth/callback`

2. **Electron (Local)**: Uses `http://localhost:4000/api/oauth/callback`

3. **Cloudflare Worker**: Uses `https://your-worker.workers.dev/auth/gmail/callback`

4. **Cloudflare Tunnel**: Uses `https://your-tunnel-url.trycloudflare.com/api/oauth/callback`

---

## ⚠️ Important Notes

1. **Exact Match Required**: The redirect URI must match EXACTLY (case-sensitive, no trailing slashes)

2. **HTTPS vs HTTP**: 
   - Use `https://` for production/Back4App URLs
   - Use `http://` for localhost only

3. **No Trailing Slash**: 
   - ✅ `https://example.com/api/oauth/callback`
   - ❌ `https://example.com/api/oauth/callback/`

4. **Multiple URIs**: You can add multiple redirect URIs - add all environments you'll use

5. **Propagation Time**: Changes may take 1-2 minutes to take effect

---

## 🧪 Testing After Adding Redirect URI

1. Wait 1-2 minutes after saving
2. Try connecting Gmail again in your app
3. The OAuth flow should now work without the redirect_uri_mismatch error

---

## 🔄 If Back4App URL Changes

If your Back4App URL changes (e.g., after redeployment), you'll need to:

1. Check the new URL in your app (it will be shown in the error message)
2. Add the new redirect URI to Google Cloud Console
3. You can keep the old one too (doesn't hurt to have multiple)

---

## 📝 Quick Reference

**Google Cloud Console**: https://console.cloud.google.com
**Path**: APIs & Services → Credentials → Your OAuth 2.0 Client ID
**Current Redirect URI**: `https://globalreachexporterleadautomator-5fgtxjmf.b4a.run/api/oauth/callback`

---

## ✅ Checklist

- [ ] Opened Google Cloud Console
- [ ] Navigated to OAuth 2.0 Client ID
- [ ] Added Back4App redirect URI
- [ ] Added localhost redirect URI (for development)
- [ ] Added custom domain redirect URI (if applicable)
- [ ] Saved changes
- [ ] Waited 1-2 minutes
- [ ] Tested Gmail OAuth connection

