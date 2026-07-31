# Zendesk Rate Limits

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Official docs: https://developer.zendesk.com/api-reference/introduction/rate-limits/

Zendesk documents account and plan limits, endpoint-specific limits, ticketing API headers, job limits, and `429` responses with `Retry-After`. Examples include Support API per-minute limits by plan, Update Ticket limits for repeated updates to the same ticket, incremental export limits, and queued job limits for bulk endpoints.

Respect rate-limit headers, cursor pagination, and job queue limits. Do not run unapproved bulk ticket/user/organization operations.
