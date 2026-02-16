# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-16 - Webhook Verification Flaws & Model Mismatch
**Vulnerability:** `server/routes/webhooks.js` contained a Syntax Error (redeclared variables) preventing server start, duplicate conflicting WhatsApp verification logic, and a timing attack vulnerability in WeChat signature verification (using `===`). It also used `WebhookLog` incorrectly as a Parse Object causing potential crashes.
**Learning:** Copy-pasting security blocks can lead to duplicate variable declarations and syntax errors. Using `===` for signature comparison leaks timing information. Assuming a model is a Parse Object/Mongoose model without checking can lead to runtime errors (`TypeError`).
**Prevention:**
1. Use `crypto.timingSafeEqual` for all cryptographic signature comparisons.
2. Verify model implementation (e.g., static vs instance methods) before use.
3. Consolidate security verification logic into a single, authoritative block.
4. Ensure `req.query` parameters are type-checked (e.g. strings) before use in crypto functions.
