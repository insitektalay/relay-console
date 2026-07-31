# Marketplace Operating Packs Status

## Live Status

- Current milestone: Final marketplace reference-pack reconciliation.
- Current app: none.
- State: Complete. All 49 marketplace apps have canonical pack directories, catalog entries, curated/published metadata, provider-specific source doctrine, and passing OpenClaw/Hermes generation proof.
- Stop rule: Future packs must not be marked curated unless the canonical audit shows no repeated generic phrases, no missing provider-specific tokens, passing compiled-output secret scan, and OpenClaw/Hermes compile proof.

## Completed Apps

- Reference curated packs retained: `github`, `stripe`.
- Communication: `resend`, `gmail`, `outlook`, `slack`, `discord`, `twilio`.
- Work management: `linear`, `jira`, `asana`, `trello`, `clickup`.
- Knowledge/documents: `notion`, `google-drive`, `airtable`, `dropbox`, `confluence`, `coda`.
- Developer: `gitlab`, `supabase`, `vercel`, `railway`, `sentry`, `posthog`.
- Commerce/payments: `shopify`, `paddle`, `lemon-squeezy`, `chargebee`.
- CRM/support: `hubspot`, `salesforce`, `zendesk`, `intercom`, `pipedrive`.
- Content/creative: `figma`, `canva`, `webflow`, `wordpress`, `youtube-data-api`, `x`, `facebook-pages`, `instagram-graph-api`, `threads`, `linkedin`, `tiktok`, `pinterest`, `reddit`, `mastodon`, `bluesky`.
- Blocked or still review-needed: none.

## Reconciliation Results

- Catalog app count: 49.
- Canonical pack directory count: 49.
- Missing pack directories: none.
- Extra pack directories: none.
- Duplicate catalog slugs: none.
- Shared report reconciliation: `docs/marketplace/CANONICAL_PACKS_REPORT.md` is the canonical audit report path.
- Stale queue reconciliation: `docs/marketplace/PACK_BACKLOG.md` and this status file were updated from queued/in-progress language to the final complete state.

## Command Results

- `pnpm --dir backend build`: passed.
- `pnpm --dir web typecheck`: passed.
- `pnpm --dir backend marketplace:generate-all-packs`: passed.
  - Total apps: 49.
  - Curated count: 49.
  - Generated count: 0.
  - Missing source count: 0.
  - Failed generation count: 0.
  - Apps needing review: none.
- `pnpm --dir backend marketplace:audit-canonical-packs`: passed.
  - Total apps: 49.
  - Reference curated apps: `github`, `stripe`.
  - Non-reference apps marked `review_needed`: 0.
  - Non-reference apps blocked: 0.
  - False curated metadata: none.
  - Secret scan for compiled audit outputs: passed.
  - Durable report: `docs/marketplace/CANONICAL_PACKS_REPORT.md`.

## Output Proof

- Non-reference OpenClaw output: 24 files per app.
- Non-reference Hermes output: 14 files per app.
- GitHub regression proof: 27 OpenClaw files and 15 Hermes files.
- Stripe regression proof: 24 OpenClaw files and 14 Hermes files.

## Final Spot Checks

- Slack: provider-specific Slack Web API/Event API doctrine present; no generic template residue found.
- Gmail: provider-specific Gmail `users.messages`, `users.threads`, `users.drafts`, `users.watch`, `history.list`, and `gmail.send` doctrine present; no generic template residue found.
- Jira: provider-specific Atlassian/Jira issue, JQL, transition, worklog, and webhook doctrine present; no generic template residue found.
- GitLab: provider-specific project, repository, merge request, pipeline, token-scope, protected-resource, and webhook doctrine present; no generic template residue found.
- Shopify: provider-specific Admin GraphQL, product, variant, order, inventory, fulfillment, refund, and webhook doctrine present; no generic template residue found.
- HubSpot: provider-specific CRM object, contact, company, deal, ticket, association, private app, and webhook doctrine present; no generic template residue found.
- Figma: provider-specific file key, file/node, comment, image/render, component, OAuth/PAT, and webhook doctrine present; no generic template residue found.

## Known Issues

- No current validation failures.
- The whole marketplace pack tree is currently untracked in git, so final review should treat it as integrated generated/source work rather than relying on per-file git attribution.
