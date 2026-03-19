# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2024-05-28 - [Critical] Unauthenticated Access to Data and AI Routes
**Vulnerability:** Several sensitive routes (`/api/ai`, `/api/bundle`, `/api/sync`) lacked authentication middleware, exposing internal data and functionality to unauthenticated users. This was due to the way routers are attached in `server/index.js` where global middleware isn't automatically inherited.
**Learning:** In this Express setup, `authenticateUser` and `requireAuth` must be explicitly imported and used via `router.use()` within each individual route file (e.g., `server/routes/bundle.js`) to guarantee protection, rather than relying on top-level configuration.
**Prevention:** Always verify that newly created or existing routers include `router.use(authenticateUser)` and `router.use(requireAuth)` directly in the file defining the router to prevent unintentional data exposure.
