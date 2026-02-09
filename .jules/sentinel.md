## 2024-05-23 - Critical: Unauthenticated Product Mutation
**Vulnerability:** The `authenticateUser` middleware only populates `req.user` if a token is present but does not block requests if it's missing. The `server/routes/products.js` endpoints (POST, PUT, DELETE) were using `authenticateUser` implicitly (or not at all) without checking `if (!req.user)`, allowing unauthenticated users to modify the product catalog.
**Learning:** Middleware names can be misleading. `authenticateUser` sounds like a gatekeeper, but it's actually just a context populator. Always verify if middleware blocks or just augments.
**Prevention:** In every sensitive route handler, explicitly check for `req.user` existence or use a dedicated `requireAuth` middleware that throws 401.
