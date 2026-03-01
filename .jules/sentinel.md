# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2025-01-20 - Missing Authentication on Integrations Endpoints
**Vulnerability:** The `/api/integrations` routes (in `server/routes/integrations.js`), including sensitive status checks and service disconnects, entirely lacked authentication, meaning unauthenticated users could interact with and disable internal integration statuses.
**Learning:** Even critical administrative endpoints in this codebase may miss global middleware like `authenticateUser` and `requireAuth` because authentication is applied per-router file rather than globally across all `/api/*` paths.
**Prevention:** Apply `router.use(authenticateUser); router.use(requireAuth);` at the top of any backend routing file that handles sensitive queries or mutations, instead of trusting that a root layer enforces it automatically.
