# Fixture Manifest Schema

Every fixture packet under `Tests/Fixtures/` must include a `manifest.md` or
`manifest.json` with the fields below. Markdown manifests may use scalar
fields and short lists; JSON manifests should use the same field names.

## Required Catalog Fields

| Field | Required | Allowed or expected value |
| --- | --- | --- |
| `id` | yes | Stable fixture id, for example `fix-services-baseline-no-fake-bootstrap-001`. |
| `layer` | yes | `migration`, `contract`, `service`, `event-replay`, `visual`, `accessibility`, `manual-evidence`, or `real-harness`. |
| `productArea` | yes | Product area from `traceability-index.md`. |
| `requirementIds` | yes | One or more `RCSPR` ids. |
| `sourceMapIds` | yes | One or more `SM` ids. |
| `featureIds` | recommended | One or more `FI` ids when available. |
| `gapOrDecisionIds` | recommended | Any active `G`, `D`, or `SBD` ids constraining the packet. |
| `fixtureKind` | yes | `input`, `expected-output`, `snapshot`, `script`, `manual-note`, or `evidence`. |
| `owner` | yes | `persistence`, `contracts`, `services`, `runtime`, `UI`, `accessibility`, or `QA evidence`. |
| `status` | yes | `planned`, `created`, `implemented`, `verified`, `stale`, or `retired`. |
| `secretsPolicy` | yes | `no-secrets`, `redacted`, or `secret-reference-only`. |
| `files` | yes | Paths relative to `Tests/Fixtures/`. |
| `expectedChecks` | yes | Test target, script, validation command, or manual review that consumes the packet. |

## Branch And Review Fields

Include these fields when a packet is created or verified by branch evidence:

| Field | Required when applicable | Notes |
| --- | --- | --- |
| `branch` | yes | Branch that created or last verified the packet. |
| `commit` | yes | Short commit id used for the evidence packet. |
| `appVersion` | yes | App or package version when available. |
| `capturedAt` | yes | Stable timestamp in UTC. |
| `reviewedAt` | recommended | Stable timestamp in UTC. |
| `reviewer` | yes | Human or agent reviewer. |
| `reviewerRole` | recommended | Owner role for the review. |
| `sourceBaseline` | recommended | Source files or PRD artifacts used for the packet. |

## Traceability Fields

Include all fields that apply:

| Field | Purpose |
| --- | --- |
| `implementationTaskIds` | `ITC` ids that own the packet. |
| `validationCommandIds` | `VC` ids consumed by the packet. |
| `demoIds` | Demo or manual evidence ids. |
| `branchPacket` | Branch packet path that verifies the packet. |
| `releasePacket` | Release packet path when aggregated for release. |
| `reportIds` | Coding-loop report ids or paths. |

## Safety And Determinism Fields

Every manifest must make these controls explicit:

| Field | Required | Notes |
| --- | --- | --- |
| `determinism` | yes | Stable ids, timestamps, timezone, ordering, seed behavior, and rerun notes. |
| `noFakeProductSeed` | yes | State that the packet does not seed product-visible sample data. |
| `noSimulatedRuntimeOutput` | yes | State that runtime output is absent or real evidence only. |
| `noGeneratedWelcome` | yes | State that no generated welcome text is included. |
| `privateStateExclusions` | yes | Machine-specific paths, personal data, and account values are excluded. |
| `redactionReview` | yes | Reviewer or command that checked redaction. |
| `failureHandling` | yes | What blocks closeout if a consuming check fails. |

## Layer Separation Fields

Use `artifactClass` to keep evidence types distinct:

| `artifactClass` value | Use for |
| --- | --- |
| `deterministic-fixture` | Inputs or expected outputs consumed by automated tests. |
| `command-output` | Redacted command summaries or logs. |
| `manual-evidence` | Human-reviewed notes and demo records. |
| `real-harness-evidence` | Environment-dependent Hermes or OpenClaw observations. |
| `visual-review` | Screenshot or layout review packets. |
| `accessibility-review` | Keyboard, focus, and VoiceOver review packets. |
| `unavailable-evidence` | Decision-gated or out-of-scope unavailable states. |
| `branch-packet` | Branch-level aggregation evidence. |
| `release-packet` | Release-level aggregation evidence. |

Do not use one artifact class as proof for another. For example, a manual
review note can verify that a fixture schema exists, but it cannot replace a
future migration or service test.

## Unavailable Or Decision-Gated Fields

When a packet covers unavailable or decision-sensitive behavior, include:

| Field | Required | Notes |
| --- | --- | --- |
| `surface` | yes | Screen, service, or workflow name. |
| `stateKind` | yes | `unavailable`, `out-of-scope`, `decision-gated`, or `blocked`. |
| `reasonCode` | yes | Short reason from the decision or gap record. |
| `decisionIds` | yes | Related `D`, `G`, or `SBD` ids. |
| `missingPrerequisites` | yes | Required decision, source, or implementation work. |
| `currentState` | yes | Current UI or service state. |
| `notParityStatement` | yes | Explicit statement that unavailable state is not feature parity. |
| `activationRequirement` | yes | What must happen before the behavior can become active. |
| `releaseImpact` | yes | Whether the unavailable state blocks release or remains residual. |

## Review Checklist

- Required catalog fields are present.
- Traceability links include at least one `RCSPR` id and one `SM` id.
- Owner and expected consuming check are explicit.
- No fake product records, generated welcomes, fake harnesses, or simulated
  runtime output are present.
- Secrets, private paths, and personal account values are absent or redacted.
- Deterministic fields describe ids, timestamps, timezone, ordering, and rerun
  behavior.
- Artifact class matches the packet location and claim.
- Empty roots and example manifests are labeled non-proof until consumed by a
  passing command or reviewed packet section.
