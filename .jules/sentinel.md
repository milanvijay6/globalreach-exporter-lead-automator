# Sentinel Journal

## 2026-02-04 - Missing Authentication Middleware and Unprotected Routes

**Vulnerability:** The `server/middleware/auth.js` module was missing the `requireAuth` export despite documentation/memory suggesting it existed. Consequently, sensitive mutation routes in `server/routes/products.js` (CREATE, UPDATE, DELETE) and `server/routes/leads.js` (SEND) were completely unprotected, allowing unauthenticated users to modify data.

**Learning:** Relying on memory or documentation about security controls without verifying the implementation code can lead to false security. The codebase had endpoints that used `useMasterKey: true` internally but lacked the corresponding application-level authentication checks.

**Prevention:** Always verify that security middleware is both *implemented* and *applied* to sensitive routes. Use "fail-closed" mechanisms where possible. Automated tests should verify that unauthenticated requests to mutation endpoints are rejected (401/403).
