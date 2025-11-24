# OAuth Quick Reference Card

## Azure AD Portal

**URL**: [https://portal.azure.com](https://portal.azure.com)

**Path**: Azure Active Directory → App registrations → Your App

## Required Redirect URI

```
http://localhost:4000/auth/oauth/callback
```

*(Change port number if you've configured a different server port)*

## Required API Permissions (Microsoft Graph)

Add these **Delegated** permissions:

- ✅ `Mail.Read` - Read user mail
- ✅ `Mail.Send` - Send mail as the user  
- ✅ `User.Read` - Sign in and read user profile
- ✅ `offline_access` - Maintain access (refresh tokens)

## Where to Find Credentials

| Credential | Location in Azure Portal |
|------------|--------------------------|
| **Client (Application) ID** | App registrations → Your app → **Overview** tab |
| **Directory (Tenant) ID** | App registrations → Your app → **Overview** tab |
| **Client Secret** | App registrations → Your app → **Certificates & secrets** tab |

## Tenant ID Options

- `common` - Multi-tenant (personal + organizational accounts) ⭐ **Recommended**
- `organizations` - Organizational accounts only
- `consumers` - Personal accounts only  
- `{tenant-guid}` - Specific tenant (use your Directory ID)

## Quick Setup Checklist

- [ ] Registered app in Azure AD
- [ ] Saved Client (Application) ID
- [ ] Created Client Secret (copied value immediately!)
- [ ] Added required API permissions
- [ ] Configured redirect URI
- [ ] Entered credentials in GlobalReach Settings > Integrations
- [ ] Tested OAuth connection

## Common Errors

| Error | Quick Fix |
|-------|-----------|
| Invalid client secret | Check secret is correct, not expired |
| Redirect URI mismatch | Verify URI matches exactly (case-sensitive) |
| Insufficient permissions | Grant required permissions + admin consent |
| Application not found | Check Client ID and Tenant ID |

## Security Reminders

🔒 Client Secret shown **only once** - save it immediately!

🔒 Never commit secrets to code repositories

🔒 Rotate secrets before expiration

