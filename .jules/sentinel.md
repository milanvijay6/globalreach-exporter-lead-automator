# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-13 - Webhook Syntax Error & Timing Attack
**Vulnerability:**
1. Critical `SyntaxError` in `server/routes/webhooks.js` due to variable redeclaration (`appSecret`, `signature`), causing the entire module to fail (safeRequire caught it, but endpoint was 404).
2. WeChat webhook signature verification used insecure string comparison (`===`), vulnerable to timing attacks.

**Learning:**
1. Copy-paste errors can lead to variable redeclaration and broken endpoints. Automated linting/testing of all routes on startup is crucial.
2. Comparing HMAC signatures as strings leaks timing information. Attackers can guess the signature byte-by-byte.

**Prevention:**
1. Use `crypto.timingSafeEqual` for all signature verifications.
2. Ensure inputs to `timingSafeEqual` are Buffers of equal length.
3. Add unit tests that verify both valid and invalid signatures (including "correct length but wrong content").
