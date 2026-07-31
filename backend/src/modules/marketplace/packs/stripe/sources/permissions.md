# Stripe Permissions

Stripe permissions depend on the API key, restricted key resource permissions, OAuth scopes, account mode, and the selected ClawChat capabilities.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Capability Mapping

- `customers_read`: read customers and related billing status.
- `customers_write`: create or update customers within approval policy.
- `invoices_read`: read and search invoices.
- `invoices_draft`: create invoice previews, invoice items, and draft invoices without sending or collection.
- `invoices_send`: finalize, send, pay, void, or mark invoices uncollectible after approval.
- `subscriptions_read`: read and search subscriptions.
- `subscriptions_manage`: create, update, pause, resume, migrate, or cancel subscriptions after approval.
- `payment_links_create`: create or update payment links after approval.
- `refunds_create`: create refunds after approval.
- `disputes_read`: read disputes and evidence deadlines.
- `balance_read`: read balance and balance transactions.
- `products_prices_read`: read products and prices.
- `products_prices_write`: create or update products and prices after approval.
- `webhooks_manage`: inspect or modify webhook endpoints within approval policy.

## Permission Rule

If the selected capability is missing, do not attempt the operation. Explain the missing capability and ask the user to update the marketplace connection or choose a different task.

## Environment Rule

Sandbox or test mode operations must not be treated as proof that live mode is approved. Live money movement still requires approval.
