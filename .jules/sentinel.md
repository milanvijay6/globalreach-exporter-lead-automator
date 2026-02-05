## 2024-05-22 - [Critical] Unprotected Sensitive API Endpoints
**Vulnerability:** Critical API endpoints for Leads (read/write), Messages (read/write), and Products (write) were completely unprotected, allowing anonymous access to sensitive data and mutation operations.
**Learning:** `authenticateUser` middleware is non-blocking and only populates `req.user`. It must ALWAYS be paired with `requireAuth` to enforce authentication. Missing `requireAuth` led to fail-open routes.
**Prevention:** Always use `authenticateUser` and `requireAuth` together for private routes. Implement fail-closed logic in `requireAuth` to deny access if configuration is missing.
