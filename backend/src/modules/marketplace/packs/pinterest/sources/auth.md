# Pinterest Authentication

Pinterest API v5 OAuth 2.0. Request minimum read/write scopes and validate the authenticated user account, board ID, section ID, and media source before writes.

Required credential handling:
- Store tokens, app passwords, refresh tokens, client secrets, and signing secrets only in the ClawChat marketplace connection.
- Verify the native account before every write. For this pack that means: Approval must name board ID, board section ID if any, Pin title, description, link, alt text, media source type, dominant media URL/file reference, and whether the board is public or secret.
- Re-authenticate or escalate on expired token, missing permission, product-access denial, account mismatch, or rate limiting.
- Never paste secrets, token responses, session cookies, app passwords, private media URLs, or webhook signing secrets into chat or generated docs.

Official docs:
- https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/
- https://developers.pinterest.com/docs/reference/rate-limits/
