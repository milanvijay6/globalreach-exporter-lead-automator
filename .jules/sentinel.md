# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-20 - NoSQL Injection in Messages API
**Vulnerability:** The `/api/messages` endpoint was vulnerable to NoSQL injection via `req.query` parameters (`importerId`, `channel`, `status`). Because `express.urlencoded({ extended: true })` parses nested objects, attackers could pass `{ $ne: null }` as a parameter value, bypassing filters.
**Learning:** Even with authentication (`requireAuth`), NoSQL injection can still occur if query parameters are passed directly to `Parse.Query` or MongoDB drivers without type checking. `req.query` is untrusted input.
**Prevention:**
1. Explicitly validate and type-check all `req.query` parameters before use (e.g., `typeof param === 'string'`).
2. Reject or sanitize object inputs for fields expected to be scalars.
3. Use a centralized validation middleware or schema validation (like Zod) for all API inputs.
