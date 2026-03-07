# Sentinel Security Journal

## 2024-05-23 - Webhook Verification Timing Attacks & DoS via Array Injection
**Vulnerability:** The WeChat webhook endpoints (`GET` and `POST` `/wechat`) relied on standard string comparison (`===`) for signature verification, allowing timing attacks. They also lacked type validation on Express `req.query` inputs, allowing attackers to trigger a Denial of Service (DoS) by passing arrays (e.g., `?signature[]=...`), which would crash string manipulation operations like `Buffer.from()` or `.sort()`.
**Learning:** Security-critical comparisons like webhook signatures MUST use `crypto.timingSafeEqual()`. Furthermore, because Express parses duplicate query parameters as arrays, passing them directly to crypto functions expects strings and will throw exceptions.
**Prevention:**
1. Explicitly validate that query parameters used in security operations are primitive strings (`typeof val === 'string'`) before processing.
2. Always use `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` with explicitly defined encodings to securely compare hashes and prevent timing side-channels.

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.
