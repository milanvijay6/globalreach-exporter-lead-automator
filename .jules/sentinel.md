## 2026-01-27 - [CRITICAL] Unsecured API Endpoints
**Vulnerability:** The API endpoints `/api/leads` and `/api/messages` were completely exposed without any authentication. The `authenticateUser` middleware was defined but not used in these routes (or globally), and `requireAuth` was missing entirely.
**Learning:** Checking for the existence of an auth middleware is not enough; we must verify it is *applied* to the routes. `authenticateUser` only populated the user but didn't block access, requiring an explicit check (like `requireAuth`) which was missing.
**Prevention:**
1. Always implement a `requireAuth` middleware that explicitly blocks unauthenticated requests.
2. Apply auth middleware globally or using `router.use()` at the top of route files to ensure coverage.
3. Test endpoints with `verify_security.js` or similar scripts to ensure they return 401 for anonymous users.
