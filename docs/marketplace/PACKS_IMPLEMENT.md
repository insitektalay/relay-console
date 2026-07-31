# Marketplace Operating Packs Implementation Runbook

## Working Loop

1. Read `docs/marketplace/PACKS_STATUS.md`.
2. Confirm the current app and next action.
3. Inspect the GitHub reference pack before implementing a new pack.
4. Collect official provider docs for the current app.
5. Create or update only the current app pack.
6. Compile OpenClaw and Hermes previews.
7. Run validation.
8. Update `docs/marketplace/PACKS_STATUS.md`.
9. Stop if validation fails; fix before continuing.

## Inspect GitHub Reference Pack

Use:

```sh
rg --files backend/src/modules/marketplace/packs/github
sed -n '1,460p' backend/src/modules/marketplace/packs/github/github.pack.ts
sed -n '1,220p' backend/src/modules/marketplace/packs/github/capabilities.ts
sed -n '1,260p' backend/src/modules/marketplace/packs/github/approval-profiles.ts
sed -n '1,220p' backend/src/modules/marketplace/packs/github/endpoints.ts
sed -n '820,990p' backend/src/modules/marketplace/marketplace.service.ts
sed -n '1,220p' backend/src/modules/marketplace/catalog/marketplace-catalog.ts
```

Reference patterns:

- Pack compiler owns runtime source maps.
- Compiler renders canonical source tokens into runtime files.
- Compiler sanitizes connection context.
- Catalog imports curated capabilities, approval profiles, and runtime support.
- Marketplace service routes curated apps away from generic scaffold output.

## Create A New Pack

Suggested structure:

```text
backend/src/modules/marketplace/packs/<appSlug>/
├── <appSlug>.pack.ts
├── capabilities.ts
├── approval-profiles.ts
├── endpoints.ts
└── sources/
    ├── workflow.md
    ├── auth.md
    ├── permissions.md
    ├── safe_actions.md
    ├── api/
    │   ├── overview.md
    │   ├── authentication.md
    │   ├── objects.md
    │   ├── endpoints.md
    │   ├── webhooks.md
    │   ├── errors.md
    │   └── rate_limits.md
    ├── workflows/
    │   ├── common_tasks.md
    │   ├── read_actions.md
    │   ├── write_actions.md
    │   └── escalate_to_user.md
    └── examples/
        ├── good_requests.md
        ├── bad_requests.md
        └── approval_required.md
```

Adapt this structure only when the provider needs more specific files.

## Official Docs Collection

For each provider, collect official docs for:

- Authentication.
- Permissions/scopes.
- Rate limits.
- Core API objects.
- Read operations.
- Write operations.
- Webhooks/events.
- Error handling.
- Destructive or high-risk operations.

Record source URLs in `docs/marketplace/PACKS_STATUS.md`.

## Canonical Doctrine Checklist

Each pack must answer:

- When should an agent use this app?
- When should it not use this app?
- What credentials are needed?
- What capabilities are available?
- What should be read-only?
- What can be drafted safely?
- What requires approval?
- What is blocked?
- What must be audited?
- What should the agent do when the user request is ambiguous?
- What should the agent do when credentials or capabilities are insufficient?

## Compile OpenClaw Output

Curated compilers should emit:

- `${AGENT_DOCS_PACK_PATH}/pack_manifest.json`
- `${AGENT_DOCS_PACK_PATH}/library/**`
- `${AGENT_DOCS_PACK_PATH}/library/tools/tool_schema.json`
- `${AGENT_DOCS_PACK_PATH}/workspace_files/manager/AGENTS.md`
- `${AGENT_DOCS_PACK_PATH}/workspace_files/manager/WORKFLOW.md`
- `${AGENT_DOCS_PACK_PATH}/workspace_files/worker/AGENTS.md`
- `${AGENT_DOCS_PACK_PATH}/workspace_files/worker/WORKFLOW.md`

## Compile Hermes Output

Curated compilers should emit:

- `skills/<appSlug>-router/SKILL.md`
- `skills/<appSlug>-router/references/INDEX.md`
- `skills/<appSlug>-router/references/*.md`

## Validation Commands

Use the relevant commands for the app:

```sh
pnpm --dir backend build
pnpm --dir web typecheck
```

Use a small compiler proof command with `ts-node` or equivalent to call the curated compilers directly. Verify:

- File tree includes expected OpenClaw files.
- File tree includes expected Hermes files.
- Rendered files include connection display name, auth type, environment, selected capabilities, approval profile, and blocked actions.
- Rendered files do not include secret-looking values.
- GitHub compiler still returns OpenClaw and Hermes files.

## Status Updates

After each app, update `docs/marketplace/PACKS_STATUS.md` with:

- App completed.
- Files added or changed.
- Official docs used.
- Capabilities added.
- Approval profiles added.
- OpenClaw output generated.
- Hermes output generated.
- Validation commands/results.
- Known gaps.
- Next app.
