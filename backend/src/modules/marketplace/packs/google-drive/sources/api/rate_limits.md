# Google Drive Rate Limits and Quotas

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/drive/api/guides/about-sdk
- https://developers.google.com/drive/api/guides/about-auth
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/reference/rest/v3
- https://developers.google.com/drive/api/guides/push
- https://developers.google.com/drive/api/guides/handle-errors

Google Drive documents API throttling or returns 429/5xx. Use pagination, fields masks where available, and retry headers.

Use cursor/page tokens, field selection, bounded time windows, request batching only where documented, and provider retry headers. Do not fan out writes across large object sets without approval.
