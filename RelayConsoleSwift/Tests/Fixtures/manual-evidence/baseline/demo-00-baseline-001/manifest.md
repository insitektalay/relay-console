# Manual Evidence Manifest - Demo 0 Baseline

id: `manual-evidence.demo-00-baseline-001`

layer: `manual-evidence`

productArea: `baseline`

requirementIds: `RCSPR-0084`, `RCSPR-0091`, `RCSPR-0105`, `RCSPR-0140`

sourceMapIds: `SM-0136`, `SM-0137`, `SM-0153`

featureIds: `FI-0099`, `FI-0103`, `FI-0131`

gapOrDecisionIds: `SBD-0001`

fixtureKind: `manual-note`

owner: `QA evidence`

evidenceType: `demo-note`

status: `verified`

disposition: `pass`

secretsPolicy: `redacted`

artifactClass: `manual-evidence`

branch: `codex/itc-0001-baseline-preflight`

commit: `69b6e30`

appVersion: `0.1.0`

capturedAt: `2026-06-22T18:55:35Z`

reviewer: `Codex`

localDataRootDescription: `temporary-directory/RelayConsoleSwiftTests/<uuid>`

redactionStatus: `redacted`

redactionReview: `CODE-001-002 evidence packet redaction scan`

observedActiveSurfaces: `Chats`, `Agents`, `Settings`

observedUnavailableSurfaces: `AgentOps HQ`, `Applications`, `Insights`,
`Approvals`

files:

- `manual-evidence/baseline/demo-00-baseline-001/manifest.md`

expectedChecks:

- `VC-0001`
- `VC-0002`
- `VC-0003`
- `VC-0006`
- `VC-0108`
- `loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-002-itc-0001-baseline-preflight-evidence.md`
- `loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-011-itc-0010-source-hygiene.md`

implementationTaskIds: `ITC-0001`, `ITC-0003`, `ITC-0010`

validationCommandIds: `VC-0001`, `VC-0002`, `VC-0003`, `VC-0006`, `VC-0108`

demoIds: `Demo 0`

branchPacket:
`evidence/branches/codex-itc-0001-baseline-preflight/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-002-itc-0001-baseline-preflight-evidence.md`
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-011-itc-0010-source-hygiene.md`

determinism: `Stable branch, commit, UTC capture timestamp, redacted temporary data root class, and deterministic smoke checks.`

noFakeProductSeed: `This manual evidence packet does not seed product-visible sample data.`

noSimulatedRuntimeOutput: `This packet records baseline smoke evidence only and includes no simulated runtime output.`

noGeneratedWelcome: `The linked smoke check verifies no generated welcome messages are created.`

privateStateExclusions: `Machine-specific paths, personal account values, and raw credentials are excluded from this manifest.`

failureHandling: `If any linked baseline command fails or redaction finds disallowed values, the manifest cannot remain verified.`

## Evidence Links

- Branch packet: `evidence/branches/codex-itc-0001-baseline-preflight/evidence-packet.md`
- Build command: `evidence/branches/codex-itc-0001-baseline-preflight/commands/swift-build.md`
- Smoke command: `evidence/branches/codex-itc-0001-baseline-preflight/commands/smoke-preflight.md`
- Diff hygiene command: `evidence/branches/codex-itc-0001-baseline-preflight/commands/git-diff-check.md`
- Web transport invariant: `evidence/branches/codex-itc-0001-baseline-preflight/commands/web-transport-invariant.md`
- Demo note: `evidence/branches/codex-itc-0001-baseline-preflight/demos/demo-00-baseline-preflight.md`

## No-Fake Notes

Smoke output proves a clean temporary data root creates one local profile, one
local workspace, only Hermes Agent and OpenClaw harness records, distinct
explicit agents, idempotent automatic harness activation, redacted token-like
values, and no generated welcome messages.

## Redaction Notes

The raw SwiftPM output included a local `.build` absolute path while waiting
for another SwiftPM process. Durable evidence keeps only a redacted summary.
The clean data root is recorded by class, not by machine-specific path.

## Traceability

`ITC-0001`; `ITC-0010`; Demo 0; `VC-0001`; `VC-0002`; `VC-0003`; `VC-0006`;
`VC-0108`;
`RCSPR-0084`; `RCSPR-0091`; `RCSPR-0105`; `RCSPR-0140`; `FI-0099`;
`FI-0103`; `FI-0131`; `SM-0136`; `SM-0137`; `SM-0153`; `SBD-0001`.
