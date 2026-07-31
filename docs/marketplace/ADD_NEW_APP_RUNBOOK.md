# Marketplace Add New App Runbook

This runbook explains how to add a new app to the ClawChat Marketplace at the same quality standard as the current 39 reference-complete apps.

The Marketplace app model has two linked pieces:

- A catalogue entry that makes the app visible and defines marketplace metadata.
- A canonical operating pack that compiles into OpenClaw documentation output and Hermes skill-router output.

Do not add a new app by only updating the catalogue. A marketplace app is not complete until its canonical pack passes generation and canonical audit.

For local/custom app repos, start with [LOCAL_APP_REPO_PROMPT.md](LOCAL_APP_REPO_PROMPT.md). That prompt is the reusable instruction set for generating the `.clawchat/` documentation source folder before adding the repo through Applications -> Marketplace -> Add App -> Local repo app.

## 1. Add The App To The Catalogue

Add the app in:

```text
backend/src/modules/marketplace/catalog/marketplace-catalog.ts
```

Use the existing category grouping and `app(...)` entries as the source of truth for style and placement. Pick the closest category:

- `communication`
- `work_management`
- `knowledge_documents`
- `developer`
- `commerce_payments`
- `crm_support`
- `content_creative`

The catalogue entry must include:

- Stable `appSlug`.
- Human-readable app name.
- Category.
- Provider-specific description and agent-use summary.
- Supported connection types.
- Required secret names or credential requirements.
- Webhook/event notes where relevant.
- Default approval profile id.
- Risk level.
- Capabilities.
- Allowed actions.
- Approval-required actions.
- Blocked actions.
- Official provider docs URL.
- Provider website URL.
- Runtime support and pack quality metadata consistent with the canonical pack.

If the app uses custom capabilities, approval profiles, or runtime support, import them from the pack files just like the reference packs do.

## 2. Create The Canonical Pack Directory

Create the canonical pack under:

```text
backend/src/modules/marketplace/packs/<appSlug>/
```

The slug must match the catalogue slug exactly. For example:

```text
backend/src/modules/marketplace/packs/example-app/
```

The pack must compile through both:

- OpenClaw output.
- Hermes output.

Use GitHub and Stripe as reference-quality examples. Use recently completed packs such as Slack, Gmail, Jira, Shopify, HubSpot, and Figma as examples for the shared canonical compiler shape.

## 3. Required Files

Every new canonical pack must include these files:

```text
backend/src/modules/marketplace/packs/<appSlug>/<appSlug>.pack.ts
backend/src/modules/marketplace/packs/<appSlug>/capabilities.ts
backend/src/modules/marketplace/packs/<appSlug>/approval-profiles.ts
backend/src/modules/marketplace/packs/<appSlug>/endpoints.ts
backend/src/modules/marketplace/packs/<appSlug>/sources/workflow.md
backend/src/modules/marketplace/packs/<appSlug>/sources/auth.md
backend/src/modules/marketplace/packs/<appSlug>/sources/permissions.md
backend/src/modules/marketplace/packs/<appSlug>/sources/safe_actions.md
backend/src/modules/marketplace/packs/<appSlug>/sources/api/authentication.md
backend/src/modules/marketplace/packs/<appSlug>/sources/api/endpoints.md
backend/src/modules/marketplace/packs/<appSlug>/sources/api/errors.md
backend/src/modules/marketplace/packs/<appSlug>/sources/api/objects.md
backend/src/modules/marketplace/packs/<appSlug>/sources/api/overview.md
backend/src/modules/marketplace/packs/<appSlug>/sources/api/rate_limits.md
backend/src/modules/marketplace/packs/<appSlug>/sources/api/webhooks.md
backend/src/modules/marketplace/packs/<appSlug>/sources/workflows/common_tasks.md
backend/src/modules/marketplace/packs/<appSlug>/sources/workflows/escalate_to_user.md
backend/src/modules/marketplace/packs/<appSlug>/sources/workflows/read_actions.md
backend/src/modules/marketplace/packs/<appSlug>/sources/workflows/write_actions.md
backend/src/modules/marketplace/packs/<appSlug>/sources/examples/approval_required.md
backend/src/modules/marketplace/packs/<appSlug>/sources/examples/bad_requests.md
backend/src/modules/marketplace/packs/<appSlug>/sources/examples/good_requests.md
```

The pack entry file usually re-exports the shared canonical compiler:

```ts
export {
  compileCanonicalHermesPack as compileEXAMPLE_APPHermesPack,
  compileCanonicalOpenClawPack as compileEXAMPLE_APPOpenClawPack,
  CANONICAL_RUNTIME_SUPPORT as EXAMPLE_APP_RUNTIME_SUPPORT,
} from "../canonical-pack";
export { EXAMPLE_APP_CAPABILITIES } from "./capabilities";
export { EXAMPLE_APP_APPROVAL_PROFILES } from "./approval-profiles";
export { EXAMPLE_APP_ENDPOINT_FAMILIES } from "./endpoints";
```

If the app needs a bespoke compiler, follow GitHub or Stripe. Do not invent a second pack system.

## 4. Quality Bar

A reference-quality pack must be provider-specific. It must include:

- Provider-specific authentication model: OAuth, API key, bot token, app token, application password, service account, or other official model.
- Provider-specific permissions, OAuth scopes, resource permissions, roles, app scopes, or capability boundaries.
- Provider-specific object model: the actual resources users operate.
- Provider-specific endpoint and method families using official API names, paths, GraphQL objects, SDK methods, or event names.
- Rate limits, quotas, throttling rules, or documented uncertainty if the provider does not publish a single limit.
- Webhooks, event subscriptions, Gateway/event streams, callbacks, or a clear statement that the official API has no built-in webhook model.
- Error and failure modes from official docs: auth failures, permission errors, validation errors, quota errors, conflict states, idempotency concerns.
- Realistic read workflows.
- Realistic write workflows.
- Realistic approval-required workflows.
- Realistic good request examples.
- Realistic bad request examples.
- Realistic approval-required examples.
- Conservative allowed, approval-required, and blocked actions.
- Secret-safety protection: never expose API keys, access tokens, refresh tokens, bot tokens, private keys, webhook signing secrets, application passwords, or secret-bearing URLs.
- OpenClaw output proof.
- Hermes output proof.

The approval model should be conservative by default:

- Allowed: reads, summaries, audits, status inspection, and drafts when permission exists.
- Approval required: public posts, external publishing, production changes, customer-facing sends, uploads/replacements, deletes, moderation, money movement, permission changes, webhooks, domains, role/admin changes, or sensitive exports.
- Blocked: exposing secrets, bypassing provider permissions, spam/mass messaging, destructive bulk deletion, disabling security/moderation controls, changing ownership/admin roles, or publishing externally without explicit approval.

## 5. Official Documentation URLs

Every pack must record official provider documentation URLs in its source files.

Prefer official docs from:

- The provider developer/docs domain.
- Official API reference.
- Official auth/scopes page.
- Official webhook/events page.
- Official rate-limit/quota page.
- Official errors/status-code page.

If official docs are inaccessible or incomplete, document the exact blocker in the relevant source file and still keep the pack provider-specific.

## 6. Anti-Patterns

Do not ship these:

- Generic template text.
- App-name substitution into generic docs.
- Phrases such as:
  - `Use <App> for <objects> operations backed by official provider APIs.`
  - `Read operations: list, retrieve, search, inspect status where supported.`
  - `Write operations: create, update, move, send, publish, or delete only when the active policy allows it.`
  - `Perform an external/customer-facing action.`
  - `Modify permissions, webhooks, production state, billing, publishing, or destructive resources.`
- Vague object names such as `records`, `items`, or `resources` when the provider has named objects.
- Vague endpoint names such as `CRUD endpoints` or `webhook endpoints` without actual method/path/family names.
- Marking an app curated before generation and audit pass.
- Missing official docs URLs.
- Examples that are not realistic for the provider.
- Approval profiles that allow public, destructive, financial, permission, or admin changes without approval.
- Docs that ask users to paste secrets into chat.
- Local-backend guidance for the ClawChat web app. Backend configuration stays Railway-only for web API and websocket traffic.

## 7. Validation Commands

Run these from the repo root:

```bash
pnpm --dir backend build
pnpm --dir web typecheck
pnpm --dir backend marketplace:generate-all-packs
pnpm --dir backend marketplace:audit-canonical-packs
```

Do not skip validation. Do not mark the app complete if any command fails.

## 8. Expected Passing Result

The final result must show:

- Backend build passes.
- Web typecheck passes.
- `marketplace:generate-all-packs` reports no failed generation.
- `marketplace:generate-all-packs` reports no missing source sections for the new app.
- `marketplace:audit-canonical-packs` reports no false curated metadata.
- `marketplace:audit-canonical-packs` reports no `review_needed` or `blocked` state for the new app.
- OpenClaw output is generated for the new app.
- Hermes output is generated for the new app.
- Secret scan passes.
- Official docs URLs are recorded.
- Provider-specific audit tokens are present.
- Generic template phrase hits are zero.

For the current canonical compiler, non-reference apps typically generate:

- 24 OpenClaw files.
- 14 Hermes files.

GitHub and Stripe have custom reference compilers and may produce different counts. Use the audit report as the final proof source.

## 9. Final Status Updates

After validation, update final status/report files only when they need to reflect the new app:

```text
docs/marketplace/CANONICAL_PACKS_REPORT.md
docs/marketplace/PACKS_STATUS.md
docs/marketplace/PACK_BACKLOG.md
```

Avoid overwriting unrelated report changes from other coders. If multiple people are working in parallel, regenerate the canonical report from the final repo state and reconcile shared docs carefully.

## 10. Copy-Paste Prompt For Future Codex/Coder Use

```text
Add <APP_NAME> to the Marketplace as a reference-quality canonical operating pack.

Work in the real current ClawChat repo.

Do not build a new marketplace system.
Do not rewrite the Pack Factory.
Do not use browser automation.
Do not touch unrelated app packs unless needed for catalogue integration or validation.
Respect the ClawChat web backend rule: web API and websocket traffic stays Railway-only; do not add localhost backend guidance.

Tasks:

1. Inspect GitHub and Stripe packs as reference-quality examples.
2. Inspect several completed canonical packs in the same category as <APP_NAME>.
3. Add <APP_NAME> to `backend/src/modules/marketplace/catalog/marketplace-catalog.ts` with the correct category, metadata, capabilities, approval profile, risk level, docs URL, website URL, runtime support, and curated pack-quality metadata only after the pack passes validation.
4. Create `backend/src/modules/marketplace/packs/<appSlug>/`.
5. Add required files:
   - `<appSlug>.pack.ts`
   - `capabilities.ts`
   - `approval-profiles.ts`
   - `endpoints.ts`
   - `sources/workflow.md`
   - `sources/auth.md`
   - `sources/permissions.md`
   - `sources/safe_actions.md`
   - `sources/api/authentication.md`
   - `sources/api/endpoints.md`
   - `sources/api/errors.md`
   - `sources/api/objects.md`
   - `sources/api/overview.md`
   - `sources/api/rate_limits.md`
   - `sources/api/webhooks.md`
   - `sources/workflows/common_tasks.md`
   - `sources/workflows/escalate_to_user.md`
   - `sources/workflows/read_actions.md`
   - `sources/workflows/write_actions.md`
   - `sources/examples/approval_required.md`
   - `sources/examples/bad_requests.md`
   - `sources/examples/good_requests.md`
6. Use official provider documentation only where possible and record the docs URLs in source files.
7. Include provider-specific auth, scopes/permissions, object model, endpoints/method families, rate limits/quotas, webhooks/events, errors/failure modes, realistic workflows, good/bad/approval-required examples, approval-required actions, blocked actions, and secret-safety rules.
8. Remove generic template residue. Do not ship app-name-substituted generic docs.
9. Run:
   - `pnpm --dir backend build`
   - `pnpm --dir web typecheck`
   - `pnpm --dir backend marketplace:generate-all-packs`
   - `pnpm --dir backend marketplace:audit-canonical-packs`
10. Confirm:
   - no failed generation
   - no false curated metadata
   - no review_needed or blocked state for <APP_NAME>
   - OpenClaw output generated
   - Hermes output generated
   - secret scan passed
   - official docs URLs recorded
11. Update final marketplace status/report docs only as needed and list every shared file touched.

Final report should include:

- app slug and category
- official docs URLs used
- provider-specific doctrine added
- approval model summary
- OpenClaw/Hermes file counts
- validation command results
- shared files touched
- weak spots, if any
```
