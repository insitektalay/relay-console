# Twilio Rate Limits and Quotas

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.twilio.com/docs/usage/api
- https://www.twilio.com/docs/usage/requests-to-twilio
- https://www.twilio.com/docs/messaging/api/message-resource
- https://www.twilio.com/docs/usage/webhooks
- https://www.twilio.com/docs/usage/rest-api-best-practices
- https://www.twilio.com/docs/api/errors

Twilio has product-specific throughput, carrier, sender, and account limits. Respect 429 responses, messaging service throughput, WhatsApp/template restrictions, and carrier filtering; do not retry sends aggressively.

Use cursor/page tokens, field selection, bounded time windows, request batching only where documented, and provider retry headers. Do not fan out writes across large object sets without approval.
