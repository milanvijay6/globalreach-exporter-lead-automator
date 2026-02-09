## 2024-05-22 - Missing Authorization Middleware
**Vulnerability:** Critical routes like `/api/leads` were completely unprotected because `authenticateUser` only populated the user but didn't block unauthenticated requests.
**Learning:** Middleware that populates user context must always be paired with middleware that enforces authentication. The "fail-open" default of `authenticateUser` left the API vulnerable.
**Prevention:** Always implement and enforce a "Fail-Closed" `requireAuth` middleware on sensitive routes.
