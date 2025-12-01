# Outlook OAuth 2.0 Setup Guide - Azure App Registration

This comprehensive guide will walk you through setting up Outlook OAuth 2.0 authentication for the GlobalReach Exporter Lead Automator app using Azure App Registration.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure App Registration](#azure-app-registration)
3. [Getting OAuth Credentials](#getting-oauth-credentials)
4. [Configuring Redirect URI](#configuring-redirect-uri)
5. [Required Permissions/Scopes](#required-permissionsscopes)
6. [Setting Up in the App](#setting-up-in-the-app)
7. [Testing the Connection](#testing-the-connection)
8. [Troubleshooting](#troubleshooting)
9. [Security Best Practices](#security-best-practices)
10. [Quick Reference Checklist](#quick-reference-checklist)

---

## ✅ Prerequisites

Before you begin, ensure you have:

- ✅ A Microsoft account (Outlook.com, Hotmail.com, Live.com) OR
- ✅ A Microsoft 365/Office 365 account (work or school account)
- ✅ Access to [Azure Portal](https://portal.azure.com)
- ✅ Admin permissions (if setting up for an organization)
- ✅ 10-15 minutes to complete the setup

> **Note**: If you don't have an Azure account, you can create one for free at [azure.microsoft.com](https://azure.microsoft.com/free/)

---

## 🔐 Azure App Registration

### Step 1: Access Azure Portal and Navigate to App Registrations

#### 1.1 Sign in to Azure Portal

1. Open your web browser and navigate to [https://portal.azure.com](https://portal.azure.com)
2. Sign in with your Microsoft account (the same account you'll use for Outlook)
3. If you see a welcome screen, click **"Skip for now"** or proceed to the dashboard

#### 1.2 Navigate to Azure Active Directory

**Method 1: Using the Left Sidebar**
- Look at the left sidebar menu
- Click on **"Azure Active Directory"** (may appear as "Microsoft Entra ID" in newer interfaces)
- If you don't see it, click **"More services"** and search for "Azure Active Directory"

**Method 2: Using the Search Bar**
- Click the search bar at the top of the page
- Type: `Azure Active Directory` or `Microsoft Entra ID`
- Click on the result

#### 1.3 Access App Registrations

Once in Azure Active Directory:
- In the left menu, find and click **"App registrations"**
- You should see a list of existing app registrations (may be empty if this is your first time)

---

### Step 2: Create a New App Registration

#### 2.1 Start Registration

1. At the top of the App registrations page, click the **"+ New registration"** button
2. A new form will appear on the right side

#### 2.2 Fill in Application Details

**Name** (Required):
- Enter a descriptive name for your application
- Example: `GlobalReach Email Automator` or `My Lead Automator`
- This name will be shown to users during OAuth consent

**Supported account types** (Required):
- **For Personal Outlook Accounts** (Outlook.com, Hotmail.com, Live.com):
  - Select: **"Accounts in any organizational directory and personal Microsoft accounts"**
  - This allows both personal and work/school accounts
  
- **For Organization Only** (Microsoft 365 Business/Enterprise):
  - Select: **"Accounts in this organizational directory only"**
  - This restricts access to your organization only

**Redirect URI** (Optional for now):
- **Platform**: Leave as default or select "Web"
- **URI**: Leave this **blank** for now - we'll configure it in Step 4
- ⚠️ **Important**: Don't add anything here yet!

#### 2.3 Register the Application

1. Review your settings
2. Click the **"Register"** button at the bottom
3. Wait a few seconds for Azure to create your app registration
4. You'll be automatically redirected to the **Overview** page

---

### Step 3: Copy Your Application Credentials

#### 3.1 Get Your Application (Client) ID

After registration, you'll see the **Overview** page with your app details:

1. **Find the Application (client) ID**:
   - It's displayed prominently at the top of the page
   - It looks like: `12345678-1234-1234-1234-123456789abc`
   - Click the **copy icon** (📋) next to it to copy to clipboard
   - ⚠️ **Save this somewhere safe** - you'll need it in Step 6

2. **Find the Directory (tenant) ID** (if needed):
   - Scroll down to see the Directory (tenant) ID
   - It also looks like: `87654321-4321-4321-4321-cba987654321`
   - **For personal accounts**: You can use `common` instead
   - **For organization accounts**: Copy this value
   - Click the **copy icon** to copy it

> **💡 Tip**: Keep a text file or document open to paste these values as you collect them.

#### 3.2 Verify Registration Success

You should see:
- ✅ Green checkmark or success message
- ✅ Your app name at the top
- ✅ Application (client) ID visible
- ✅ Status showing as "Active"

**If you see any errors**, check the Troubleshooting section below.

---

## 🔑 Getting OAuth Credentials

### Step 4: Create Client Secret

#### 4.1 Navigate to Certificates & Secrets

1. In your app registration, look at the **left menu**
2. Click on **"Certificates & secrets"** (under "Manage" section)
3. You'll see two tabs: **"Client secrets"** and **"Certificates"**
4. Make sure you're on the **"Client secrets"** tab

#### 4.2 Create a New Client Secret

1. Click the **"+ New client secret"** button
2. A form will appear:

   **Description**:
   - Enter a descriptive name (e.g., "GlobalReach App Secret" or "Production Secret")
   - This helps you identify the secret later

   **Expires**:
   - Choose an expiration period:
     - **6 months** - For testing/development
     - **12 months** - For short-term production
     - **24 months** - **Recommended** for production
     - **Never** - Not recommended (security risk)

3. Click **"Add"** button

#### 4.3 Copy the Secret Value (CRITICAL STEP)

⚠️ **IMPORTANT - READ CAREFULLY**:

1. **Immediately after clicking "Add"**, a new row will appear in the table
2. In the **"Value"** column, you'll see the secret value
3. **Click the copy icon** (📋) next to the value to copy it
4. **Paste it somewhere safe immediately** (text file, password manager, etc.)
5. ⚠️ **You will NOT be able to see this value again!**
6. The secret will appear in the list, but the actual value will be hidden (showing only `****`)

**What you'll see:**
- **Value**: `abc123~XYZ-Secret-Value-That-You-Must-Copy-Now`
- **Secret ID**: `abc12345-6789-...` (auto-generated)
- **Expires**: The date you selected
- **Created**: Current date/time

> **💡 Pro Tip**: Set a calendar reminder 1 month before expiration to create a new secret and update your app configuration.

---

### Step 5: Determine Your Tenant ID

#### 5.1 For Personal Outlook Accounts

- **Use**: `common`
- This allows any Microsoft account (personal or organizational) to authenticate
- No need to copy anything from Azure Portal

#### 5.2 For Organization Accounts

1. Go back to **"Overview"** in your app registration
2. Find **"Directory (tenant) ID"**
3. Copy the value (it's a GUID like: `87654321-4321-4321-4321-cba987654321`)
4. Save it with your other credentials

**Alternative**: You can also use your organization's domain:
- Example: `yourcompany.onmicrosoft.com`
- But the GUID (tenant ID) is more reliable

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

---

## 🔗 Configuring Redirect URI

### Step 6: Set Up Redirect URI

The redirect URI is where Microsoft will send users after they authenticate. This must match exactly between Azure Portal and your app.

#### 6.1 Navigate to Authentication Settings

1. In your app registration, look at the **left menu**
2. Click on **"Authentication"** (under "Manage" section)
3. You'll see the authentication configuration page

#### 6.2 Add Web Platform

1. Scroll down to the **"Platform configurations"** section
2. Click the **"+ Add a platform"** button
3. A popup will appear with platform options:
   - **Web**
   - **Single-page application**
   - **Mobile and desktop applications**
   - **iOS/macOS**
   - **Android**
4. Click on **"Web"** option
5. The configuration form will appear

#### 6.3 Configure Redirect URI

**Redirect URIs** field:
1. Click in the **"Redirect URIs"** text box
2. Enter the following URI exactly as shown:
     ```
     http://localhost:4000/auth/oauth/callback
     ```
3. ⚠️ **Important**: 
   - Use `http://` (not `https://`) for localhost
   - Use `localhost` (not `127.0.0.1`)
   - Port `4000` is the default - if your app uses a different port, change it here
   - The path `/auth/oauth/callback` must match exactly

**Implicit grant and hybrid flows**:
- ✅ **Leave these UNCHECKED**
- We use the Authorization Code flow (more secure)
- These options are for older OAuth flows

**Front-channel logout URL** (Optional):
- Leave this blank for now
- You can configure it later if needed

#### 6.4 Save Configuration

1. Click the **"Configure"** button at the bottom of the form
2. The platform will be added to your list
3. **Important**: Click the **"Save"** button at the top of the page (blue button)
4. Wait for the success notification: ✅ "Application updated successfully"

**Verify the redirect URI was added:**
- You should see `http://localhost:4000/auth/oauth/callback` in the list
- It should show as a "Web" platform type

> **💡 Note**: If your app runs on a different port (check your app's server configuration), update the redirect URI accordingly. Common ports: 3000, 4000, 5000, 8080.

---

## 🔐 Required Permissions/Scopes

### Step 7: Configure API Permissions

API permissions determine what your app can do with the user's Outlook account. We need permissions to read and send emails.

#### 7.1 Navigate to API Permissions

1. In your app registration, look at the **left menu**
2. Click on **"API permissions"** (under "Manage" section)
3. You'll see a list of configured permissions (may be empty initially)

#### 7.2 Add Microsoft Graph Permissions

1. Click the **"+ Add a permission"** button
2. A popup will appear with API options:
   - **Microsoft Graph** ← Select this
   - **APIs my organization uses**
   - **APIs I use**
3. Click on **"Microsoft Graph"**
4. You'll see two options:
   - **Delegated permissions** ← Select this (for user context)
   - **Application permissions** (for app-only context - not needed)
5. Click **"Delegated permissions"**

#### 7.3 Add Required Scopes

You'll see a searchable list of permissions. Search for and check the following:

**1. Mail.Read**
- Search for: `Mail.Read`
- Description: "Read mail in all mailboxes"
- ✅ Check the box next to it

**2. Mail.Send**
- Search for: `Mail.Send`
- Description: "Send mail as the user"
- ✅ Check the box next to it

**3. User.Read**
- Search for: `User.Read`
- Description: "Sign in and read user profile"
- ✅ Check the box next to it

**4. offline_access**
- Search for: `offline_access`
- Description: "Maintain access to data you have given it access to"
- ✅ Check the box next to it
- ⚠️ **Critical**: This permission is required for refresh tokens!

#### 7.4 Add Permissions

1. After checking all four permissions, click the **"Add permissions"** button at the bottom
2. You'll be returned to the API permissions page
3. You should now see all four permissions listed:
   - ✅ `Mail.Read` (Delegated)
   - ✅ `Mail.Send` (Delegated)
   - ✅ `User.Read` (Delegated)
   - ✅ `offline_access` (Delegated)

#### 7.5 Grant Admin Consent (If Required)

**For Personal Accounts:**
- ✅ No admin consent needed
- Users will grant consent during the OAuth flow

**For Organization Accounts:**
- Look for a yellow warning banner that says: "Grant admin consent for [Your Organization]"
- If you see this:
  1. Click the **"Grant admin consent for [Your Organization]"** button
  2. Confirm the action in the popup
  3. Wait for the success message
  4. The status should change to show a green checkmark ✅

**Verify Permissions:**
- All permissions should show:
  - ✅ Status: "Granted for [Your Organization]" (for org accounts)
  - ✅ Or: "Not granted" (for personal accounts - will be granted during OAuth)

> **💡 Note**: If you don't see the admin consent button, you may need Azure AD admin privileges. Contact your IT administrator.

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

---

## ⚙️ Setting Up in the App

### Step 8: Configure OAuth in GlobalReach App

Now that you have all the credentials from Azure Portal, it's time to configure them in the app.

#### 8.1 Open the Application

1. Launch **GlobalReach Exporter Lead Automator**
2. Wait for the app to fully load
3. If you see a login screen, log in with your credentials

#### 8.2 Navigate to Settings

1. Look for the **Settings** icon in the navigation menu (usually a gear ⚙️ icon)
2. Click on it to open the Settings modal/window
3. Look for tabs at the top: **General**, **Integrations**, **Security**, etc.
4. Click on the **"Integrations"** tab

#### 8.3 Find OAuth Configuration Section

1. Scroll down to find the **"OAuth Configuration"** section
2. Look for **"Outlook/Microsoft OAuth"** or **"Email OAuth"** settings
3. You should see input fields for:
   - Client ID
   - Client Secret
   - Tenant ID (optional)
   - Redirect URI

#### 8.4 Enter Your Credentials

**Client ID**:
1. Paste the **Application (client) ID** you copied from Step 3
2. It should look like: `12345678-1234-1234-1234-123456789abc`
3. ⚠️ Make sure there are no extra spaces before or after

**Client Secret**:
1. Paste the **client secret value** you copied from Step 4
2. It should look like: `abc123~XYZ-Secret-Value...`
3. ⚠️ Make sure you're pasting the **Value**, not the Secret ID
4. ⚠️ If you lost the secret value, you'll need to create a new one in Azure Portal

**Tenant ID**:
- **For personal accounts**: Enter `common` (all lowercase)
- **For organization accounts**: Paste the Directory (tenant) ID from Step 5
- **Leave blank**: Some apps default to `common` if left blank

**Redirect URI**:
- Should be pre-filled as: `http://localhost:4000/auth/oauth/callback`
- ✅ Verify it matches exactly what you configured in Azure Portal (Step 6)
- If your app uses a different port, update it here

#### 8.5 Save Configuration

1. Double-check all fields are filled correctly
2. Click the **"Save"** or **"Save Configuration"** button
3. Wait for a success message: ✅ "OAuth configuration saved successfully"
4. The credentials are now stored securely in the app

> **💡 Tip**: If you see an error, check:
> - No extra spaces in Client ID or Client Secret
> - Client Secret hasn't expired
> - Redirect URI matches Azure Portal exactly
> - All required fields are filled

---

---

## 🧪 Testing the Connection

### Step 9: Connect Your Outlook Account

Now let's test the OAuth connection to make sure everything works!

#### 9.1 Open Platform Connect Modal

1. In the app, go to **Settings** > **Integrations** tab
2. Find the **Email/Outlook** integration section
3. Look for a **"Connect"** button next to Email/Outlook
4. Click the **"Connect"** button
5. A modal window should open for platform connection

#### 9.2 Select Email Provider

1. In the connection modal, you should see options for email providers
2. Select **"Microsoft/Outlook"** or **"Outlook"** as the email provider
3. You may also see options like:
   - Gmail
   - Outlook/Microsoft ← Select this
   - Custom SMTP

#### 9.3 Enter Your Email Address

1. After selecting **"Sign in with Microsoft"**, you'll see an email input screen
2. Enter your Outlook email address:
   - Personal: `yourname@outlook.com` or `yourname@hotmail.com`
   - Work/School: `yourname@yourcompany.com`
3. Click **"Continue with Microsoft"** button
4. ⚠️ **Note**: If you see IMAP/SMTP configuration form instead of email input, it means OAuth is not configured. Go to Settings > Integrations > OAuth Configuration and enter your Client ID and Client Secret first.

#### 9.4 Complete OAuth Flow

**Step 1: Browser Opens**
- The app will automatically open your default web browser
- You'll be redirected to Microsoft's login page
- URL will look like: `https://login.microsoftonline.com/.../oauth2/v2.0/authorize`

**Step 2: Sign In**
- Enter your Microsoft account email
- Enter your password
- If you have 2FA enabled, complete the verification
- Click **"Sign in"**

**Step 3: Review Permissions**
- Microsoft will show you what permissions the app is requesting:
  - ✅ Read your mail
  - ✅ Send mail as you
  - ✅ Sign you in and read your profile
  - ✅ Maintain access to data
- Review the permissions
- Click **"Accept"** or **"Yes"** to grant permissions

**Step 4: Redirect Back**
- After accepting, you'll be redirected back to the app
- The browser may show: "You can close this window" or similar message
- The app should automatically detect the connection

#### 9.5 Verify Connection Success

**Check Connection Status:**
1. In the app, you should see:
   - ✅ Status: **"Connected"** (green indicator)
   - ✅ Your email address displayed
   - ✅ Connection timestamp
   - ✅ Provider: "Microsoft" or "Outlook"

**Test Email Functionality:**
1. Try sending a test email (if the app has this feature)
2. Try receiving/syncing emails
3. Check that the connection is working properly

**If Connection Fails:**
- See the Troubleshooting section below
- Check the error message in the app
- Verify all credentials are correct

> **💡 Success Indicators:**
> - ✅ Browser redirects successfully
> - ✅ No error messages in the app
> - ✅ Connection status shows "Connected"
> - ✅ Email address is displayed correctly

---

---

## 🔧 Troubleshooting

### Common Issues and Solutions

This section covers the most common errors and how to fix them.

---

#### ❌ Issue: "Invalid client" or "AADSTS700016: Application was not found"

**Error Message Examples:**
- "Invalid client"
- "AADSTS700016: Application with identifier 'xxx' was not found"
- "The application was not found in the directory/tenant"

**Causes:**
- Client ID is incorrect or has extra spaces
- App registration was deleted or doesn't exist
- Wrong tenant ID (using org tenant ID for personal account)

**Solutions:**

1. **Verify Client ID:**
   - Go to Azure Portal > App registrations > Your app > Overview
   - Copy the Application (client) ID again
   - Remove any spaces before/after when pasting into the app
   - Make sure you're using the Client ID, not the Tenant ID

2. **Check App Registration Status:**
   - In Azure Portal, verify your app registration still exists
   - Check that it's not disabled or deleted
   - Ensure you're looking at the correct Azure AD tenant

3. **Verify Tenant ID:**
   - For personal accounts: Use `common` (not your tenant ID)
   - For org accounts: Use the exact Directory (tenant) ID from Overview

4. **Re-enter Credentials:**
   - Clear the OAuth configuration in the app
   - Re-enter all credentials from scratch
   - Save and try again

---

#### ❌ Issue: "Redirect URI mismatch" or "AADSTS50011"

**Error Message Examples:**
- "Redirect URI mismatch"
- "AADSTS50011: The redirect URI specified in the request does not match"
- "The reply URL does not match"

**Causes:**
- Redirect URI in Azure Portal doesn't match the app
- Wrong port number
- Using `https://` instead of `http://` for localhost
- Typo in the redirect URI path

**Solutions:**

1. **Check Azure Portal Configuration:**
   - Go to Azure Portal > App registrations > Your app > Authentication
   - Find the redirect URI in the list
   - Verify it's exactly: `http://localhost:4000/auth/oauth/callback`
   - Check for:
     - ✅ `http://` (not `https://`)
     - ✅ `localhost` (not `127.0.0.1`)
     - ✅ Correct port number (4000 or your app's port)
     - ✅ Exact path: `/auth/oauth/callback`

2. **Check App Configuration:**
   - In the app settings, verify the redirect URI matches Azure Portal
   - Make sure there are no trailing slashes or spaces

3. **Check Server Port:**
   - Verify what port your app's server is running on
   - Check the app logs or configuration
   - Update both Azure Portal and app settings if port is different

4. **Add Multiple Redirect URIs (if needed):**
   - If you're testing on different ports, add all of them to Azure Portal
   - Example: `http://localhost:3000/auth/oauth/callback` AND `http://localhost:4000/auth/oauth/callback`

---

#### ❌ Issue: "Insufficient privileges" or "AADSTS65005"

**Error Message Examples:**
- "Insufficient privileges to complete the operation"
- "AADSTS65005: The application needs access to a service"
- "Permission denied"
- "Admin consent required"

**Causes:**
- Required permissions not added in Azure Portal
- Admin consent not granted (for org accounts)
- Missing `offline_access` permission
- Permissions not properly configured

**Solutions:**

1. **Verify Permissions in Azure Portal:**
   - Go to Azure Portal > App registrations > Your app > API permissions
   - Ensure all four permissions are listed:
     - ✅ `Mail.Read` (Delegated)
     - ✅ `Mail.Send` (Delegated)
     - ✅ `User.Read` (Delegated)
     - ✅ `offline_access` (Delegated)
   - If any are missing, add them (see Step 7)

2. **Grant Admin Consent (Organization Accounts):**
   - In API permissions page, look for yellow warning banner
   - Click "Grant admin consent for [Your Organization]"
   - Wait for success message
   - All permissions should show green checkmark ✅

3. **Check Permission Status:**
   - Each permission should show:
     - Status: "Granted for [Organization]" (org accounts)
     - Or: "Not granted" (personal accounts - OK, will be granted during OAuth)

4. **Re-authenticate:**
   - Disconnect the account in the app
   - Reconnect to trigger new consent flow

---

#### ❌ Issue: "Token expired" or "AADSTS700082"

**Error Message Examples:**
- "Token expired"
- "AADSTS700082: The refresh token has expired"
- "Invalid token"
- "Authentication failed"

**Causes:**
- Access token expired (normal after 1 hour)
- Refresh token expired or invalid
- Client secret expired
- Token storage issue

**Solutions:**

1. **Check Client Secret Expiration:**
   - Go to Azure Portal > App registrations > Your app > Certificates & secrets
   - Check if your client secret has expired
   - If expired, create a new secret and update app configuration

2. **Re-authenticate:**
   - Disconnect the account in the app
   - Reconnect to get fresh tokens
   - This will generate new access and refresh tokens

3. **Verify Token Storage:**
   - The app should automatically refresh tokens using the refresh token
   - If refresh fails, you may need to re-authenticate
   - Check app logs for token refresh errors

4. **Check App Configuration:**
   - Verify client secret is still valid and not expired
   - Ensure OAuth configuration is still saved correctly

---

#### ❌ Issue: "AADSTS70011: Invalid scope"

**Error Message Examples:**
- "AADSTS70011: The provided value for the input parameter 'scope' is not valid"
- "Invalid scope"
- "The scope 'xxx' is not valid"

**Causes:**
- Scopes in app don't match Azure Portal permissions
- Wrong scope format
- Missing required scopes

**Solutions:**

1. **Verify Scope Format:**
   - Scopes should be full URLs:
     - ✅ `https://graph.microsoft.com/Mail.Send`
     - ✅ `https://graph.microsoft.com/Mail.Read`
     - ✅ `https://graph.microsoft.com/User.Read`
     - ✅ `offline_access`
   - Not just: `Mail.Send` or `Mail.Read`

2. **Check App Code:**
   - The app should be using the correct scope format
   - If you modified the app code, verify scopes match Azure Portal permissions

3. **Verify Permissions in Azure Portal:**
   - Go to API permissions
   - Ensure all required permissions are added
   - Check that permission names match the scopes

---

#### ❌ Issue: Browser doesn't open for OAuth

**Error Message Examples:**
- "Failed to open browser"
- "OAuth URL generation failed"
- No browser window appears

**Causes:**
- Pop-up blockers enabled
- App doesn't have permission to open URLs
- Browser default not set
- Network/firewall blocking

**Solutions:**

1. **Check Pop-up Blockers:**
   - Disable pop-up blockers in your browser
   - Add the app to allowed sites
   - Try a different browser

2. **Manual OAuth URL:**
   - Check app logs for the OAuth URL
   - Copy the URL manually
   - Paste it into your browser
   - Complete the authentication flow

3. **Set Default Browser:**
   - Ensure you have a default browser set in system settings
   - Try setting a different browser as default

4. **Check App Permissions:**
- Verify the app has permission to open external URLs
   - Check system security settings

---

#### ❌ Issue: "AADSTS50020: User account not found"

**Error Message Examples:**
- "AADSTS50020: User account from external identity provider does not exist"
- "Account not found"
- "User does not exist in tenant"

**Causes:**
- Using wrong account type (personal vs. organizational)
- Account doesn't exist in the tenant
- Wrong tenant ID configuration

**Solutions:**

1. **Check Account Type:**
   - Verify you're using the correct Microsoft account
   - Personal accounts: Use `common` as tenant ID
   - Org accounts: Use specific tenant ID

2. **Verify Tenant ID:**
   - For personal Outlook accounts: Use `common`
   - For work/school accounts: Use the organization's tenant ID
   - Check Azure Portal > Overview > Directory (tenant) ID

3. **Try Different Account:**
   - If using personal account, ensure it's a valid Microsoft account
   - If using org account, verify you have access to that tenant

---

#### ❌ Issue: Connection works but emails don't send/receive

**Causes:**
- Permissions granted but API calls failing
- Network/firewall issues
- Microsoft Graph API issues
- App code issues

**Solutions:**

1. **Check Microsoft Graph Status:**
   - Visit: https://status.office.com/
   - Check if Microsoft Graph API is experiencing issues

2. **Verify Permissions:**
   - Ensure `Mail.Send` and `Mail.Read` permissions are granted
   - Check admin consent is granted (for org accounts)

3. **Test API Directly:**
   - Use Microsoft Graph Explorer to test API calls
   - Visit: https://developer.microsoft.com/graph/graph-explorer

4. **Check App Logs:**
   - Review app logs for specific error messages
   - Look for API call failures or authentication errors

---

### Still Having Issues?

If none of the above solutions work:

1. **Double-Check Everything:**
   - Go through the Quick Reference Checklist below
   - Verify each step was completed correctly

2. **Review Azure Portal:**
   - Check app registration is active
   - Verify all configurations are saved
   - Look for any warning messages

3. **Check App Logs:**
   - Review application logs for detailed error messages
   - Look for specific error codes (AADSTS codes)

4. **Contact Support:**
   - Check Microsoft documentation: https://docs.microsoft.com/azure/active-directory/develop/
   - Review Azure AD error codes: https://docs.microsoft.com/azure/active-directory/develop/reference-aadsts-error-codes

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

---

## ✅ Quick Reference Checklist

Use this checklist to ensure everything is configured correctly. Check off each item as you complete it:

### Azure Portal Setup

- [ ] **Step 1-2**: Azure app registration created with descriptive name
- [ ] **Step 3**: Application (client) ID copied and saved securely
- [ ] **Step 4**: Client secret created and **VALUE** copied immediately (before it disappears!)
- [ ] **Step 5**: Tenant ID determined:
  - [ ] Personal accounts: Using `common`
  - [ ] Organization accounts: Directory (tenant) ID copied
- [ ] **Step 6**: Redirect URI configured in Azure Portal:
  - [ ] Platform: **Web**
  - [ ] URI: `http://localhost:4000/auth/oauth/callback` (or your app's port)
  - [ ] Configuration saved successfully
- [ ] **Step 7**: API permissions added (all four):
  - [ ] `Mail.Read` (Delegated)
  - [ ] `Mail.Send` (Delegated)
  - [ ] `User.Read` (Delegated)
  - [ ] `offline_access` (Delegated)
- [ ] **Step 7.5**: Admin consent granted (if organization account)

### App Configuration

- [ ] **Step 8**: OAuth credentials entered in app settings:
  - [ ] Client ID pasted (no extra spaces)
  - [ ] Client Secret pasted (the Value, not the ID)
  - [ ] Tenant ID entered (`common` or specific tenant ID)
  - [ ] Redirect URI verified (matches Azure Portal)
- [ ] **Step 8.5**: Configuration saved successfully in app

### Testing

- [ ] **Step 9**: Connection tested:
  - [ ] Browser opened for OAuth flow
  - [ ] Signed in with Microsoft account
  - [ ] Permissions accepted
  - [ ] Redirected back to app successfully
- [ ] **Step 9.5**: Connection verified:
  - [ ] Status shows "Connected" ✅
  - [ ] Email address displayed correctly
  - [ ] Test email sent successfully (if applicable)
  - [ ] Test email received/synced successfully (if applicable)

### Security

- [ ] Client secret stored securely (not in version control)
- [ ] Client secret expiration date noted (set reminder before expiration)
- [ ] Appropriate tenant ID used (not `common` for org accounts if possible)
- [ ] Only necessary permissions requested
- [ ] Redirect URIs limited to what's needed

---

## 📝 Summary

### What You've Accomplished

By completing this guide, you have:

1. ✅ Created an Azure App Registration for OAuth 2.0 authentication
2. ✅ Configured Microsoft Graph API permissions for email access
3. ✅ Set up secure client credentials (Client ID and Secret)
4. ✅ Configured redirect URI for OAuth callback
5. ✅ Integrated OAuth credentials into the GlobalReach app
6. ✅ Successfully connected your Outlook account via OAuth

### Key Information to Keep Safe

**From Azure Portal:**
- **Application (Client) ID**: `12345678-1234-1234-1234-123456789abc`
- **Client Secret Value**: `abc123~XYZ-Secret-Value...` (keep this secure!)
- **Directory (Tenant) ID**: `87654321-4321-4321-4321-cba987654321` (if using org account)
- **Redirect URI**: `http://localhost:4000/auth/oauth/callback`

**In Your App:**
- OAuth credentials are stored securely
- Tokens are automatically refreshed
- Connection status is monitored

### Next Steps

- ✅ Your Outlook account is now connected via OAuth 2.0
- ✅ The app can send and receive emails on your behalf
- ✅ Tokens will automatically refresh when they expire
- ⚠️ Remember to renew your client secret before it expires
- 📧 Test sending/receiving emails to ensure everything works

### Important Reminders

1. **Client Secret Expiration**: Set a reminder 1 month before your client secret expires to create a new one
2. **Token Refresh**: The app handles token refresh automatically, but if you see errors, try re-authenticating
3. **Security**: Never share your client secret or commit it to version control
4. **Multiple Accounts**: You can connect multiple Outlook accounts by repeating the connection process
5. **Organization Policies**: Some organizations may restrict OAuth apps - contact IT if needed

---

## 📚 Additional Resources

### Microsoft Documentation
- [Microsoft Identity Platform Overview](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/overview)
- [OAuth 2.0 Authorization Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [Azure AD Error Codes Reference](https://docs.microsoft.com/azure/active-directory/develop/reference-aadsts-error-codes)

### Azure Portal Links
- [Azure Portal](https://portal.azure.com)
- [App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
- [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) - Test API calls

### Status & Support
- [Microsoft 365 Service Health](https://status.office.com/)
- [Azure Service Health](https://status.azure.com/status)
- [Microsoft Graph API Status](https://developer.microsoft.com/graph/support)

---

## 🎉 Congratulations!

You've successfully set up Outlook OAuth 2.0 authentication! Your GlobalReach Exporter Lead Automator app can now securely connect to Outlook and send/receive emails.

If you encounter any issues, refer to the Troubleshooting section above or check the Microsoft documentation links provided.

---

**Last Updated**: December 2024  
**App Version**: 1.0.2  
**Guide Version**: 2.0

---

## Notes

- **Token Expiration**: Access tokens expire after 1 hour. The app automatically refreshes them using the refresh token.
- **Refresh Tokens**: Refresh tokens are long-lived and stored securely. They're used to obtain new access tokens without user interaction.
- **Multiple Accounts**: You can connect multiple Outlook accounts by repeating the connection process for each account.
- **Organization Policies**: Some organizations may have policies that restrict OAuth apps. Contact your IT administrator if you encounter restrictions.

---

**Last Updated**: 2024
**App Version**: 1.0.2









