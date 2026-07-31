# Pinterest API Authentication

Pinterest API v5 OAuth 2.0. Request minimum read/write scopes and validate the authenticated user account, board ID, section ID, and media source before writes.

Permission/scopes model:
- boards:read, boards:write, pins:read, pins:write, user_accounts:read, analytics:read, plus secret-board variants only when explicitly needed.

Token validation rules:
- Confirm the token maps to the intended native account/object before writes.
- Stop on missing scope/product access/product-access denial instead of attempting fallback behavior.
- Use the least privileged permission set for the workflow.

Official docs:
- https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/
- https://developers.pinterest.com/docs/reference/rate-limits/
