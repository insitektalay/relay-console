# Marketplace Pack Generation Runbook

## Batch Coverage Report

```sh
pnpm --dir backend marketplace:report-pack-coverage
```

This reports total apps, curated count, generated count, missing source count, failed generation count, and apps needing review.

## Generate All Draft Packs

```sh
pnpm --dir backend marketplace:generate-all-packs
```

This compiles generated OpenClaw and Hermes previews for every non-curated catalogue app and prints the coverage report. It does not overwrite curated GitHub or Stripe source packs.

## Generate One Draft Pack

```sh
pnpm --dir backend marketplace:generate-pack slack hermes
pnpm --dir backend marketplace:generate-pack slack openclaw
```

Use this for preview proofing one generated pack.

## Score One Pack

```sh
pnpm --dir backend marketplace:score-pack slack
```

Use this to inspect quality score, missing sections, warnings, docs coverage, and review status.

## Validation

Run after factory changes:

```sh
pnpm --dir backend build
pnpm --dir web typecheck
pnpm --dir backend marketplace:generate-all-packs
```

Also run direct curated regression proofs for GitHub and Stripe OpenClaw/Hermes compilers.

## Review Promotion

Generated draft packs can be promoted to `generated_reviewed` only after review confirms:

- Official docs coverage is sufficient.
- Auth, permissions/scopes, rate limits, webhooks, errors, endpoint families, and high-risk actions are accurate.
- Approval gates are conservative.
- Generated docs do not expose credentials.
- Runtime output compiles for OpenClaw and Hermes.

Promotion to `curated` requires hand-authored source doctrine and provider-specific compiler quality comparable to GitHub and Stripe.
