# Migration Fixture Manifest - Runtime Action Runs

id: `fix-migration-runtime-action-runs-001`

layer: `migration`

productArea: `runtime`

requirementIds: `RCSPR-0006`, `RCSPR-0044`, `RCSPR-0045`, `RCSPR-0095`, `RCSPR-0109`, `RCSPR-0124`, `RCSPR-0133`, `RCSPR-0176`

sourceMapIds: `SM-0071`, `SM-0072`, `SM-0075`, `SM-0076`, `SM-0078`, `SM-0145`, `SM-0148`, `SM-0151`, `SM-0159`

featureIds: `FI-0051`, `FI-0052`, `FI-0117`, `FI-0126`, `FI-0166`, `FI-0167`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

fixtureKind: `runtime-action-run-migration`

owner: `runtime-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `migration-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `migration evidence`

sourceBaseline: `Migrations.swift`, `MigrationTests.swift`, `RuntimeActionService.swift`

files:

- `migrations/runtime-replay/v015-runtime-action-runs-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../../Sources/RelayConsoleCore/Migrations.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0030`

validationCommandIds: `VC-0100`

demoIds: `Demo 4`, `Demo 5`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-031-itc-0030-runtime-action-runs.md`

surface: `Runtime action capability and action-run schema`

stateKind: `verified-migration`

reasonCode: `runtime-action-run-schema`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

missingPrerequisites: `Controlled write actions, task-scoped approvals, permission policy, and audit UI remain later evidence.`

currentState: `Version 15 adds runtime action capability and action-run history tables with idempotency, workspace/status, dispatch, harness, and retention indexes. The schema stores read-only capability and action-run records only.`

notParityStatement: `This fixture does not claim Mission Control host-control parity, local app process control, local command execution, controlled writes, or release readiness.`

activationRequirement: `Service evidence must prove action-run records are idempotent, redacted, retained, and non-executing before UI evidence cites them.`

releaseImpact: `Provides durable storage required by ITC-0030 while preserving safety and write-action residuals.`

determinism: `Migration checks assert table, column, and index names in an isolated local test store.`

noFakeProductSeed: `No product-visible seed data is added by the migration.`

noSimulatedRuntimeOutput: `No runtime transcript output is generated or stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, raw command environments, and runtime logs are excluded.`

redactionReview: `The schema stores sanitized capability JSON and action-run JSON; raw command environments are not fixture evidence.`

failureHandling: `If version 15 fails to create durable action capability or action-run history records, ITC-0030 evidence must be downgraded.`
