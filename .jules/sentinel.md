# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2024-05-23 - Unprotected AI Generation Routes
**Vulnerability:** The `/api/ai/stream/*` endpoints were exposed without any authentication middleware, allowing unauthorized access to costly LLM APIs (Gemini).
**Learning:** Adding new route files without a global authentication strategy (or forgetting to copy-paste middleware) leaves endpoints vulnerable by default. `authenticateUser` alone is insufficient if it's not applied or if `requireAuth` is missing.
**Prevention:**
1. Apply authentication middleware globally or at the `router.use()` level for entire route files to ensure no handler is missed.
2. Implement automated tests that scan all API routes for unauthenticated access (e.g., ensure 401/403 is returned for all `/api/*` routes without a valid token).
