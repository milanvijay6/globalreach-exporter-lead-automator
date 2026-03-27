# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-14 - Webhook Signature Verification Flaws
**Vulnerability:** The WeChat webhook verification used insecure string comparison (`sha1 === signature`), making it vulnerable to timing attacks. Additionally, type juggling (passing arrays as query params) could cause `sort()` to behave unexpectedly. A duplicate, broken code block in the WhatsApp handler caused a syntax error and confusion.
**Learning:** String comparison stops at the first mismatch, leaking timing information about the valid signature prefix. Javascript's `req.query` can return arrays if keys are repeated, bypassing expected string operations.
**Prevention:**
1. Always use `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` for cryptographic signature comparisons.
2. Explicitly cast untrusted inputs to expected types (e.g., `String()`) before use in cryptographic operations.
3. Ensure `req.rawBody` is used for HMAC verification to avoid JSON serialization discrepancies.
