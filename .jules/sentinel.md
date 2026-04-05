# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2024-05-24 - Timing Attack & DoS Vulnerability in Webhook Signatures
**Vulnerability:** The WeChat webhook endpoints (`GET /wechat` and `POST /wechat`) used standard string comparison (`===` and `!==`) to verify signatures, exposing the app to timing attacks. Additionally, lacking type validation on `req.query.signature` allowed potential DoS attacks if an array was injected, leading to buffer creation issues in timingSafeEqual.
**Learning:** Webhook signature verification is security-critical and standard string comparison is insecure because it returns early, allowing attackers to guess hashes byte-by-byte. Express query parameters can be arrays, which can crash functions expecting strings or single values.
**Prevention:**
1. Always use `crypto.timingSafeEqual` with `Buffer` objects for hash and signature comparisons.
2. Verify that the signature inputs are strictly strings (`typeof signature === 'string'`) before processing to prevent array injection DoS.
3. Check that the lengths of the buffers match before comparing them with `timingSafeEqual`.
