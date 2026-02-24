# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-24 - Webhook Signature Verification Flaws
**Vulnerability:** The WhatsApp webhook handler contained duplicate variable declarations causing a `SyntaxError` (server crash) and an insecure fallback that used `JSON.stringify(req.body)` for signature verification, which is unreliable due to non-deterministic JSON key ordering. The WeChat handler used `===` for signature comparison (timing attack) and lacked input type validation, allowing a DoS via array injection (Express query parameter pollution).
**Learning:** Copy-pasting code without removing the old version can lead to critical runtime errors. Relying on `JSON.stringify` for HMAC verification is fundamentally flawed because the payload string must match byte-for-byte with what the provider signed. Timing attacks on signature verification are subtle but real risks. Input validation (type checking) is crucial even for cryptographic functions to prevent crashes.
**Prevention:**
1. Always use `req.rawBody` (captured via `express.json({ verify: ... })`) for signature verification.
2. Use `crypto.timingSafeEqual` for all cryptographic comparisons.
3. Validate input types (e.g., `typeof signature === 'string'`) before processing, especially when using libraries that might throw on unexpected types (like `Buffer.from`).
4. Ensure comprehensive test coverage for webhook handlers including valid, invalid, missing signatures, and edge cases (array injection).
