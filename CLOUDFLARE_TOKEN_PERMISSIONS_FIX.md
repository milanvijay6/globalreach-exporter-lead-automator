# Fix Cloudflare API Token Permissions

## ⚠️ Current Issue

Your API token has **Read** permission for **Workers Scripts**, but you need **Edit** permission to deploy workers.

## ✅ Required Changes

### Change This Permission:

**Current:**
- **Workers Scripts** → **Read** ❌

**Change To:**
- **Workers Scripts** → **Edit** ✅

---

## Step-by-Step Fix

1. **On the Cloudflare API Token page**, find:
   - **Workers Scripts** (under Account → Permissions)

2. **Change the permission:**
   - Click on **Workers Scripts**
   - Change from **Read** to **Edit**

3. **Keep these existing Edit permissions** (they're good):
   - ✅ Workers Observability - Edit
   - ✅ Workers Builds Configuration - Edit
   - ✅ Workers Agents Configuration - Edit
   - ✅ Workers AI - Edit

4. **Optional but recommended:**
   - Workers KV Storage - Read (or Edit if you plan to use KV)
   - Workers Routes - Read (or Edit if you plan to use custom routes)

5. **Click Continue to Summary** or **Update Token**

---

## Minimum Required Permissions for Worker Deployment

For deploying your OAuth callback worker, you need:

### Account Level:
- ✅ **Workers Scripts** → **Edit** (REQUIRED - change from Read to Edit)
- ✅ **Workers Builds Configuration** → **Edit** (you already have this)
- ✅ **Workers Observability** → **Edit** (you already have this)

### Optional (for advanced features):
- Workers KV Storage → Read/Edit (if using KV storage)
- Workers Routes → Read/Edit (if using custom domain routes)
- Workers Tail → Read (for viewing logs)

---

## After Updating Permissions

1. **Save the token** (the token value stays the same, only permissions change)

2. **Verify in Back4App:**
   - Make sure `CLOUDFLARE_API_TOKEN` is set correctly
   - The token should now work for deployments

3. **Test deployment:**
   - Redeploy your app in Back4App
   - Or manually trigger worker deployment from Settings

---

## Why This Permission is Needed

The deployment script uses Wrangler CLI which needs **Edit** permission on **Workers Scripts** to:
- Create new workers
- Update existing workers
- Deploy worker code
- Manage worker configurations

**Read** permission only allows viewing workers, not deploying them.

---

## Quick Checklist

- [ ] Find "Workers Scripts" in the permissions list
- [ ] Change from **Read** to **Edit**
- [ ] Keep other Edit permissions as they are
- [ ] Save/Update the token
- [ ] Verify token is set in Back4App environment variables
- [ ] Test worker deployment

---

## If You Can't Find "Workers Scripts"

If you don't see "Workers Scripts" in the list:

1. **Try searching** for "Workers" in the permissions page
2. **Look for** "Cloudflare Workers" (might be named differently)
3. **Alternative:** Create a new token with the "Edit Cloudflare Workers" template:
   - Click "Create Token"
   - Use the "Edit Cloudflare Workers" template
   - This automatically sets the correct permissions

---

## Summary

**Action Required:**
Change **Workers Scripts** permission from **Read** → **Edit**

**That's it!** Once you make this change, your token will be able to deploy workers.

