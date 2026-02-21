# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-21 - Duplicate Code & Insecure HMAC Verification Fallback
**Vulnerability:** A critical `SyntaxError` (duplicate variable declaration) was introduced by copying a code block without removing the old one, which would have crashed the server. The duplicated block also introduced an insecure fallback for HMAC verification using `JSON.stringify(req.body)`, which is vulnerable to formatting differences and bypasses.
**Learning:** `JSON.stringify()` is not deterministic enough for cryptographic signature verification (HMAC). Raw body capture is mandatory. Additionally, syntax errors in route handlers can be missed if CI doesn't run tests that load all routes.
**Prevention:**
1. Always use `req.rawBody` (or equivalent buffer) for webhook signature verification.
2. Never rely on `JSON.stringify()` for re-creating signed payloads.
3. Ensure CI runs a "smoke test" that at least requires/loads all route modules to catch syntax errors before deployment.
