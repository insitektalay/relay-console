# Stripe Write Actions

Stripe writes require capability checks and approval checks. Treat any live money movement, customer-facing billing change, or recurring billing change as high risk.

## Preflight

1. Load `safe_actions.md`.
2. Confirm environment.
3. Confirm selected capability.
4. Confirm approval profile.
5. Confirm target object IDs.
6. Confirm amount, currency, timing, reason, customer impact, and reversibility when relevant.
7. Ask for approval if the operation is approval-required.

## Draft Writes

Draft invoices may be allowed under `invoices_draft` and the current approval profile. The agent must keep the invoice in draft state and must not finalize, send, pay, or enable automatic collection unless approval exists.

## Approval-Gated Writes

Approval is required for:

- Invoice finalization, send, pay, void, or uncollectible state.
- Payment link creation or update.
- Refund creation or cancelation.
- Subscription creation, update, pause, resume, migration, or cancellation.
- Customer billing details, invoice settings, tax ID, or payment settings updates.
- Product or price creation or update.
- Webhook endpoint creation, update, disable, or deletion.

## Post-Execution

After an approved write, report:

- Operation.
- Environment.
- Target object IDs.
- Amount and currency if relevant.
- Provider result ID or status.
- Audit note.

Do not report secrets or sensitive payment payloads.
