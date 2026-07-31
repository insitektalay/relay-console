# Stripe Read Actions

Use read actions to inspect Stripe state and produce safe internal summaries.

## Safe Read Workflow

1. Confirm environment.
2. Confirm selected capability covers the object family.
3. Use exact object IDs when available.
4. Minimize expansions and pagination.
5. Summarize only operationally necessary fields.
6. Do not expose raw payment data or secrets.

## Safe Summaries

Safe summaries may include:

- Customer ID and non-sensitive metadata.
- Invoice status, amount, currency, due date, hosted invoice URL availability, and payment status.
- Subscription status, items, renewal date, trial status, and cancellation state.
- Payment link status and line items.
- Refund status and amount.
- Dispute status and deadline.
- Balance totals and transaction IDs where appropriate.

Do not include raw card data, client secrets, API keys, webhook signatures, full authentication headers, or sensitive personal data beyond the user request.
