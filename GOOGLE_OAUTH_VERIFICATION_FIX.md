# Fix Google OAuth "App Not Verified" / "Testing Mode" Error

## ❌ Error You're Seeing

```
b4a.run has not completed the Google verification process. 
The app is currently being tested, and can only be accessed by developer-approved testers.
```

## 🔍 The Problem

Your Google OAuth app is in **"Testing"** mode, which means:
- Only test users you've added can access it
- The app hasn't been verified by Google
- It's not available to all users

## ✅ Solution Options

### Option 1: Add Test Users (Quick Fix - Recommended for Development)

This allows specific users to test the app without verification.

#### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com
2. Select your project
3. Go to **"APIs & Services"** → **"OAuth consent screen"**

#### Step 2: Add Test Users

1. Scroll down to **"Test users"** section
2. Click **"+ ADD USERS"**
3. Add the email addresses of users who should be able to access the app:
   - Your Gmail address (the one you want to connect)
   - Any other test users' email addresses
4. Click **"ADD"**
5. Click **"SAVE"** at the bottom

#### Step 3: Test Again

1. Wait 1-2 minutes for changes to propagate
2. Try connecting Gmail again
3. The test users you added should now be able to complete the OAuth flow

---

### Option 2: Publish the App (For Production)

If you want anyone to be able to use your app, you need to publish it. **Note:** This may require Google verification if you're requesting sensitive scopes.

#### Step 1: Complete OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Make sure all required fields are filled:
   - **App name**: Your app name
   - **User support email**: Your email
   - **Developer contact information**: Your email
   - **App domain** (optional): Your domain
   - **Authorized domains** (optional): Add your domain
   - **Application home page** (optional): Your app URL
   - **Application privacy policy link** (optional): Privacy policy URL
   - **Application terms of service link** (optional): Terms of service URL

#### Step 2: Review Scopes

1. Check the **"Scopes"** section
2. Make sure you only request the scopes you need:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

#### Step 3: Publish the App

1. Scroll to the top of the OAuth consent screen
2. Click **"PUBLISH APP"** button
3. Confirm the action
4. You may see a warning about verification - click **"CONFIRM"**

#### Step 4: Verification (If Required)

If Google requires verification:
- You'll need to submit your app for Google's verification process
- This can take several days to weeks
- Google will review your app's use of sensitive scopes
- You may need to provide:
  - Privacy policy
  - Terms of service
  - Video demonstration of your app
  - Justification for sensitive scopes

**Note:** For personal/internal use, adding test users (Option 1) is usually sufficient and faster.

---

## 🚀 Quick Fix Steps (Recommended)

### For Development/Testing:

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Navigate to**: APIs & Services → OAuth consent screen
3. **Scroll to "Test users"** section
4. **Click "+ ADD USERS"**
5. **Add your Gmail address** (the one you want to connect)
6. **Click "ADD"** then **"SAVE"**
7. **Wait 1-2 minutes**
8. **Try connecting Gmail again**

---

## 📋 Current Configuration

Based on the error message, your app is using:
- **Client ID**: `YOUR_GOOGLE_OAUTH_CLIENT_ID`
- **Redirect URI**: `https://globalreachexporterleadautomator-itb7p6h1.b4a.run/api/oauth/callback`
- **Scopes**: 
  - `https://www.googleapis.com/auth/gmail.modify`
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`

---

## ⚠️ Important Notes

1. **Test Users Only**: In Testing mode, only users you explicitly add can access the app
2. **Email Must Match**: The Gmail address you're trying to connect must be in the test users list
3. **Propagation Time**: Changes may take 1-2 minutes to take effect
4. **Verification Required**: If you publish the app, Google may require verification for sensitive scopes like Gmail access

---

## 🔄 After Adding Test Users

1. The test users you add will receive an email notification (optional)
2. They can now complete the OAuth flow
3. They'll see a warning screen but can click "Continue" to proceed
4. The app will work normally for test users

---

## 📝 Checklist

- [ ] Opened Google Cloud Console
- [ ] Navigated to OAuth consent screen
- [ ] Added test user email addresses
- [ ] Saved changes
- [ ] Waited 1-2 minutes
- [ ] Tried connecting Gmail again

---

## 🆘 Still Having Issues?

If you're still seeing the error after adding test users:

1. **Verify the email**: Make sure the email you're trying to connect is in the test users list
2. **Check spelling**: Email addresses are case-sensitive
3. **Wait longer**: Sometimes it takes 5-10 minutes for changes to propagate
4. **Clear browser cache**: Try in an incognito/private window
5. **Check OAuth consent screen status**: Make sure it's set to "Testing" or "In production"

---

## 🔗 Quick Links

- **Google Cloud Console**: https://console.cloud.google.com
- **OAuth Consent Screen**: https://console.cloud.google.com/apis/credentials/consent
- **Test Users Section**: Scroll down in OAuth consent screen

