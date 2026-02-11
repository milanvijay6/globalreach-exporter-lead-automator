# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-11 - Webhook Signature Verification Fix
**Vulnerability:** WhatsApp webhook verification logic was duplicated, causing a syntax error (redeclaration of `appSecret`) and potential bypass. WeChat verification lacked type checking for input parameters.
**Learning:** Duplicate code blocks can lead to severe bugs and syntax errors that might go unnoticed if the file isn't loaded during startup or tests.
**Prevention:** Always use linting tools to catch variable redeclarations. Implement strict type checking for all external inputs before using them in cryptographic functions or logical operations.
