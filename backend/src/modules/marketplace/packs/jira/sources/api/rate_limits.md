# Jira Rate Limits and Quotas

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
- https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- https://developer.atlassian.com/platform/forge/manifest-reference/scopes-product-jira/
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
- https://developer.atlassian.com/cloud/jira/platform/rate-limiting/
- https://developer.atlassian.com/cloud/jira/platform/webhooks/

Atlassian rate limiting with 429 and Retry-After

Use cursor/page tokens, field selection, bounded time windows, request batching only where documented, and provider retry headers. Do not fan out writes across large object sets without approval.
