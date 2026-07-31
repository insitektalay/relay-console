# Marketplace Pack Quality Standard

## Curated

Curated packs are hand-authored and provider-specific. They must have canonical source files, provider-specific capabilities, approval profiles, endpoint families, OpenClaw compiler output, Hermes compiler output, connection-aware rendering, secret-safe rendering, and regression tests/proofs.

## Generated Reviewed

Generated reviewed packs are factory-generated and reviewed. They must cite source URLs, document confidence, cover auth/permissions/rate limits/webhooks where available, define conservative approval gates, and compile to OpenClaw and Hermes.

## Generated Draft

Generated draft packs are first-pass packs. They must be clearly labelled `generated_draft` and `review_needed`. They are useful for previewing app operation, but they are not recommended for high-risk use until reviewed.

## Minimum Generated Pack Sections

- `workflow.md`
- `auth.md`
- `permissions.md`
- `safe_actions.md`
- `api/overview.md`
- `api/endpoints.md`
- `api/errors.md`
- `api/rate_limits.md`
- `api/webhooks.md`
- `workflows/common_tasks.md`
- `workflows/read_actions.md`
- `workflows/write_actions.md`
- `workflows/escalate_to_user.md`
- `examples/good_requests.md`
- `examples/bad_requests.md`
- `examples/approval_required.md`
- `library/tools/tool_schema.json`
- Hermes `SKILL.md`
- Hermes `references/INDEX.md`

## Blocking Failures

- Generated output includes secret values.
- High-risk action is allowed without approval.
- Pack claims to be curated when it is generated.
- GitHub or Stripe curated compiler regresses.
- Backend build fails.
- Web typecheck fails.
