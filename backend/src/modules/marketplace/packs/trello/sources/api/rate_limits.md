# Trello Rate Limits and Quotas

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/trello/rest/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
- https://developer.atlassian.com/cloud/trello/rest/api-group-cards/

Trello documents API key/token rate limits; honor 429

Use cursor/page tokens, field selection, bounded time windows, request batching only where documented, and provider retry headers. Do not fan out writes across large object sets without approval.
