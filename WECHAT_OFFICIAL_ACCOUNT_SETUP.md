# WeChat Official Account Setup Guide

Complete step-by-step guide to get your WeChat Official Account credentials for GlobalReach.

## Overview

WeChat Official Accounts allow businesses to send and receive messages with users on WeChat. You'll need:
- **AppID** (Application ID)
- **AppSecret** (Application Secret)
- **Webhook Token** (for webhook verification)

## Step 1: Access WeChat Official Account Platform

1. Go to [WeChat Official Account Platform](https://mp.weixin.qq.com)
2. Log in with your WeChat account
   - You must have an Official Account (订阅号 or 服务号)
   - If you don't have one, you need to register first

## Step 2: Navigate to Basic Configuration

1. After logging in, click on **开发** (Development) in the left sidebar
2. Click on **基本配置** (Basic Configuration)
3. You'll see two sections:
   - **开发者ID(AppID)** - Your AppID
   - **开发者密码(AppSecret)** - Your AppSecret

## Step 3: Get Your AppID

1. In the **开发者ID(AppID)** section, you'll see your AppID
2. **Copy this value** - it looks like: `wx1234567890abcdef`
3. This is your **AppID** for GlobalReach

## Step 4: Get Your AppSecret

1. In the **开发者密码(AppSecret)** section, you'll see either:
   - Your AppSecret (if already revealed)
   - A button to reveal/reset it

2. **If AppSecret is hidden:**
   - Click **生成** (Generate) or **重置** (Reset)
   - Follow the verification steps (may require scanning QR code with WeChat)
   - Once generated, **copy the AppSecret immediately**
   - ⚠️ **Important**: You can only see the AppSecret once when you generate/reset it

3. **Copy this value** - it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
4. This is your **AppSecret** for GlobalReach

## Step 5: Configure Webhook (Server Configuration)

1. Scroll down to **服务器配置** (Server Configuration) section
2. Click **修改配置** (Modify Configuration) or **启用** (Enable)
3. You'll need to configure:
   - **URL(服务器地址)**: Your webhook URL
   - **Token(令牌)**: Your webhook verification token
   - **EncodingAESKey(消息加解密密钥)**: Optional, for message encryption

### Webhook URL Format

For local development with tunnel:
```
https://your-tunnel-url.ngrok.io/webhooks/wechat
```

Example:
```
https://penelope-sacrarial-jacqueline.ngrok-free.dev/webhooks/wechat
```

### Webhook Token

You can use any secure token. GlobalReach default:
```
globalreach_secret_token
```

Or generate your own secure token (at least 10 characters).

4. **Enter the webhook URL** (from Settings → System → Tunnel URL + `/webhooks/wechat`)
5. **Enter the Token** (same as configured in GlobalReach)
6. **Select encryption mode**:
   - **明文模式** (Plain Text) - Easier for testing
   - **兼容模式** (Compatible) - Supports both
   - **安全模式** (Secure) - Requires EncodingAESKey
7. Click **提交** (Submit)

## Step 6: Verify Webhook

1. After submitting, WeChat will send a verification request
2. Your GlobalReach app should automatically respond
3. If verification succeeds, you'll see "配置成功" (Configuration Successful)
4. If it fails, check:
   - Webhook URL is publicly accessible (use tunnel)
   - Token matches exactly in both places
   - Server is running

## Step 7: Enable Message Push (Optional but Recommended)

1. In **基本配置** (Basic Configuration)
2. Scroll to **消息加解密方式** (Message Encryption)
3. Make sure message push is enabled
4. Select your preferred encryption mode

## Step 8: Configure in GlobalReach

1. Open GlobalReach app
2. Go to **Settings → Integrations**
3. Click **Connect** on WeChat
4. Enter your credentials:
   - **AppID**: Your AppID from Step 3
   - **AppSecret**: Your AppSecret from Step 4
   - **Webhook Token**: Same token used in Step 5 (default: `globalreach_secret_token`)
5. Click **Test Connection** to verify
6. Click **Connect** to save

## Important Notes

### AppSecret Security
- ⚠️ **Never share your AppSecret publicly**
- ⚠️ **Store it securely** in GlobalReach
- ⚠️ **Reset it immediately** if exposed
- The AppSecret is used to get access tokens and should be kept confidential

### Access Token
- Access tokens expire after **7200 seconds (2 hours)**
- GlobalReach automatically refreshes tokens when needed
- You don't need to manually manage tokens

### API Quota
- **Free tier**: 2,000 API calls per day
- GlobalReach tracks usage and manages quota
- Upgrade your Official Account for higher limits

### Webhook Requirements
- Webhook URL must be **publicly accessible**
- Must use **HTTPS** (not HTTP) for production
- Use a tunnel service (ngrok) for local development
- Token must match exactly in WeChat and GlobalReach

## Troubleshooting

### "Invalid AppSecret" Error
- **Cause**: AppSecret is incorrect or expired
- **Solution**: 
  1. Go back to WeChat Official Account Platform
  2. Reset your AppSecret
  3. Copy the new AppSecret immediately
  4. Update in GlobalReach

### "Webhook Verification Failed"
- **Cause**: Token mismatch or URL not accessible
- **Solution**:
  1. Verify webhook URL is publicly accessible
  2. Check token matches exactly in both places (case-sensitive)
  3. Ensure server is running
  4. Check GlobalReach logs for webhook requests

### "Access Token Expired"
- **Cause**: Token expired (normal after 2 hours)
- **Solution**: GlobalReach should auto-refresh. If persistent:
  1. Disconnect and reconnect WeChat
  2. Verify AppID and AppSecret are correct

### "API Quota Exceeded"
- **Cause**: Daily API limit reached (2,000 calls/day)
- **Solution**:
  1. Wait until next day (resets at midnight China time)
  2. Reduce API usage
  3. Upgrade your Official Account tier

## Testing Your Setup

1. **Test Connection in GlobalReach:**
   - Should return success with account name

2. **Test Webhook:**
   - Send a message to your Official Account
   - Check if it appears in GlobalReach

3. **Test Sending:**
   - Send a message from GlobalReach
   - Check if recipient receives it

## Using Test Account (For Development)

If you don't have a full Official Account, you can use a test account:

1. Go to [WeChat Test Account Platform](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=jsapisandbox)
2. Log in with WeChat
3. Get your test AppID and AppSecret
4. Use same webhook configuration steps

## Quick Reference

| Field | Location | Format | Example |
|-------|----------|--------|---------|
| **AppID** | 开发 → 基本配置 → 开发者ID | `wx` + 16 chars | `wx1234567890abcdef` |
| **AppSecret** | 开发 → 基本配置 → 开发者密码 | 32 chars | `a1b2c3d4e5f6g7h8...` |
| **Webhook URL** | Settings → System → Tunnel URL | `https://.../webhooks/wechat` | `https://xxx.ngrok.io/webhooks/wechat` |
| **Webhook Token** | Settings → System → Webhook Token | Any secure string | `globalreach_secret_token` |

## Support Links

- [WeChat Official Account Platform](https://mp.weixin.qq.com)
- [WeChat Official Account Documentation](https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Getting_started_with_an_Official_Account.html)
- [WeChat API Documentation](https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html)

---

**Need Help?** Check the troubleshooting section above or contact support.

