# Sentinel Journal

## 2025-05-20 - Missing Authentication on Critical Endpoints
**Vulnerability:** Products API endpoints (POST/PUT/DELETE) were completely public and used `useMasterKey: true`, allowing any user to modify product data.
**Learning:** `useMasterKey: true` bypasses all Parse security, so explicit authentication checks are mandatory in the route handler.
**Prevention:** Always apply authentication middleware and verify `req.user` existence before performing sensitive operations, especially when using master key.
