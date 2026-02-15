# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-15 - Unprotected Config API
**Vulnerability:** The `/api/config` endpoints were accessible to unauthenticated users because `router.use(authenticateUser)` was used without `router.use(requireAuth)`. `authenticateUser` only populates the user object but does not block requests if the user is missing.
**Learning:** `authenticateUser` is a "fail-open" middleware designed to be used with optional authentication, whereas `requireAuth` is the "fail-closed" gatekeeper. Relying solely on `authenticateUser` leaves endpoints exposed.
**Prevention:** Always pair `authenticateUser` with `requireAuth` for sensitive routes. Use `router.use(requireAuth)` at the top of the route file or immediately after `authenticateUser` if all routes in the file require protection.
