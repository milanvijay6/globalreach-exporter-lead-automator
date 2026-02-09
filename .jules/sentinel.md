## 2026-02-01 - [Fail-Closed Auth Middleware]
**Vulnerability:** The `leads` endpoint was completely unprotected. When implementing protection, I initially matched the existing `authenticateUser` middleware's "Fail-Open" logic (allowing requests if Parse is not configured). This would have left the app vulnerable if the auth provider failed to initialize.
**Learning:** Consistency with existing patterns should not override security principles. Authentication middleware must "Fail-Closed" (deny access) when configuration is invalid or missing, to prevent accidental exposure of sensitive data.
**Prevention:** Implement explicit checks in auth middleware that return 500/401 errors when critical dependencies (like Parse Application ID) are missing, rather than skipping the check.
