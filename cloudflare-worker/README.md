# Cloudflare Worker OAuth Callback Proxy

Permanent HTTPS URL proxy for OAuth callbacks to Back4App.

## Quick Start

1. **Install Wrangler CLI:**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare:**
   ```bash
   wrangler login
   ```

3. **Update Back4App URL:**
   Edit `wrangler.toml` and set `BACK4APP_BASE_URL` to your Back4App app URL:
   ```toml
   [vars]
   BACK4APP_BASE_URL = "https://your-app.b4a.run"
   ```

4. **Deploy:**
   ```bash
   wrangler deploy
   ```

5. **Copy the output URL:**
   ```
   https://shreenathji-oauth-worker.your-account.workers.dev
   ```

## Configuration

### Environment Variables

- `BACK4APP_BASE_URL`: Your Back4App app URL (e.g., `https://yourapp.b4a.run`)

### Supported OAuth Callback Paths

- `/auth/outlook/callback` - Outlook/Microsoft OAuth
- `/auth/whatsapp/callback` - WhatsApp OAuth
- `/auth/wechat/callback` - WeChat OAuth

## Usage

The worker forwards OAuth callbacks to Back4App:

```
Azure OAuth → https://shreenathji-oauth-worker.youraccount.workers.dev/auth/outlook/callback?code=ABC123&state=xyz
           ↓
Back4App → https://yourapp.b4a.run/api/oauth/callback?code=ABC123&state=xyz
```

## Monitoring

View logs in real-time:
```bash
wrangler tail
```

Or check Cloudflare Dashboard → Workers → shreenathji-oauth-worker → Logs

## Security

- Only handles `/auth/*/callback` paths (404 everything else)
- No open redirects - only allows redirects to configured Back4App domain
- Preserves ALL OAuth query parameters
- HTTPS enforced automatically by Cloudflare

