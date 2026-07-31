# ClawChat Marketplace Operating Packs Prompt

## Goal

Build the ClawChat Applications Marketplace into a system that converts external SaaS APIs into agent-operable applications.

The core object is:

Application + Connection + Permission Policy + Approval Gates + Agent Documentation Pack + Workflow Router + Runtime Compiler + Audit Trail.

GitHub is the first serious reference implementation and must remain working. New packs should match the GitHub quality bar: canonical marketplace source, runtime compiler, OpenClaw output, Hermes output, marketplace preview, connection-aware rendering, install lifecycle, runtime-specific docs/skills, and audit trail.

## Non-Goals

- Do not create shallow generic packs for every app.
- Do not hand-maintain separate OpenClaw and Hermes documentation.
- Do not invent provider API behavior.
- Do not weaken existing GitHub behavior.
- Do not move to the next app while the current app has failing build, typecheck, compiler, preview, or secret-scan validation.
- Do not include secrets, tokens, webhook secrets, private keys, OAuth client secrets, or encrypted secret payloads in rendered docs or generated runtime output.

## Constraints

- Each app pack must be provider-specific and grounded in official provider documentation.
- Each pack must define capabilities, approval profiles, endpoint families, workflow guidance, safe actions, API references, examples, and escalation behavior.
- Each pack must render connection display name, auth type, environment, selected capabilities, approval profile, and blocked actions.
- Each high-risk app must define at least `read_only`, `safe_operator`, `manager_approval`, and `admin_high_risk` approval profiles.
- Marketplace catalog metadata must use the curated pack where one exists, including real capabilities, real approval profiles, risk level, runtime support, official docs URL, and provider URL.
- Runtime outputs must be compiled from the canonical pack source.

## Quality Bar

The GitHub pack is the reference quality bar:

- `backend/src/modules/marketplace/packs/github/`
- `backend/src/modules/marketplace/packs/github/github.pack.ts`
- `compileGithubOpenClawPack`
- `compileGithubHermesPack`
- `backend/src/modules/marketplace/marketplace.service.ts`
- marketplace catalog types, contracts, and UI preview behavior where relevant

Every serious pack must support:

- Canonical source files under `backend/src/modules/marketplace/packs/<appSlug>/sources/`.
- OpenClaw output under the marketplace documentation pack path.
- Hermes output under `skills/<appSlug>-router/`.
- Provider-specific approval doctrine.
- Provider-specific capability doctrine.
- Provider-specific endpoint family manifest.
- Connection-aware rendering without secret leakage.
- Preview payload proof.
- Install lifecycle compatibility.
- No GitHub regression.

## App Backlog

Priority 1 reference packs:

1. Stripe
2. Slack
3. Notion
4. Linear
5. Resend
6. Google Workspace
7. HubSpot
8. Shopify
9. Supabase
10. Twilio

Communication:

- Gmail
- Outlook
- Discord

Work management:

- Jira
- Asana
- Trello
- ClickUp

Knowledge/docs:

- Google Drive
- Dropbox
- Confluence
- Coda

Developer:

- GitLab
- Vercel
- Railway
- Sentry
- PostHog

Commerce/payments:

- Paddle
- Lemon Squeezy
- Chargebee

CRM/support:

- Salesforce
- Zendesk
- Intercom
- Pipedrive

Content/creative:

- Figma
- Canva
- Webflow
- WordPress
- YouTube Data API

## Definition Of Done

For each completed app pack:

- Canonical pack files exist under `backend/src/modules/marketplace/packs/<appSlug>/`.
- Official docs used are recorded in `docs/marketplace/PACKS_STATUS.md`.
- Capabilities are provider-specific.
- Approval profiles are provider-specific and conservative for risk.
- OpenClaw compiler output works.
- Hermes compiler output works.
- Marketplace preview uses the curated pack instead of generic scaffold output.
- Catalog metadata reflects curated capabilities, approval profiles, runtime support, and risk.
- Secret scan passes for generated output.
- Backend build passes.
- Web typecheck passes if frontend or contract surface changed.
- GitHub compiler and preview still work.
- Status file records files changed, validation commands/results, known gaps, and next action.
