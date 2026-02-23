# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2024-05-23 - Shadowed Route & NoSQL Injection in Products API
**Vulnerability:** The `/api/products` and `/api/products/search` endpoints were vulnerable to NoSQL injection via unsanitized `req.query` parameters. Additionally, `/api/products/search` was unreachable (shadowed by `/:id`), causing 500 errors instead of functioning correctly.
**Learning:** Route definition order is critical in Express. `/:id` matches `/search` if defined first. This can mask vulnerabilities or broken features. Also, `express.urlencoded({ extended: true })` makes NoSQL injection trivial if inputs are not type-checked.
**Prevention:**
1. Define static routes (like `/search`) before dynamic routes (like `/:id`).
2. Always validate `typeof` for query parameters before using them in database queries.
