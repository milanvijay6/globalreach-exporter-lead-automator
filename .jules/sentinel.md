# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.
## 2024-05-30 - [Missing Authentication and IDOR on Push Notification Routes]
**Vulnerability:** The `/api/push-notifications/send` and `/api/push-notifications/unregister` endpoints were lacking authentication, allowing anyone to send push notifications to any user or unregister any token. Furthermore, `/register` allowed IDOR spoofing via unvalidated `userId` in the body/headers.
**Learning:** Adding new functional routes often skips adding existing global middleware (`authenticateUser`) and strict `requireAuth` protection unless explicitly written. `userId` taken from body without validating against session token is a persistent IDOR vector.
**Prevention:** Ensure new route routers use `router.use(authenticateUser)` if applicable. Enforce `requireAuth` on any state-mutating endpoints and use `req.user.id || req.userId` rather than trusting `req.body.userId`.
