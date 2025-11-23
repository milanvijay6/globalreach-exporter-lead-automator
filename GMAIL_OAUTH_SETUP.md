# Gmail OAuth 2.0 Setup Guide

This guide walks you through setting up Gmail OAuth 2.0 authentication for the GlobalReach application.

## Prerequisites

- A Google account (Gmail account)
- Access to Google Cloud Console (https://console.cloud.google.com)
- Basic understanding of OAuth 2.0 concepts

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter a project name (e.g., "GlobalReach Gmail Integration")
5. Click **"Create"**
6. Wait for the project to be created and select it from the dropdown

## Step 2: Enable Gmail API

1. In the Google Cloud Console, navigate to **"APIs & Services" > "Library"**
2. Search for **"Gmail API"**
3. Click on **"Gmail API"** from the results
4. Click **"Enable"**
5. Wait for the API to be enabled (may take a few moments)

## Step 3: Configure OAuth Consent Screen

1. Navigate to **"APIs & Services" > "OAuth consent screen"**
2. Choose **"External"** user type (unless you have a Google Workspace organization)
3. Click **"Create"**
4. Fill in the required information:
   - **App name**: GlobalReach (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **"Save and Continue"**
6. On the **Scopes** page:
   - Click **"Add or Remove Scopes"**
   - Search for and add the following scopes:
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Click **"Update"** then **"Save and Continue"**
7. On the **Test users** page (for development):
   - Add your Gmail address as a test user
   - Click **"Save and Continue"**
8. Review and click **"Back to Dashboard"**

## Step 4: Create OAuth 2.0 Credentials

1. Navigate to **"APIs & Services" > "Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. If prompted, choose **"Web application"** as the application type
5. Fill in the OAuth client configuration:
   - **Name**: GlobalReach Desktop App (or your preferred name)
   - **Authorized redirect URIs**: 
     - Click **"+ ADD URI"**
     - Add: `http://localhost:4000/auth/oauth/callback`
     - (Note: The port may vary. Check your app's server port in Settings or logs)
   - **Authorized JavaScript origins**: 
     - Click **"+ ADD URI"**
     - Add: `http://localhost:4000`
6. Click **"Create"**
7. **IMPORTANT**: A dialog will appear showing your credentials:
   - **Client ID**: Copy this value (you'll need it for the app)
   - **Client Secret**: Copy this value (you'll need it for the app)
   - **Note**: The Client Secret will only be shown once. Save it securely.

## Step 5: Configure the Application

1. Open GlobalReach application
2. Go to **Settings** > **API Keys** (or **Integrations**)
3. Find the **Gmail OAuth Configuration** section
4. Enter the following:
   - **Client ID**: Paste the Client ID from Step 4
   - **Client Secret**: Paste the Client Secret from Step 4
   - **Redirect URI**: `http://localhost:4000/auth/oauth/callback` (or the port your app uses)
5. Click **"Save"**

## Step 6: Test the Connection

1. In GlobalReach, go to **Settings** > **Platforms** (or **Integrations**)
2. Click **"Connect"** next to Email
3. Select **"Gmail"** as the provider
4. Enter your Gmail address
5. Click **"Connect with Gmail"**
6. A browser window will open asking for permissions:
   - Review the permissions being requested
   - Click **"Allow"** to grant access
7. You should be redirected back to the app
8. The connection should now be established

## Required Scopes

The application requests the following OAuth scopes:

- `https://www.googleapis.com/auth/gmail.modify` - Read, send, and modify emails
- `https://www.googleapis.com/auth/userinfo.email` - View your email address
- `https://www.googleapis.com/auth/userinfo.profile` - View your basic profile info

## Redirect URI Configuration

The redirect URI must match exactly in both places:
- **Google Cloud Console**: In your OAuth 2.0 Client ID settings
- **Application**: In your OAuth configuration

Default redirect URI: `http://localhost:4000/auth/oauth/callback`

If your application runs on a different port, update both locations accordingly.

## Security Best Practices

1. **Never share your Client Secret** publicly or commit it to version control
2. **Store credentials securely** - Use the app's secure storage features
3. **Use environment-specific credentials** for development and production
4. **Rotate credentials** if you suspect they've been compromised
5. **Monitor API usage** in Google Cloud Console regularly

## Troubleshooting

### "redirect_uri_mismatch" Error

- **Problem**: The redirect URI doesn't match what's configured in Google Cloud Console
- **Solution**: 
  1. Check the exact redirect URI in your app settings
  2. Ensure it matches exactly (including protocol, host, port, and path) in Google Cloud Console
  3. Note: `http://localhost:4000/auth/oauth/callback` is case-sensitive

### "invalid_client" Error

- **Problem**: Client ID or Client Secret is incorrect
- **Solution**:
  1. Verify the Client ID and Client Secret are correct
  2. Ensure there are no extra spaces when copying/pasting
  3. Re-create credentials in Google Cloud Console if needed

### "access_denied" Error

- **Problem**: User denied permissions or OAuth consent screen not configured
- **Solution**:
  1. Ensure the OAuth consent screen is properly configured
  2. Add your Gmail address as a test user (for development)
  3. Try the authentication flow again and grant all requested permissions

### Token Refresh Issues

- **Problem**: Tokens expire and can't be refreshed
- **Solution**:
  1. Ensure `access_type: 'offline'` is used (already configured)
  2. Ensure `prompt: 'consent'` is used to get refresh tokens (already configured)
  3. Re-authenticate if refresh token is lost

### Port Already in Use

- **Problem**: The redirect URI port is already in use
- **Solution**:
  1. Check which port the app is using (check logs or Settings)
  2. Update the redirect URI in Google Cloud Console to match the actual port
  3. Restart the application

## Production Considerations

When moving to production:

1. **Publish your OAuth consent screen**:
   - Go to "OAuth consent screen" in Google Cloud Console
   - Complete all required sections
   - Submit for verification if requesting sensitive scopes

2. **Use environment-specific credentials**:
   - Create separate OAuth credentials for development and production
   - Use different redirect URIs if needed

3. **Monitor API quotas**:
   - Check "APIs & Services" > "Dashboard" for quota usage
   - Gmail API has daily quotas that may need adjustment

## API Limits

Gmail API has the following limits:

- **Quota**: Default is 1 billion quota units per day
- **Rate limits**: Vary by operation (check Gmail API documentation)
- **Request size**: Maximum 35MB per request

## Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google Cloud Console](https://console.cloud.google.com)
- [OAuth 2.0 Scopes for Gmail API](https://developers.google.com/gmail/api/auth/scopes)

## Support

If you encounter issues not covered in this guide:

1. Check the application logs for detailed error messages
2. Review Google Cloud Console logs under "APIs & Services" > "Dashboard"
3. Ensure all steps above were completed correctly
4. Verify your Google account has the necessary permissions

