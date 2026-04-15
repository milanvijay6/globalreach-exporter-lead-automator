# Sentinel Security Journal

## 2024-05-22 - Unprotected Sensitive Routes & NoSQL Injection
**Vulnerability:** The `/api/leads` endpoint was completely public (missing authentication) and susceptible to NoSQL injection via `req.query` (nested objects parsed by Express/qs).
**Learning:** `express.urlencoded({ extended: true })` and `req.query` allow nested objects by default. Passing these directly to MongoDB/Parse queries (`query.status = req.query.status`) allows attackers to inject operators like `{ $ne: null }`. Also, non-blocking `authenticateUser` middleware does not prevent access if auth fails or is missing.
**Prevention:**
1. Always use a blocking `requireAuth` middleware for sensitive routes.
2. Sanitize `req.query` parameters to ensure they are primitives (strings/numbers) before passing to DB queries.
3. Use `typeof` checks to reject object inputs for fields expected to be scalars.

## 2024-04-15 - [Reflected XSS]
**Vulnerability:** Reflected Cross-Site Scripting (XSS) in `server/routes/oauth.js`
**Learning:** `res.send()` was used with template literals containing unescaped user input (`req.query.error`, `req.url`) to generate HTML error pages.
**Prevention:** Implement a standard `escapeHtml` function and always wrap user-supplied string interpolations when manually constructing HTML responses.
