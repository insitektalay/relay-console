# Stripe API Overview

Official source: https://docs.stripe.com/apis

Stripe provides REST APIs for payments, billing, subscriptions, invoicing, payouts, financial workflows, and account operations. This pack focuses on agent-safe operation of customers, invoices, subscriptions, payment links, refunds, disputes, balances, products, prices, and webhook endpoints.

## Agent Operating Scope

- Use read endpoints to understand state.
- Use preview and draft endpoints before live billing changes.
- Use write endpoints only when capability and approval policy permit.
- Prefer exact object IDs over broad search when the user intends a state change.
- Do not infer behavior for endpoints not covered by this pack; consult official docs and escalate if uncertain.

## Official Docs Used

- API overview: https://docs.stripe.com/apis
- Authentication: https://docs.stripe.com/api/authentication
- API keys: https://docs.stripe.com/keys
- Customers: https://docs.stripe.com/api/customers
- Invoices: https://docs.stripe.com/api/invoices
- Subscriptions: https://docs.stripe.com/api/subscriptions
- Payment Links: https://docs.stripe.com/api/payment-link
- Refunds: https://docs.stripe.com/api/refunds
- Products: https://docs.stripe.com/api/products
- Prices: https://docs.stripe.com/api/prices
- Webhook endpoints: https://docs.stripe.com/api/webhook_endpoints
- Webhooks: https://docs.stripe.com/webhooks
- Errors: https://docs.stripe.com/error-handling
- Rate limits: https://docs.stripe.com/rate-limits
