# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2024-05-23 - Unprotected AI and Integrations Routes
**Vulnerability:** The `/api/ai`, `/api/ai/jobs`, and `/api/integrations` routes lacked authentication completely, making expensive AI operations and sensitive integration statuses accessible to unauthorized users.
**Learning:** `express.Router()` instances mounted in `index.js` don't inherit global middleware automatically unless applied before the mount. If `authenticateUser` or `requireAuth` aren't explicitly used via `router.use()` within the module or passed during mounting, the routes are public.
**Prevention:**
1. Explicitly import and apply `authenticateUser` and `requireAuth` at the top of route files handling sensitive operations.
2. Ensure route definitions are tested for `401 Unauthorized` responses before releasing new controllers.
