# Bluesky API Authentication

AT Protocol session auth using app passwords or supported OAuth where officially enabled for the client. Resolve handle to DID and PDS before authenticated writes.

Permission/scopes model:
- Bluesky app-password/session auth does not use OAuth scopes in the classic sense. The pack must document DID, handle, PDS, accessJwt/refreshJwt, and supported OAuth only when the app is configured for it.

Token validation rules:
- Confirm the token maps to the intended native account/object before writes.
- Stop on missing scope/product access/product-access denial instead of attempting fallback behavior.
- Use the least privileged permission set for the workflow.

Official docs:
- https://docs.bsky.app/docs/get-started
- https://docs.bsky.app/docs/advanced-guides/posts
- https://docs.bsky.app/docs/advanced-guides/rate-limits
