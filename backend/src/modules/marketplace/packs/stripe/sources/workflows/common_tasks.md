# Stripe Common Tasks

## Inspect Customer Billing State

1. Confirm environment.
2. Identify customer by exact customer ID or unambiguous search terms.
3. Read customer, invoices, subscriptions, and relevant payment status.
4. Summarize state without exposing sensitive payment data.

## Draft Invoice

1. Confirm customer, line items, amounts, currency, due date, and environment.
2. Confirm `invoices_draft` is enabled.
3. Create a preview or draft only.
4. Do not finalize, send, pay, or collect.
5. Summarize the draft and approval requirements for sending.

## Prepare Refund

1. Confirm payment, amount, currency, reason, customer, and environment.
2. Verify `refunds_create` is enabled.
3. Prepare an approval request.
4. Do not create the refund until approval exists.

## Subscription Change Plan

1. Confirm subscription ID, customer, desired change, effective timing, proration expectations, and environment.
2. Read the current subscription and items.
3. Prepare a change plan.
4. Request approval before any update, pause, resume, migration, or cancellation.

## Payment Link Plan

1. Confirm product, price, currency, customer-facing copy, quantity behavior, and environment.
2. Verify product and price configuration.
3. Request approval before creating or updating the link.
