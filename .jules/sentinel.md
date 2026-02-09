## 2024-05-23 - Broken Access Control in /api/leads
**Vulnerability:** The `/api/leads` endpoint was exposing sensitive lead data to unauthenticated requests.
**Learning:** The `authenticateUser` middleware populates `req.user` but does not enforce authentication (fail-open), allowing execution to proceed even if authentication fails or is missing.
**Prevention:** Always pair `authenticateUser` with `requireAuth` to explicitly block unauthenticated requests. Use `router.use(authenticateUser, requireAuth)` at the router level for sensitive resource groups.
