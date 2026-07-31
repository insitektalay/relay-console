# Lemon Squeezy Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.lemonsqueezy.com/api
- https://docs.lemonsqueezy.com/guides/developer-guide/getting-started
- https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
- https://docs.lemonsqueezy.com/guides/developer-guide/managing-subscriptions
- https://docs.lemonsqueezy.com/guides/developer-guide/webhooks
- https://docs.lemonsqueezy.com/help/webhooks
- https://docs.lemonsqueezy.com/api/license-api
- https://docs.lemonsqueezy.com/api/license-keys/the-license-key-object
- https://docs.lemonsqueezy.com/api/variants/the-variant-object

## Pack Doctrine

- Operate only against a Lemon Squeezy store API connection.
- Verify environment, provider object IDs, selected capabilities, and approval profile before writes.
- Prefer read and draft workflows until a concrete approval exists for side effects.
- Redact secrets, full tokens, webhook secrets, raw payment data, and unnecessary customer billing details.
- Record provider ids, request purpose, approval id, and safe response summaries after approved writes.

## Safe Without Additional Approval

- Read stores, products, variants, prices, files, orders, customers, subscriptions, subscription invoices, license keys, discounts, checkouts, and webhooks.
- Summarize commerce, subscription, license, file/download, and customer/order state with private data minimized.
- Prepare proposed checkout, discount, subscription, refund, license, file, or webhook changes without side effects.

## Safe Draft Pattern

- State the provider environment and object IDs.
- Include exact endpoint or mutation family, proposed fields, amount/currency where relevant, and customer-facing effect.
- Stop before POST/PATCH/DELETE or mutation execution when approval is required.

## Never Safe

- Expose API keys, webhook signing secrets, full license keys where a short key is enough, or raw payment data.
- Delete customer/order/payment records, broaden permissions, disable security/fraud protections, change legal/tax/business settings, or perform destructive bulk commerce/license actions.
- Revoke license or subscription entitlements without explicit approval.
