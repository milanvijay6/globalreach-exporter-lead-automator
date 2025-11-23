# Outlook Email SMTP/IMAP Setup Guide

Complete guide for configuring Outlook email using SMTP/IMAP in GlobalReach, including how to find settings in Windows Control Panel.

## Table of Contents

1. [When to Use SMTP/IMAP vs OAuth](#when-to-use-smtpimap-vs-oauth)
2. [Finding Settings in Windows Control Panel](#finding-settings-in-windows-control-panel)
3. [Outlook Server Settings Reference](#outlook-server-settings-reference)
4. [Configuring in GlobalReach App](#configuring-in-globalreach-app)
5. [Troubleshooting](#troubleshooting)
6. [Other Email Providers](#other-email-providers)

---

## When to Use SMTP/IMAP vs OAuth

**Use OAuth (Recommended):**
- ✅ More secure (no password storage)
- ✅ Automatic token refresh
- ✅ Works with Gmail and Outlook.com
- ✅ Easier setup (just sign in)

**Use SMTP/IMAP (Fallback):**
- ✅ When OAuth is not available
- ✅ For custom email domains
- ✅ For older email accounts
- ✅ When you prefer manual configuration

---

## Finding Settings in Windows Control Panel

### Step 1: Open Control Panel

**Windows 10/11:**
- Click the **Start** button or press `Windows key`
- Type **"Control Panel"** in the search box
- Click **"Control Panel"** from the results

**Windows 8.1:**
- Press `Windows key + C` to open the Charms bar
- Click **"Search"**
- Type **"Control Panel"**
- Click **"Control Panel"** from the results

**Windows 7:**
- Click **Start** button
- Click **"Control Panel"** from the right side of the menu

### Step 2: Access Mail Settings

1. In Control Panel, change **"View by"** to **"Small icons"** or **"Large icons"** (top right)
2. Find and double-click **"Mail (Microsoft Outlook)"**
3. The Mail Setup window will open

### Step 3: View Email Account Settings

1. In the Mail Setup window, click **"Email Accounts"**
2. The Account Settings window will open
3. Select your email account from the list
4. Click **"Change"** button

### Step 4: View Server Settings

In the Change Account window, you'll see:

**Incoming mail server (IMAP):**
- Server name (e.g., `outlook.office365.com`)
- Port number (usually `993`)

**Outgoing mail server (SMTP):**
- Server name (e.g., `smtp-mail.outlook.com`)
- Port number (usually `587`)

**User Information:**
- Your name
- Email address (this is your username)

### Step 5: Advanced Settings

1. Click **"More Settings"** button
2. Go to the **"Advanced"** tab
3. Here you'll see:
   - **Incoming server (IMAP)**: Port and encryption type
   - **Outgoing server (SMTP)**: Port and encryption type

**Example for Outlook/Microsoft 365:**
- **IMAP**: Port `993`, Encryption: `SSL/TLS`
- **SMTP**: Port `587`, Encryption: `STARTTLS`

### Step 6: Outgoing Server Authentication

1. Click the **"Outgoing Server"** tab
2. Ensure these are checked:
   - ✅ **"My outgoing server (SMTP) requires authentication"**
   - ✅ **"Use same settings as my incoming mail server"**

### Step 7: Test and Save

1. Click **"OK"** to close More Settings
2. Click **"Next"** in the Change Account window
3. Outlook will test your account settings
4. **Green checkmarks** = Success ✅
5. **Red X marks** = Error ❌ (see troubleshooting below)
6. Click **"Finish"** → **"Close"**

---

## Outlook Server Settings Reference

### Outlook.com / Hotmail / Live.com / MSN.com

```
Email Address: yourname@outlook.com
Username: yourname@outlook.com (full email address)

SMTP (Sending):
  Server: smtp-mail.outlook.com
  Port: 587
  Encryption: STARTTLS (TLS)
  Authentication: Required

IMAP (Reading):
  Server: outlook.office365.com
  Port: 993
  Encryption: SSL/TLS (SSL)
  Authentication: Required

Password: Your account password OR App Password (if 2FA enabled)
```

### Microsoft 365 / Office 365 / Business Email

```
Email Address: yourname@company.com
Username: yourname@company.com (full email address)

SMTP (Sending):
  Server: smtp-mail.outlook.com OR smtp.office365.com
  Port: 587
  Encryption: STARTTLS (TLS)
  Authentication: Required

IMAP (Reading):
  Server: outlook.office365.com
  Port: 993
  Encryption: SSL/TLS (SSL)
  Authentication: Required

Password: Your account password OR App Password
```

### Alternative Ports (If 587 doesn't work)

**SMTP Alternatives:**
- Port `465` with SSL/TLS encryption
- Port `25` (less secure, often blocked by ISPs)

**IMAP Alternatives:**
- Port `143` with STARTTLS encryption

---

## Configuring in GlobalReach App

### Step 1: Open Email Connection

1. Open GlobalReach application
2. Go to **Settings** → **Platforms** (or **Integrations**)
3. Click **"Connect"** next to Email
4. Select **"Custom"** as the email provider

### Step 2: Use Preset Configuration (Recommended)

1. Click one of the preset buttons:
   - **"Outlook.com"** - Auto-fills Outlook settings
   - **"Gmail"** - Auto-fills Gmail settings
   - **"Yahoo Mail"** - Auto-fills Yahoo settings
2. Enter your email address
3. Enter your password (or App Password)

### Step 3: Manual Configuration

If you need to enter settings manually:

**Required Fields:**
- **Email Address**: Your full email (e.g., `yourname@outlook.com`)
- **SMTP Host**: `smtp-mail.outlook.com`
- **SMTP Port**: `587`
- **Password**: Your password or App Password
- **IMAP Host**: `outlook.office365.com`
- **IMAP Port**: `993`

### Step 4: Test Connection

1. Click **"Test & Connect"** button
2. The app will test both SMTP and IMAP connections
3. If successful, your email will be connected
4. If there are errors, see the Troubleshooting section below

---

## Troubleshooting

### ❌ "Authentication Failed" Error

**Problem:** Wrong password or username

**Solutions:**
1. **Check your password:**
   - Ensure you're using the correct account password
   - If you have 2-step verification, you MUST use an App Password (not your regular password)

2. **Check your username:**
   - Must be your FULL email address (e.g., `yourname@outlook.com`)
   - Not just `yourname`

3. **Create App Password (if 2FA enabled):**
   - Go to: https://account.microsoft.com/security
   - Click **"Advanced security options"**
   - Under **"App passwords"**, click **"Create a new app password"**
   - Copy the 16-character password
   - Use this password in the app (not your regular password)

### ❌ "Connection Timeout" or "Cannot Connect to Server"

**Problem:** Wrong server address or port, or firewall blocking

**Solutions:**
1. **Verify server addresses:**
   - SMTP: `smtp-mail.outlook.com` (not `smtp.outlook.com`)
   - IMAP: `outlook.office365.com` (not `imap.outlook.com`)

2. **Check ports:**
   - SMTP: Should be `587` (STARTTLS)
   - IMAP: Should be `993` (SSL/TLS)

3. **Try alternative ports:**
   - SMTP: Try `465` (SSL) if `587` doesn't work
   - IMAP: Try `143` (STARTTLS) if `993` doesn't work

4. **Check firewall/antivirus:**
   - Temporarily disable firewall to test
   - Add GlobalReach app to firewall exceptions
   - Check if antivirus is blocking connections

### ❌ "Port Mismatch" Error

**Problem:** Encryption type doesn't match port

**Solutions:**
- Port `587` = STARTTLS (TLS) encryption
- Port `465` = SSL/TLS encryption
- Port `993` = SSL/TLS encryption
- Port `143` = STARTTLS encryption

Ensure your port matches the encryption type.

### ❌ "Server Not Found" Error

**Problem:** Incorrect server hostname

**Solutions:**
1. **Double-check server names:**
   - Outlook SMTP: `smtp-mail.outlook.com`
   - Outlook IMAP: `outlook.office365.com`
   - No typos or extra spaces

2. **Test from Control Panel first:**
   - If it works in Outlook, copy exact settings
   - If it doesn't work in Outlook, fix there first

### ❌ "Two-Step Verification Required"

**Problem:** Account has 2FA enabled but using regular password

**Solution:**
1. Go to: https://account.microsoft.com/security
2. Click **"Advanced security options"**
3. Under **"App passwords"**, click **"Create a new app password"**
4. Name it "GlobalReach" or similar
5. Copy the generated password
6. Use this App Password in the app (not your regular password)

### ❌ "Test Passes but Emails Don't Send/Receive"

**Problem:** Settings incomplete or incorrect

**Solutions:**
1. **Ensure both SMTP and IMAP are configured:**
   - SMTP is for sending
   - IMAP is for receiving
   - Both are required

2. **Check all fields are filled:**
   - Email address
   - SMTP host and port
   - IMAP host and port
   - Password

3. **Verify server addresses match your email domain:**
   - Outlook.com → Use Outlook servers
   - Custom domain → May need different servers

---

## Other Email Providers

### Gmail SMTP/IMAP Settings

```
Email Address: yourname@gmail.com
Username: yourname@gmail.com

SMTP (Sending):
  Server: smtp.gmail.com
  Port: 587
  Encryption: STARTTLS

IMAP (Reading):
  Server: imap.gmail.com
  Port: 993
  Encryption: SSL/TLS

Password: App Password (required if 2FA enabled)
```

**Note:** Gmail requires App Password if 2-step verification is enabled.

### Yahoo Mail SMTP/IMAP Settings

```
Email Address: yourname@yahoo.com
Username: yourname@yahoo.com

SMTP (Sending):
  Server: smtp.mail.yahoo.com
  Port: 587
  Encryption: STARTTLS

IMAP (Reading):
  Server: imap.mail.yahoo.com
  Port: 993
  Encryption: SSL/TLS

Password: App Password (recommended)
```

### Custom Domain Email

For custom domain emails (e.g., `yourname@yourcompany.com`):

1. **Contact your email provider** or IT administrator
2. **Ask for:**
   - SMTP server address and port
   - IMAP server address and port
   - Encryption requirements
   - Authentication requirements

3. **Common configurations:**
   - **cPanel/WHM**: Usually `mail.yourdomain.com`
   - **Google Workspace**: Use Gmail settings
   - **Microsoft 365**: Use Outlook settings
   - **Other providers**: Check their documentation

---

## Quick Reference Card

### Outlook.com Settings

```
┌─────────────────────────────────────────┐
│  OUTLOOK.COM EMAIL SETTINGS             │
├─────────────────────────────────────────┤
│  Email: yourname@outlook.com           │
│  Username: yourname@outlook.com         │
│  Password: [Your password]              │
│                                         │
│  SMTP Host: smtp-mail.outlook.com      │
│  SMTP Port: 587                         │
│  SMTP Encryption: STARTTLS              │
│                                         │
│  IMAP Host: outlook.office365.com      │
│  IMAP Port: 993                         │
│  IMAP Encryption: SSL/TLS                │
└─────────────────────────────────────────┘
```

### Copy-Paste Template

```
Email Address: yourname@outlook.com
SMTP Host: smtp-mail.outlook.com
SMTP Port: 587
IMAP Host: outlook.office365.com
IMAP Port: 993
Password: [Your password or App Password]
```

---

## Additional Resources

- [Microsoft Outlook Email Settings](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353)
- [Create App Password for Microsoft Account](https://support.microsoft.com/en-us/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a794e)
- [GlobalReach Gmail OAuth Setup](GMAIL_OAUTH_SETUP.md) - For OAuth setup (recommended)

---

## Need Help?

If you're still having issues:

1. **Check the error message** in the app - it often tells you what's wrong
2. **Test in Outlook first** - If it works there, copy exact settings
3. **Verify your password** - Try logging into webmail to confirm
4. **Check firewall/antivirus** - May be blocking connections
5. **Contact support** - Provide error messages and your email provider

---

**Last Updated:** 2024
**App Version:** 1.0.2+

