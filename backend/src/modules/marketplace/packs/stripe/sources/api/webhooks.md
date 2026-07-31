# Stripe Webhooks

Official sources:

- https://docs.stripe.com/webhooks
- https://docs.stripe.com/api/webhook_endpoints

Stripe sends event data to webhook endpoints when activity occurs in an account or connected accounts. Webhooks are important for asynchronous payment, invoice, subscription, checkout, and dispute events.

## Agent Rules

- Use webhooks for reasoning about asynchronous state, not as a reason to skip reading the latest object state.
- Verify the relevant object after webhook events before taking action.
- Treat webhook signing secrets as secrets and never render them.
- Creating, updating, disabling, or deleting webhook endpoints requires approval.
- Do not change event subscriptions unless the user has approved the exact endpoint, event types, environment, and reason.

## Common Events To Understand

- `invoice.created`
- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.sent`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.dispute.created`

## Delivery Doctrine

If webhook delivery appears unhealthy, report endpoint ID, environment, event types, failure status, and next safe diagnostic step. Do not disable or replace endpoints without approval.
