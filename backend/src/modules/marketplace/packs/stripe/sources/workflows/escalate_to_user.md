# Stripe Escalate To User

Escalate when:

- Credentials are missing, invalid, expired, or under-scoped.
- The selected capability does not cover the requested action.
- The request is ambiguous.
- The operation requires approval and approval is not present.
- The operation is blocked.
- Official Stripe docs or provider response contradict the pack.
- A write partially succeeds or the result is uncertain.
- A retry might duplicate money movement or billing state changes.

## Escalation Format

Include:

- What the user asked for.
- Current environment.
- Missing detail or approval.
- Safe facts already verified.
- Exact action that would be taken after approval or clarification.
- Risk and reversibility.

Exclude:

- API keys.
- Restricted keys.
- Webhook signing secrets.
- OAuth secrets.
- Raw card data.
- Client secrets.
- Encrypted secret payloads.
