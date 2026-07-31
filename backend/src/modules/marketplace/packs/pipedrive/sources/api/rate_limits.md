# Pipedrive Rate Limits

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Official docs: https://pipedrive.readme.io/docs/core-api-concepts-rate-limiting

Pipedrive documents token-based daily budgets and burst limits. The daily budget is shared by the company account and depends on subscription plan, seats, and top-ups. API token and OAuth traffic consumes the budget. Burst limits apply per token over a rolling two-second window, with headers such as `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, and `x-daily-requests-left`.

Use webhooks and optimized endpoints to reduce polling. Do not perform unapproved bulk updates or high-volume searches that deplete the token budget.
