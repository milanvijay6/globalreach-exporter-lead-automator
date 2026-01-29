# Sentinel Security Journal

## 2026-01-29 - Missing Authentication on Leads Endpoint
**Vulnerability:** The `/api/leads` endpoints (GET list, POST send message) were completely unprotected. Any user could list all leads and send messages without authentication.
**Learning:** The `authenticateUser` middleware was implemented but not blocking (it called `next()` even if no user was found). A `requireAuth` middleware was referenced in documentation/memory but not implemented in code. Developers might have assumed `authenticateUser` was enough or that `requireAuth` existed.
**Prevention:** Always verify middleware behavior. Implement explicit `requireAuth` that returns 401. Apply auth middleware globally or systematically verify each route file.
