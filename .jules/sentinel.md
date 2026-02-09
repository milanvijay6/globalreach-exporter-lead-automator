## 2025-01-25 - Unprotected Master Key Usage
**Vulnerability:** Multiple API endpoints (`/api/products`, `/api/leads`) were performing mutation operations using `useMasterKey: true` without any authentication or authorization checks.
**Learning:** The codebase relies on `useMasterKey: true` to bypass ACLs for convenience but failed to implement application-level checks (middleware) to restrict access. This indicates a pattern of prioritizing functionality over security in the backend.
**Prevention:** Enforce `requireAuth` middleware on all routes that perform mutations or access sensitive data, especially those using `useMasterKey: true`.
