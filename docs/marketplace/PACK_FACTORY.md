# Marketplace Pack Factory

## Purpose

The Marketplace Pack Factory creates useful first-pass canonical operating packs for SaaS apps at scale. Curated packs remain supported for high-value, high-risk, or common apps.

## Quality Levels

- `curated`: hand-authored reference-quality pack. GitHub and Stripe are curated.
- `generated_reviewed`: generated from provider metadata/docs and reviewed before publication.
- `generated_draft`: generated first-pass pack, previewable and installable, but marked `review_needed`.

## Factory Inputs

- Official API docs URL.
- OpenAPI spec URL or file.
- Postman collection.
- MCP server manifest or tool schema.
- Provider website URL.
- Auth docs URL.
- Webhook docs URL.
- Manual notes.
- Existing curated source pack.

## Generated Outputs

For each generated app, the factory creates:

- Canonical metadata.
- Capabilities.
- Conservative approval profiles.
- Auth guidance.
- Permission guidance.
- Safe actions.
- Blocked actions.
- API/object summaries.
- Endpoint families.
- Common workflows.
- Good, bad, and approval-required examples.
- OpenClaw output.
- Hermes output.
- Tool schema draft.
- Quality report.

## Honesty Requirements

Generated packs must include:

- Source URLs used.
- Generation timestamp.
- Confidence level.
- Missing sections.
- Risk warnings.
- Review status.
- Official docs coverage.
- Whether auth, permissions, rate limits, and webhooks were found.
- Whether high-risk actions were detected.

## High-Risk Defaults

High-risk generated packs allow reads, drafts, preparation, and internal summaries. They require approval for external sending, money movement, publishing, deletion, production changes, permission changes, customer-facing actions, and bulk operations.

Generated packs block secrets exposure, disabling security, deleting accounts/workspaces/repos, exporting sensitive data, granting broader permissions, and irreversible destructive actions.

## Curated Protection

The factory must not overwrite curated GitHub or Stripe pack compilers or source trees. Curated pack regression proofs must remain part of every factory milestone.
