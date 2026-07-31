# LinkedIn Authentication

LinkedIn OAuth 2.0 with approved Community Management or Marketing products. Validate member identity, organization URN, admin role, and product access before organization writes.

Required credential handling:
- Store tokens, app passwords, refresh tokens, client secrets, and signing secrets only in the ClawChat marketplace connection.
- Verify the native account before every write. For this pack that means: Approval must include author URN, whether member or organization, exact commentary, visibility, lifecycleState, media asset URNs, target audience, and admin role proof for organizations.
- Re-authenticate or escalate on expired token, missing permission, product-access denial, account mismatch, or rate limiting.
- Never paste secrets, token responses, session cookies, app passwords, private media URLs, or webhook signing secrets into chat or generated docs.

Official docs:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version
