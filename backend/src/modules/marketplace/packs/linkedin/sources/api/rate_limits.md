# LinkedIn Rate Limits And Quotas

LinkedIn rate limits depend on application, member, organization, and product. The pack must treat 429 and service-specific throttles as hard stops and record any response headers; do not claim fixed universal quotas.

Operational rules:
- Treat 429, product-tier errors, product-access denial, and quota exhaustion as hard stops.
- Do not split work across tokens/accounts to evade platform limits.
- Record provider response headers/metadata when available and back off rather than retrying blindly.

Official docs:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version
