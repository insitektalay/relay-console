# Relay Console Marketplace catalog

This package is the version-controlled source for provider manifests shared by
Railway, Relay Console Swift, iPhone, and web. Manifests contain product and
integration data only; platform renderers remain in their platform codebases.

Each provider lives at `providers/<slug>/manifest.json` and conforms to
`schema/provider-manifest.schema.json`. Run:

```bash
pnpm --dir packages/marketplace-catalog validate
```

Railway is authoritative for cloud catalog state. Relay Console Swift bundles a
validated snapshot for local-only workspaces and may refresh it when linked to a
Railway workspace.

`release/marketplace-release-manifest.json` is the single release-decision
source. It is separate from provider research manifests: catalog entries may be
present while Connect remains disabled. Run `pnpm marketplace:release-manifest:sync`
after an owner-reviewed edit, then commit the exact Railway and macOS snapshots.
The provider list is the selected launch cohort. Documentation-reviewed,
customer-credential providers may expose Connect with `connectEligible: true`
while retaining `liveVerified: false`. Relay verification remains a separate
claim that requires live acceptance evidence. Unlisted providers fail closed.

Each `liveVerified` provider must reference a secret-free staging record under
`release/acceptance/`. Run `pnpm marketplace:provider-acceptance` before the
freeze. The validator checks the record digest, provider identity, evidence
freshness, privacy flags, and staging deployment binding. Read
`release/acceptance/README.md` for the operator procedure.
