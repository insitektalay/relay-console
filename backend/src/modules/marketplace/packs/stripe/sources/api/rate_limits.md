# Stripe Rate Limits

Official source: https://docs.stripe.com/rate-limits

Stripe enforces rate and concurrency limiters. Rate-limited requests can return HTTP `429` and may include the `Stripe-Rate-Limited-Reason` header.

## Operational Limits

- Live mode global rate limit is documented as higher than sandbox.
- Sandbox has lower throughput and should not be used as a load-test proxy for live mode.
- Some endpoints and resources have stricter limits.
- Search, subscriptions, files, payment intents, payouts, Connect, Issuing, and meter events can have specific limits.

## Agent Rules

- Avoid broad pagination unless the user needs it.
- Use filters and exact object IDs whenever possible.
- Back off on `429`.
- Do not run concurrent writes against the same customer, invoice, subscription, product, price, or payment object.
- Do not retry live money movement without checking whether the first request created or changed an object.
- Report repeated rate limits to the user with the endpoint family and safe next step.
