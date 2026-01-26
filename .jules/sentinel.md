## 2026-01-26 - Unsecured Sensitive Endpoints
**Vulnerability:** API endpoints for leads and messages were publicly accessible without authentication, allowing unauthorized access to sensitive user data.
**Learning:** `authenticateUser` middleware is non-blocking by design. Developers must explicitly add a blocking check (like `requireAuth`) for sensitive routes.
**Prevention:** Introduced `requireAuth` middleware and enforced it on `/api/leads` and `/api/messages`. Added integration tests to verify access control.
