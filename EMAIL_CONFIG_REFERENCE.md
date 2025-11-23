# Your Email Configuration - Quick Reference

## Email Account Details

**Email Address:** `Shreenathjimarketingassociate@outlook.com`  
**Password:** `vijayvargiya@24`

---

## Server Configuration Details

### Outgoing Mail Server (SMTP) - For Sending Emails

```
Server Address: smtp-mail.outlook.com
Port: 587
Encryption: STARTTLS (TLS)
Authentication: Required
Username: Shreenathjimarketingassociate@outlook.com
Password: vijayvargiya@24
```

### Incoming Mail Server (IMAP) - For Reading Emails

```
Server Address: outlook.office365.com
Port: 993
Encryption: SSL/TLS
Authentication: Required
Username: Shreenathjimarketingassociate@outlook.com
Password: vijayvargiya@24
```

---

## How to Configure in GlobalReach App

### Step-by-Step Instructions:

1. **Open GlobalReach App**
   - The app should already be running

2. **Navigate to Email Settings**
   - Click **Settings** (gear icon)
   - Go to **Platforms** or **Integrations** section
   - Find **Email** and click **"Connect"** button

3. **Select Provider**
   - Choose **"Custom"** or **"IMAP/SMTP"** option
   - You'll see the credential form

4. **Use Preset (Easiest Method)**
   - Click the **"Outlook.com"** preset button
   - This auto-fills the server settings

5. **Fill in Your Details**
   - **Email Address:** `Shreenathjimarketingassociate@outlook.com`
   - **Password:** `vijayvargiya@24`
   - Verify the auto-filled server settings are:
     - SMTP Host: `smtp-mail.outlook.com`
     - SMTP Port: `587`
     - IMAP Host: `outlook.office365.com`
     - IMAP Port: `993`

6. **Test Connection**
   - Click **"Test & Connect"** button
   - Wait for the connection test to complete
   - If successful, you'll see a success message
   - If there are errors, see troubleshooting below

---

## Copy-Paste Ready Configuration

Copy these values directly into the app form:

```
Email Address: Shreenathjimarketingassociate@outlook.com
SMTP Host: smtp-mail.outlook.com
SMTP Port: 587
IMAP Host: outlook.office365.com
IMAP Port: 993
Password: vijayvargiya@24
```

---

## Field Mapping in App Form

| App Field Name | Enter This Value |
|----------------|------------------|
| Email Address * | `Shreenathjimarketingassociate@outlook.com` |
| SMTP Host * | `smtp-mail.outlook.com` |
| SMTP Port * | `587` |
| Password/App Password * | `vijayvargiya@24` |
| IMAP Host * | `outlook.office365.com` |
| IMAP Port * | `993` |

* = Required field

---

## Troubleshooting

### If Connection Test Fails:

1. **Check Password**
   - Ensure password is correct: `vijayvargiya@24`
   - If you have 2-step verification enabled, you may need an App Password

2. **Verify Server Addresses**
   - SMTP: `smtp-mail.outlook.com` (not `smtp.outlook.com`)
   - IMAP: `outlook.office365.com` (not `imap.outlook.com`)

3. **Check Ports**
   - SMTP Port: Must be `587`
   - IMAP Port: Must be `993`

4. **Firewall/Antivirus**
   - Temporarily disable to test
   - Add GlobalReach to firewall exceptions

5. **Test Outlook First**
   - Verify your email works in Outlook desktop app
   - If it doesn't work there, fix Outlook first

---

## Server Information Summary

### Outgoing (SMTP) Details:
- **Server:** smtp-mail.outlook.com
- **Port:** 587
- **Security:** STARTTLS
- **Authentication:** Yes
- **Username:** Shreenathjimarketingassociate@outlook.com
- **Password:** vijayvargiya@24

### Incoming (IMAP) Details:
- **Server:** outlook.office365.com
- **Port:** 993
- **Security:** SSL/TLS
- **Authentication:** Yes
- **Username:** Shreenathjimarketingassociate@outlook.com
- **Password:** vijayvargiya@24

---

## Windows Control Panel Reference

If you need to verify these settings in Windows Control Panel:

1. Open **Control Panel** → **Mail (Microsoft Outlook)**
2. Click **Email Accounts** → Select account → **Change**
3. Click **More Settings** → **Advanced** tab
4. Verify:
   - **Incoming server (IMAP):** outlook.office365.com:993
   - **Outgoing server (SMTP):** smtp-mail.outlook.com:587
5. Click **Outgoing Server** tab
6. Ensure "My outgoing server requires authentication" is checked

---

**Configuration Ready Date:** $(Get-Date)  
**Email:** Shreenathjimarketingassociate@outlook.com  
**Status:** Ready to configure

