# Gmail Rate Limits and Quotas

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/gmail/api/guides
- https://developers.google.com/gmail/api/auth/about-auth
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/workspace/gmail/api/reference/rest
- https://developers.google.com/gmail/api/guides/push
- https://developers.google.com/workspace/gmail/api/guides/handle-errors

Gmail API usage is subject to provider quotas/throttling. Use pagination, bounded searches, exponential backoff, and provider retry headers.

Use cursor/page tokens, field selection, bounded time windows, request batching only where documented, and provider retry headers. Do not fan out writes across large object sets without approval.
