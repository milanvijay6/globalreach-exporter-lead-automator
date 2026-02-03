## 2026-02-03 - Missing Authentication on Leads Endpoint
**Vulnerability:** The `/api/leads` endpoint was publicly accessible without any authentication. This Critical vulnerability exposed sensitive lead data (names, companies, contact details) to unauthenticated requests.
**Learning:** The existing `authenticateUser` middleware was designed to be non-blocking (populating `req.user` if present, but allowing the request if not). There was no `requireAuth` middleware exported to enforce authentication. Developers likely assumed `authenticateUser` was sufficient or forgot to add a blocking check.
**Prevention:**
1. Implemented a strict `requireAuth` middleware in `server/middleware/auth.js` that returns 401 if no user is present.
2. Applied `authenticateUser` and `requireAuth` to the entire `server/routes/leads.js` router.
3. Future prevention: Use a "Fail Closed" approach where routes are protected by default, or use a linter rule to ensure sensitive routes have auth middleware.
