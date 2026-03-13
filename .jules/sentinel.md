# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2024-05-23 - Unprotected Push Notifications & IDOR via Header Spoofing
**Vulnerability:** The `/api/push-notifications` endpoints lacked `requireAuth` protection entirely. In addition, the endpoint fell back to resolving `userId` from `req.headers['x-user-id']` or `req.body.userId` if no session token was provided, enabling IDOR (Insecure Direct Object Reference).
**Learning:** Endpoints mapped directly to `app.use` in Express routers don't automatically enforce auth unless a blocking middleware (like `requireAuth`) is explicitly mounted inside the router or at the top level route definition. Relying on headers like `X-User-Id` for user identification without strict backend session validation allows attackers to easily spoof their identity.
**Prevention:**
1. Always apply `router.use(authenticateUser)` and `router.use(requireAuth)` in protected route files or at the app level.
2. Never trust client-provided `userId` parameters or `X-User-Id` headers for sensitive operations—always use the authenticated `req.userId` established by backend session validation.
