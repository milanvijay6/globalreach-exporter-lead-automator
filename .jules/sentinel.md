## 2024-05-22 - [CRITICAL] Unauthenticated Product Mutation
**Vulnerability:** Product creation, update, and deletion endpoints (`POST`, `PUT`, `DELETE` /api/products) were completely unprotected, allowing any user (authenticated or not) to modify the product catalog.
**Learning:** `useMasterKey: true` in Parse queries bypasses all ACLs/CLPs. When used in custom Express routes, it MUST be paired with strict application-level authentication checks (`requireAuth`), otherwise the endpoint acts as a "sudo" command for anyone.
**Prevention:** Always apply `requireAuth` middleware to any route that performs mutation operations, especially when `useMasterKey: true` is used internally.
