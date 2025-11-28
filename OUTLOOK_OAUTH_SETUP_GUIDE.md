# Outlook OAuth 2.0 Setup Guide

This guide will walk you through setting up Outlook OAuth 2.0 authentication for the GlobalReach Exporter Lead Automator app.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure App Registration](#azure-app-registration)
3. [Getting OAuth Credentials](#getting-oauth-credentials)
4. [Configuring Redirect URI](#configuring-redirect-uri)
5. [Required Permissions/Scopes](#required-permissionsscopes)
6. [Setting Up in the App](#setting-up-in-the-app)
7. [Testing the Connection](#testing-the-connection)
8. [Troubleshooting](#troubleshooting)
9. [Security Best Practices](#security-best-practices)

---

## Prerequisites

Before you begin, ensure you have:

- ✅ A Microsoft account (Outlook.com, Hotmail.com, Live.com) OR
- ✅ A Microsoft 365/Office 365 account (work or school account)
- ✅ Access to [Azure Portal](https://portal.azure.com)
- ✅ Admin permissions (if setting up for an organization)

---

## Azure App Registration

### Step 1: Create an Azure App Registration

1. **Navigate to Azure Portal**
   - Go to [https://portal.azure.com](https://portal.azure.com)
   - Sign in with your Microsoft account

2. **Open Azure Active Directory**
   - Click on "Azure Active Directory" in the left sidebar
   - Or search for "Azure Active Directory" in the top search bar

3. **Go to App Registrations**
   - In the left menu, click on **"App registrations"**
   - Click **"+ New registration"** button

4. **Register Your Application**
   - **Name**: Enter a descriptive name (e.g., "GlobalReach Email Automator")
   - **Supported account types**: 
     - For personal Outlook accounts: Select **"Accounts in any organizational directory and personal Microsoft accounts"**
     - For organization only: Select **"Accounts in this organizational directory only"**
   - **Redirect URI**: Leave blank for now (we'll configure this later)
   - Click **"Register"**

5. **Note Your Application (Client) ID**
   - After registration, you'll see the **Overview** page
   - Copy the **Application (client) ID** - you'll need this later
   - Also note the **Directory (tenant) ID** - you'll need this for organization accounts

---

## Getting OAuth Credentials

### Step 2: Create Client Secret

1. **Navigate to Certificates & Secrets**
   - In your app registration, click **"Certificates & secrets"** in the left menu
   - Click **"+ New client secret"**

2. **Create Secret**
   - **Description**: Enter a description (e.g., "GlobalReach App Secret")
   - **Expires**: Choose expiration period (recommended: 24 months)
   - Click **"Add"**

3. **Copy the Secret Value**
   - ⚠️ **IMPORTANT**: Copy the **Value** immediately - it will only be shown once!
   - Store it securely (you'll need it for app configuration)
   - The secret will appear in the list, but the value itself won't be shown again

### Step 3: Get Tenant ID (if needed)

- **For Personal Accounts**: Use `common` as tenant ID
- **For Organization Accounts**: 
  - Go to **Overview** in your app registration
  - Copy the **Directory (tenant) ID**
  - Or use your organization's domain (e.g., `yourcompany.onmicrosoft.com`)

---

## Configuring Redirect URI

### Step 4: Set Up Redirect URI

1. **Go to Authentication**
   - In your app registration, click **"Authentication"** in the left menu

2. **Add Platform**
   - Click **"+ Add a platform"**
   - Select **"Web"**

3. **Configure Redirect URI**
   - **Redirect URIs**: Add the following URI:
     ```
     http://localhost:4000/auth/oauth/callback
     ```
   - **Note**: Replace `4000` with your app's server port if different
   - **Implicit grant and hybrid flows**: Leave unchecked (we use authorization code flow)
   - Click **"Configure"**

4. **Save Configuration**
   - Click **"Save"** at the top of the page

---

## Required Permissions/Scopes

### Step 5: Configure API Permissions

1. **Go to API Permissions**
   - In your app registration, click **"API permissions"** in the left menu

2. **Add Microsoft Graph Permissions**
   - Click **"+ Add a permission"**
   - Select **"Microsoft Graph"**
   - Choose **"Delegated permissions"**

3. **Add Required Scopes**
   Add the following permissions:
   - ✅ `Mail.Read` - Read mail in all mailboxes
   - ✅ `Mail.Send` - Send mail as the user
   - ✅ `User.Read` - Sign in and read user profile
   - ✅ `offline_access` - Maintain access to data (for refresh tokens)

4. **Grant Admin Consent** (if required)
   - If you see a warning about admin consent:
     - Click **"Grant admin consent for [Your Organization]"**
     - Confirm the action
   - For personal accounts, consent is granted during the OAuth flow

---

## Setting Up in the App

### Step 6: Configure OAuth in GlobalReach App

1. **Open the App**
   - Launch GlobalReach Exporter Lead Automator

2. **Navigate to Settings**
   - Click the **Settings** icon in the navigation
   - Go to **"Integrations"** tab

3. **Configure OAuth Settings**
   - Scroll to **"OAuth Configuration"** section
   - Find **"Outlook/Microsoft OAuth"** settings

4. **Enter Credentials**
   - **Client ID**: Paste your Application (client) ID from Step 1
   - **Client Secret**: Paste your client secret value from Step 2
   - **Tenant ID**: 
     - For personal accounts: Enter `common`
     - For organization accounts: Enter your Directory (tenant) ID
   - **Redirect URI**: Should be pre-filled as `http://localhost:4000/auth/oauth/callback`

5. **Save Configuration**
   - Click **"Save"** to store the OAuth credentials securely

---

## Testing the Connection

### Step 7: Connect Your Outlook Account

1. **Open Platform Connect Modal**
   - Go to **Settings** > **Integrations**
   - Click **"Connect"** next to Email/Outlook

2. **Select Outlook Provider**
   - Choose **"Microsoft/Outlook"** as the email provider

3. **Enter Your Email**
   - Enter your Outlook email address
   - Click **"Continue"**

4. **OAuth Flow**
   - The app will open your default browser
   - Sign in with your Microsoft account
   - Review and accept the permissions requested
   - You'll be redirected back to the app

5. **Verify Connection**
   - The app should show **"Connected"** status
   - Test sending/receiving emails to confirm

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Invalid client" error

**Solution:**
- Verify your Client ID is correct (no extra spaces)
- Ensure the app registration is active in Azure Portal
- Check that you're using the correct tenant ID

#### Issue: "Redirect URI mismatch"

**Solution:**
- Verify the redirect URI in Azure Portal matches exactly: `http://localhost:4000/auth/oauth/callback`
- Check your app's server port (default is 4000)
- Ensure the redirect URI is configured as "Web" platform type

#### Issue: "Insufficient privileges" or permission denied

**Solution:**
- Verify all required permissions are added in Azure Portal
- For organization accounts, ensure admin consent is granted
- Check that `offline_access` permission is included

#### Issue: "Token expired" errors

**Solution:**
- The app automatically refreshes tokens, but if issues persist:
- Re-authenticate by disconnecting and reconnecting the account
- Verify the client secret hasn't expired
- Check that refresh token is being stored correctly

#### Issue: "AADSTS70011: Invalid scope"

**Solution:**
- Verify the scopes in the app match exactly:
  - `https://graph.microsoft.com/Mail.Send`
  - `https://graph.microsoft.com/Mail.Read`
  - `https://graph.microsoft.com/User.Read`
  - `offline_access`

#### Issue: Browser doesn't open for OAuth

**Solution:**
- Check if pop-up blockers are enabled
- Verify the app has permission to open external URLs
- Try manually opening the OAuth URL from the app logs

---

## Security Best Practices

### 1. **Protect Your Client Secret**
   - ⚠️ Never commit client secrets to version control
   - Store secrets in environment variables or secure storage
   - Rotate secrets regularly (before expiration)

### 2. **Use Appropriate Tenant ID**
   - For personal accounts: Use `common`
   - For organization accounts: Use specific tenant ID for better security
   - Avoid using `common` for organization accounts if possible

### 3. **Limit Redirect URIs**
   - Only add redirect URIs you actually use
   - Use `localhost` for development
   - Use HTTPS for production redirect URIs

### 4. **Monitor App Usage**
   - Regularly review app registrations in Azure Portal
   - Check for unusual activity or unauthorized access
   - Review API permission usage

### 5. **Token Security**
   - The app stores tokens securely using Electron's safeStorage
   - Tokens are encrypted and never exposed in logs
   - Refresh tokens are used automatically to maintain access

### 6. **Permission Principle of Least Privilege**
   - Only request permissions you actually need
   - Review and remove unused permissions periodically
   - Use delegated permissions (not application permissions) when possible

---

## Advanced Configuration

### Multi-Tenant Setup

If you need to support multiple organizations:

1. **Set Account Type**
   - In app registration, select **"Accounts in any organizational directory and personal Microsoft accounts"**

2. **Use Common Tenant**
   - Set tenant ID to `common` in app configuration
   - Users from any organization can authenticate

3. **Organization-Specific Setup**
   - Create separate app registrations for each organization
   - Use organization-specific tenant IDs
   - Provides better security and control

### Custom Redirect URI

If you need a custom redirect URI:

1. **Update Azure Portal**
   - Add your custom redirect URI in Authentication settings
   - Ensure it matches exactly (including protocol and port)

2. **Update App Configuration**
   - Modify the redirect URI in app settings
   - Restart the app for changes to take effect

---

## API Reference

### Required Scopes

The app requires these Microsoft Graph API scopes:

- `https://graph.microsoft.com/Mail.Read` - Read mail
- `https://graph.microsoft.com/Mail.Send` - Send mail
- `https://graph.microsoft.com/User.Read` - Read user profile
- `offline_access` - Refresh token access

### OAuth Endpoints

- **Authorization Endpoint**: 
  - Common: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
  - Tenant-specific: `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/authorize`

- **Token Endpoint**: 
  - Common: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
  - Tenant-specific: `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token`

---

## Support and Resources

### Microsoft Documentation
- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/overview)
- [OAuth 2.0 Authorization Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

### Azure Portal
- [Azure Portal](https://portal.azure.com)
- [App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)

### Troubleshooting Resources
- [Microsoft Graph Status](https://status.office.com/)
- [Azure Service Health](https://status.azure.com/status)

---

## Quick Reference Checklist

Use this checklist to ensure everything is configured correctly:

- [ ] Azure app registration created
- [ ] Application (client) ID copied
- [ ] Client secret created and value copied
- [ ] Tenant ID determined (`common` or specific)
- [ ] Redirect URI configured: `http://localhost:4000/auth/oauth/callback`
- [ ] API permissions added:
  - [ ] `Mail.Read`
  - [ ] `Mail.Send`
  - [ ] `User.Read`
  - [ ] `offline_access`
- [ ] Admin consent granted (if required)
- [ ] OAuth credentials entered in app settings
- [ ] Connection tested successfully
- [ ] Email sending/receiving verified

---

## Notes

- **Token Expiration**: Access tokens expire after 1 hour. The app automatically refreshes them using the refresh token.
- **Refresh Tokens**: Refresh tokens are long-lived and stored securely. They're used to obtain new access tokens without user interaction.
- **Multiple Accounts**: You can connect multiple Outlook accounts by repeating the connection process for each account.
- **Organization Policies**: Some organizations may have policies that restrict OAuth apps. Contact your IT administrator if you encounter restrictions.

---

**Last Updated**: 2024
**App Version**: 1.0.2








