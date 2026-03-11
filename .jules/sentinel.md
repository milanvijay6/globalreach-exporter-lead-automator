# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-10 - Webhook Security Gaps
**Vulnerability:** A SyntaxError in `server/routes/webhooks.js` (caused by duplicate variable declarations) prevented the entire webhook router from loading, effectively disabling all webhook processing. Additionally, the existing signature verification logic was vulnerable to timing attacks (using `===` instead of `crypto.timingSafeEqual`) and type confusion (missing type checks for query parameters).
**Learning:** Duplicate code blocks from copy-paste errors can silently fail or crash modules. Security checks must be robust against invalid input types (e.g. array vs string) to prevent crashes (DoS).
**Prevention:** Always verify file syntax after editing. Use `crypto.timingSafeEqual` for all secret comparisons. Explicitly validate input types for sensitive parameters before use.
