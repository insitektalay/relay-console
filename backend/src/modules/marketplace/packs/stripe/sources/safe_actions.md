# Stripe Safe Actions

Stripe is a money-movement system. Reads and drafts are generally safe when capabilities allow them. Live financial, customer-facing, or billing-state changes require explicit approval.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Read customers, invoices, subscriptions, products, prices, disputes, balances, and webhook configuration when capabilities allow.
- Create internal summaries.
- Prepare billing change plans.
- Create invoice previews.
- Create draft invoices when `invoices_draft` is enabled and the invoice is not finalized, sent, paid, or configured for automatic live collection.

## Approval Required

- Finalize, send, pay, void, or mark an invoice uncollectible.
- Create or update a live payment link.
- Create checkout/payment surfaces that can collect money.
- Issue or cancel a refund.
- Create, update, pause, resume, migrate, or cancel a subscription.
- Update customer billing details, invoice settings, tax IDs, or payment settings.
- Create or update products or prices.
- Create, update, disable, or delete webhook endpoints.

## Blocked

- Delete customer records.
- Expose API keys, restricted keys, webhook signing secrets, client secrets, raw card data, private keys, OAuth client secrets, or encrypted secret payloads.
- Disable fraud or security controls.
- Change tax, legal, business profile, compliance, payout, or bank-account settings.
- Grant broader permissions or create broader keys.
- Access raw card data.
- Move money without approval.

## Approval Request Minimum

Before requesting approval, provide:

- Environment.
- Customer or object ID.
- Amount and currency when money is involved.
- Exact Stripe object and operation.
- Risk and customer impact.
- Expected result.
- Whether the operation is reversible.

## Audit Minimum

For executed writes, record the requested operation, approving user, approval profile, target object IDs, amount/currency if applicable, environment, provider response ID when available, and result.
