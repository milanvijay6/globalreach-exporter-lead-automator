# Azure AD OAuth Setup Guide for Outlook Email

This guide will walk you through setting up Azure AD app registration to enable OAuth 2.0 authentication for Outlook email in GlobalReach.

## Prerequisites

- Microsoft account (personal or organizational)
- Access to Azure Portal (portal.azure.com)
- GlobalReach application installed and running

## Step 1: Register Application in Azure AD

### 1.1 Navigate to Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your Microsoft account
3. In the search bar at the top, type "Azure Active Directory" and select it

### 1.2 Create App Registration

1. In the left sidebar, click on **App registrations**
2. Click the **+ New registration** button at the top

### 1.3 Configure App Registration

Fill in the registration form:

- **Name**: Enter a descriptive name (e.g., "GlobalReach Email OAuth" or "My Email App")
- **Supported account types**: 
  - **Recommended**: Select **"Accounts in any organizational directory and personal Microsoft accounts"**
    - This allows both personal Outlook.com accounts and organizational Office 365 accounts
  - **Alternative options**:
    - "Accounts in this organizational directory only" - Only for your organization
    - "Personal Microsoft accounts only" - Only for personal accounts
- **Redirect URI**:
  - **Platform**: Select **Web**
  - **URI**: Enter `http://localhost:4000/auth/oauth/callback`
    - **Note**: The port number (4000) should match your GlobalReach server port. If you've changed the port in Settings, use that port number instead.

3. Click **Register**

### 1.4 Save Application IDs

After registration, you'll be taken to the app's Overview page. **Save these values** - you'll need them later:

- **Application (client) ID**: Copy this value (it's a GUID like `12345678-1234-1234-1234-123456789012`)
- **Directory (tenant) ID**: Copy this value (also a GUID)

> **Tip**: Keep these values safe. You'll enter them in GlobalReach Settings > Integrations > OAuth Configuration.

## Step 2: Create Client Secret

### 2.1 Navigate to Certificates & Secrets

1. In the left sidebar of your app registration, click **Certificates & secrets**

### 2.2 Create New Client Secret

1. Under **Client secrets**, click **+ New client secret**
2. Add a description (e.g., "GlobalReach OAuth Secret")
3. Choose an expiration period:
   - **24 months** (recommended for development)
   - **12 months** (for production)
   - **6 months** (more secure, but requires more frequent updates)
4. Click **Add**

### 2.3 Copy Client Secret Value

⚠️ **IMPORTANT**: The secret value is shown **only once**. Copy it immediately!

1. The **Value** column will show your secret (it looks like: `abc~DEF123ghi456JKL789...`)
2. Click the **Copy** icon to copy the entire secret value
3. **Save this value securely** - you'll need it for GlobalReach configuration
4. If you lose it, you'll need to create a new secret

> **Warning**: Never share your client secret publicly. Treat it like a password.

## Step 3: Configure API Permissions

### 3.1 Navigate to API Permissions

1. In the left sidebar, click **API permissions**

### 3.2 Add Microsoft Graph Permissions

1. Click **+ Add a permission**
2. Select **Microsoft Graph**
3. Select **Delegated permissions** (not Application permissions)
4. In the search box, search for and select the following permissions:
   - **`Mail.Read`** - Read user mail
   - **`Mail.Send`** - Send mail as the user
   - **`User.Read`** - Sign in and read user profile
   - **`offline_access`** - Maintain access to data (for refresh tokens)
5. Click **Add permissions**

### 3.3 Grant Admin Consent (if applicable)

- **For organizational accounts**: Click **Grant admin consent for [Your Organization]**
  - This allows all users in your organization to use the app without individual consent
  - You need administrator privileges to do this
- **For personal accounts**: Individual consent is handled during the OAuth login flow

## Step 4: Configure Redirect URI (if needed)

If you need to add or modify redirect URIs:

1. In the left sidebar, click **Authentication**
2. Under **Redirect URIs**, verify that `http://localhost:4000/auth/oauth/callback` is listed
3. If not, click **+ Add URI** and add it
4. **Platform type**: Web
5. Click **Save**

> **Note**: Make sure the port number matches your GlobalReach server port (check Settings > System tab).

## Step 5: Configure GlobalReach Application

### 5.1 Open Settings

1. Open GlobalReach application
2. Click on **Settings** (gear icon)
3. Navigate to **Integrations** tab (or **OAuth Configuration** if available)

### 5.2 Enter OAuth Credentials

Fill in the following fields:

- **Outlook Client (Application) ID**: Paste the Application (client) ID from Step 1.4
- **Outlook Client Secret**: Paste the Client Secret Value from Step 2.3
- **Outlook Tenant ID**: 
  - For personal accounts or multi-tenant: Enter `common`
  - For organizational accounts only: Enter your Directory (tenant) ID from Step 1.4
  - Leave blank to default to `common`
- **Redirect URI**: This is auto-generated based on your server port. Verify it matches what you configured in Azure AD.

### 5.3 Save Configuration

1. Click **Save OAuth Configuration**
2. You should see a success message

## Step 6: Test OAuth Connection

### 6.1 Connect Email

1. In GlobalReach, go to **Settings > Integrations** or use the **Connect** button for Email
2. Select **Sign in with Microsoft** (not IMAP/SMTP)
3. Enter your Outlook email address
4. Click **Connect** or **Sign in with Microsoft**

### 6.2 Complete OAuth Flow

1. Your default browser will open with Microsoft's login page
2. Sign in with your Outlook.com or Office 365 account
3. Review and accept the permissions requested
4. You'll be redirected back to the application
5. If successful, you'll see "Email Connected" or similar confirmation

## Troubleshooting

### Error: "Invalid client secret"

- **Cause**: The client secret was copied incorrectly or has expired
- **Solution**: 
  - Check that you copied the entire secret value (no spaces before/after)
  - Verify the secret hasn't expired (check expiration date in Azure Portal)
  - Create a new client secret if needed

### Error: "Redirect URI mismatch"

- **Cause**: The redirect URI in GlobalReach doesn't match Azure AD configuration
- **Solution**:
  - Check your server port in Settings > System
  - Verify the redirect URI in Azure AD is exactly: `http://localhost:[PORT]/auth/oauth/callback`
  - Update Azure AD redirect URI to match, or update GlobalReach port to match Azure AD

### Error: "Insufficient permissions"

- **Cause**: Required API permissions not granted
- **Solution**:
  - Verify all required permissions are added in Azure AD (Mail.Read, Mail.Send, User.Read, offline_access)
  - Grant admin consent if using organizational account
  - Try re-authenticating after adding permissions

### Error: "AADSTS50011: The redirect URI specified in the request does not match..."

- **Cause**: Redirect URI doesn't exactly match (case-sensitive, trailing slashes, etc.)
- **Solution**:
  - In Azure AD, check the exact redirect URI format
  - In GlobalReach, verify the auto-generated redirect URI matches exactly
  - Make sure there are no trailing slashes or extra characters

### Error: "AADSTS700016: Application not found in the directory"

- **Cause**: Incorrect Tenant ID or Client ID
- **Solution**:
  - Verify the Client ID is correct (copy directly from Azure Portal)
  - For personal accounts, use `common` as Tenant ID
  - For organizational accounts, verify the Tenant ID is correct

### Basic Authentication Disabled Error

- **Cause**: Microsoft has disabled basic authentication (username/password) for your account
- **Solution**: 
  - **You must use OAuth** - Select "Sign in with Microsoft" instead of IMAP/SMTP
  - This is a Microsoft security requirement and cannot be bypassed

## Personal vs Organizational Accounts

### Personal Microsoft Accounts (Outlook.com, Hotmail, Live.com)

- Use **Tenant ID**: `common`
- No admin consent required
- Individual user consent during OAuth flow

### Organizational Accounts (Office 365, Business)

- Can use specific **Tenant ID** or `common`
- Admin consent recommended for organization-wide use
- May require IT administrator approval

## Security Best Practices

1. **Never commit secrets to version control** - Store OAuth credentials securely
2. **Rotate secrets regularly** - Update client secrets before expiration
3. **Use environment variables in production** - Don't hardcode credentials
4. **Monitor app usage** - Review sign-in logs in Azure Portal regularly
5. **Limit permissions** - Only request permissions your app actually needs

## Additional Resources

- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Microsoft Graph API Reference](https://docs.microsoft.com/en-us/graph/api/overview)
- [OAuth 2.0 Authorization Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

## Quick Reference

| Item | Where to Find |
|------|---------------|
| Client (Application) ID | Azure Portal → App registrations → Your app → Overview |
| Directory (Tenant) ID | Azure Portal → App registrations → Your app → Overview |
| Client Secret | Azure Portal → App registrations → Your app → Certificates & secrets |
| Redirect URI | `http://localhost:4000/auth/oauth/callback` (or your server port) |

## Support

If you continue to experience issues after following this guide:

1. Check the GlobalReach application logs (Settings > Diagnostics)
2. Review error messages carefully - they often contain specific guidance
3. Verify all steps were completed correctly
4. Ensure your Azure AD app registration is active and not expired

