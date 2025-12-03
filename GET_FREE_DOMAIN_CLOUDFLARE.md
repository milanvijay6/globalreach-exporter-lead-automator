# How to Get a Free or Low-Cost Domain for Cloudflare

Cloudflare doesn't directly provide free domains, but here are several options to get a domain that works perfectly with Cloudflare's free services.

## Option 1: Free Subdomain Services (Recommended for Testing)

### Freenom (Free TLDs: .tk, .ml, .ga, .cf, .gq)
**Note:** Freenom has reliability issues and is not recommended for production.

1. Go to [https://www.freenom.com](https://www.freenom.com)
2. Search for an available domain name
3. Select a free TLD (.tk, .ml, .ga, .cf, or .gq)
4. Complete registration (free for 1 year, renewable)
5. Add the domain to Cloudflare DNS

### DuckDNS (Free Subdomain)
1. Go to [https://www.duckdns.org](https://www.duckdns.org)
2. Sign in with GitHub/Google
3. Create a subdomain like: `yourapp.duckdns.org`
4. Update DNS records as needed

### No-IP (Free Dynamic DNS)
1. Go to [https://www.noip.com](https://www.noip.com)
2. Create a free account
3. Get a free subdomain like: `yourapp.ddns.net`
4. Use with Cloudflare DNS

## Option 2: Very Cheap Domains (Best for Production)

### Namecheap (Recommended)
1. Go to [https://www.namecheap.com](https://www.namecheap.com)
2. Search for a domain (e.g., `.xyz`, `.online`, `.site`)
3. First-year prices often start at **$0.99-$2.99**
4. Transfer to Cloudflare Registrar later (optional)

### Cloudflare Registrar (Direct from Cloudflare)
1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Domain Registration** in the sidebar
3. Search for available domains
4. Prices are **at-cost** (no markup):
   - `.com`: ~$8-10/year
   - `.xyz`: ~$1-3/year
   - `.online`: ~$2-5/year
   - `.site`: ~$2-5/year

**Benefits:**
- No markup (Cloudflare charges cost price)
- Free WHOIS privacy
- Easy DNS management
- Works seamlessly with Cloudflare Workers

### Porkbun
1. Go to [https://porkbun.com](https://porkbun.com)
2. Search for domains
3. Very competitive first-year prices
4. Transfer to Cloudflare later if desired

## Option 3: Use Cloudflare Workers.dev Subdomain (Free, No Domain Needed!)

**This is the EASIEST option and what you're already using!**

You don't actually need a custom domain for the OAuth callback worker. Cloudflare Workers provides a free subdomain:

```
https://your-worker-name.your-account.workers.dev
```

This is:
- ✅ **Completely free**
- ✅ **Permanent** (doesn't expire)
- ✅ **HTTPS enabled** by default
- ✅ **Works with OAuth** (Azure, Google, etc. accept it)

**To use this:**
1. Deploy your Cloudflare Worker (as you're already doing)
2. The worker automatically gets a `workers.dev` subdomain
3. Use this URL as your OAuth redirect URI
4. No domain purchase needed!

## Recommended Approach for Your Use Case

Since you're using Cloudflare Workers for OAuth callbacks, **you don't need a custom domain at all!**

The `workers.dev` subdomain is:
- Free forever
- HTTPS enabled
- Accepted by OAuth providers (Azure, Google, etc.)
- Already set up when you deploy the worker

### If You Still Want a Custom Domain:

1. **For Testing/Development:**
   - Use the free `workers.dev` subdomain (no cost, no setup)

2. **For Production:**
   - Buy a cheap domain from Cloudflare Registrar (~$1-3/year for `.xyz` or `.online`)
   - Add it to Cloudflare (free DNS)
   - Configure a custom route for your worker

## Step-by-Step: Adding a Custom Domain to Cloudflare Worker

If you do get a domain and want to use it with your worker:

1. **Buy domain** from Cloudflare Registrar or transfer existing domain
2. **Add domain to Cloudflare:**
   - Go to Cloudflare Dashboard
   - Click **Add a Site**
   - Enter your domain
   - Follow the setup wizard
3. **Configure Worker Route:**
   - Go to **Workers & Pages** → Your Worker
   - Click **Triggers** → **Routes**
   - Add route: `yourdomain.com/*` or `oauth.yourdomain.com/*`
4. **Update OAuth Redirect URI:**
   - Use: `https://yourdomain.com/api/oauth/callback`
   - Or: `https://oauth.yourdomain.com/api/oauth/callback`

## Cost Comparison

| Option | Cost | Best For |
|--------|------|----------|
| **workers.dev subdomain** | **FREE** | ✅ **Your use case - OAuth callbacks** |
| Freenom (.tk, .ml, etc.) | Free | Testing only (not reliable) |
| Cloudflare Registrar (.xyz) | ~$1-3/year | Production with custom domain |
| Cloudflare Registrar (.com) | ~$8-10/year | Professional production |

## My Recommendation

**For your OAuth callback worker, stick with the free `workers.dev` subdomain!**

Reasons:
- ✅ It's completely free
- ✅ It's permanent and reliable
- ✅ OAuth providers accept it
- ✅ No additional setup needed
- ✅ HTTPS by default

You only need a custom domain if:
- You want a branded URL (e.g., `oauth.yourapp.com`)
- You're building a public-facing website
- You need email addresses with your domain

## Quick Setup Summary

**What you need:**
1. ✅ Cloudflare account (free)
2. ✅ Cloudflare API token (free)
3. ✅ Cloudflare Account ID (free)
4. ✅ Deploy worker → Get free `workers.dev` URL

**What you DON'T need:**
- ❌ Custom domain purchase
- ❌ DNS configuration
- ❌ SSL certificate (included free)

Your worker URL will be something like:
```
https://globalreach-oauth.your-account.workers.dev
```

And your OAuth callback will be:
```
https://globalreach-oauth.your-account.workers.dev/api/oauth/callback
```

This works perfectly with Azure, Google, and other OAuth providers!

