# Marketplace Operating Packs Plan

## Milestone 0: Durable Project Track

Deliver:

- Create `docs/marketplace/PACKS_PROMPT.md`.
- Create `docs/marketplace/PACKS_PLAN.md`.
- Create `docs/marketplace/PACKS_IMPLEMENT.md`.
- Create `docs/marketplace/PACKS_STATUS.md`.

Validation:

- Files exist at repo root.
- Plan states the stop-and-fix rule.
- Status has a live current action.

## Milestone 1: Stripe Reference Pack

Reason: GitHub proves developer-tool operations. Stripe proves high-risk business operations: money movement, invoices, subscriptions, refunds, customers, payment links, strict approvals, and audit.

Deliver:

- Inspect GitHub reference implementation.
- Create `backend/src/modules/marketplace/packs/stripe/`.
- Add Stripe capabilities.
- Add Stripe approval profiles: `stripe_read_only`, `stripe_safe_operator`, `stripe_manager_approval`, `stripe_admin_high_risk`.
- Add Stripe endpoint families.
- Add Stripe canonical source markdown for workflow, auth, permissions, safe actions, API, workflows, and examples.
- Add `compileStripeOpenClawPack`.
- Add `compileStripeHermesPack`.
- Wire Stripe compiler into marketplace preview and install paths.
- Update catalog metadata so Stripe uses the curated pack, runtime support, capabilities, approval profiles, and credential requirements.

Validation:

- Backend build passes.
- Web typecheck passes if frontend/contracts changed.
- Stripe OpenClaw preview compiles and includes connection context, capabilities, approval profile, API docs, workflows, examples, and tool schema.
- Stripe Hermes preview compiles and includes `skills/stripe-router/SKILL.md` plus references.
- Generated output contains no API keys, tokens, webhook secrets, private keys, OAuth secrets, or encrypted payloads.
- GitHub OpenClaw compiler still compiles.
- GitHub Hermes compiler still compiles.

Stop:

- Stop and report after Stripe. Do not continue to Slack until Stripe passes validation.

## Milestone 2: Slack

Deliver:

- Official Slack docs review for OAuth, bot tokens, scopes, Web API, Events API, rate limits, message posting, conversations, files, and admin limitations.
- Curated Slack pack and both runtime outputs.

Validation:

- Same validation suite as Stripe.
- Additional checks for message-send approvals, external invite approvals, and channel membership ambiguity handling.

## Milestone 3: Notion

Deliver:

- Official Notion docs review for internal integrations, OAuth, capabilities, databases, pages, blocks, comments, search, rate limits, and webhooks.
- Curated Notion pack and both runtime outputs.

Validation:

- Same validation suite.
- Additional checks for external sharing, destructive page/database changes, and ambiguous workspace/database selection.

## Milestone 4: Linear

Deliver:

- Official Linear docs review for GraphQL API, OAuth/API keys, webhooks, issues, teams, projects, comments, labels, and rate limits.
- Curated Linear pack and both runtime outputs.

Validation:

- Same validation suite.
- Additional checks for bulk status changes, assignments, and project state changes.

## Milestone 5: Continue Priority 1

Sequence:

1. Resend
2. Google Workspace
3. HubSpot
4. Shopify
5. Supabase
6. Twilio

Validation:

- Same pack validation suite per app.
- App-specific approval checks based on provider risk.

## Stop-And-Fix Rule

If build, typecheck, pack generation, preview, secret scan, or GitHub regression checks fail, fix the failure before moving to the next app. Do not accumulate broken packs.
