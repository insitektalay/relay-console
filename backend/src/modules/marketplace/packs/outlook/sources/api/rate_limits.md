# Outlook Rate Limits and Quotas

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview
- https://learn.microsoft.com/en-us/graph/auth/
- https://learn.microsoft.com/en-us/graph/permissions-reference
- https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
- https://learn.microsoft.com/en-us/graph/change-notifications-overview
- https://learn.microsoft.com/en-us/graph/throttling
- https://learn.microsoft.com/en-us/graph/errors

Outlook API usage is subject to provider quotas/throttling. Use pagination, bounded searches, exponential backoff, and provider retry headers.

Use cursor/page tokens, field selection, bounded time windows, request batching only where documented, and provider retry headers. Do not fan out writes across large object sets without approval.
