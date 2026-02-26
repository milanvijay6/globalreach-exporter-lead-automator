# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2026-02-26 - Route Shadowing & NoSQL Injection in Products API
**Vulnerability:** The `/api/products/search` endpoint was unreachable due to route shadowing by the generic `/:id` route defined earlier. Additionally, both list and search endpoints accepted unsanitized `req.query` parameters, allowing NoSQL injection via object payloads (e.g., `?category[$ne]=electronics`) passed directly to `Parse.Query`.
**Learning:**
1. Express route order matters: specific routes (e.g., `/search`) must be defined *before* parameter-based routes (e.g., `/:id`) to prevent shadowing.
2. `Parse.Query` methods like `equalTo` are vulnerable to NoSQL injection if passed object inputs from `req.query` (enabled by `extended: true` body parser).
**Prevention:**
1. Explicitly order routes from most specific to least specific.
2. Implement strict type checking (e.g., `typeof val === 'string'`) for all query parameters before using them in database queries.
