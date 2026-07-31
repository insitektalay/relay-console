# Stripe Workflow Router

Use Stripe when the user asks an agent to inspect or operate payments, invoices, subscriptions, customers, payment links, refunds, disputes, balances, products, prices, or webhook delivery.

Do not use Stripe for CRM-only tasks, email-only tasks, fulfillment operations outside Stripe, accounting journal entries outside Stripe, tax/legal/business-setting changes, or any request that asks for raw payment data.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Load Order

1. Read `auth.md` before asking for setup or discussing credentials.
2. Read `permissions.md` before deciding whether an action is available.
3. Read `safe_actions.md` before any write, invoice send, payment link, refund, subscription change, product or price change, webhook change, or customer billing update.
4. Read the most specific API or workflow file for the request.
5. For ambiguity, missing credentials, insufficient capability, or approval-required actions without approval, stop and escalate.

## Operating Rules

- Prefer read and draft workflows over live state changes.
- Treat live mode as higher risk than sandbox or test mode.
- Confirm customer, amount, currency, object IDs, environment, and business reason before any approval-required action.
- Use idempotency for retries of create/update operations when a runtime tool supports it.
- Never print, store, summarize, or forward API keys, restricted keys, webhook signing secrets, client secrets, OAuth secrets, raw card data, or encrypted secret payloads.
- Audit every Stripe write plan, approval request, approval result, and executed state change.

## Ambiguous Requests

Ask the user to clarify when the request omits the target customer, invoice, subscription, amount, currency, environment, approval state, or whether the action should be a draft or live operation.
