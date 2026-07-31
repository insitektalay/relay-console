# GitHub Webhooks and Events

Webhook access is useful when an agent needs to understand event-driven repository activity or inspect delivery status.

Use webhook surfaces for:

- checking whether a repository webhook exists
- checking recent webhook deliveries
- correlating repository events with downstream automation

Rules:

- Treat webhook creation or editing as a state-changing admin operation.
- Treat delivery redelivery and webhook disablement as approval-gated operations.
- If webhook behavior is central to the request, confirm event type and delivery target before taking action.
