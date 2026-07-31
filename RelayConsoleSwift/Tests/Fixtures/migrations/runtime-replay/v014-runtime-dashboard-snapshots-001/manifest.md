# Migration Fixture Manifest - Runtime Dashboard Snapshots

id: `fix-migration-runtime-dashboard-snapshots-001`

layer: `migration`

productArea: `runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0087`, `RCSPR-0093`

sourceMapIds: `SM-0042`, `SM-0077`, `SM-0133`

featureIds: `FI-0031`, `FI-0055`, `FI-0097`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

fixtureKind: `runtime-dashboard-migration`

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

sourceBaseline: `Migrations.swift`, `MigrationTests.swift`, `RuntimeDashboardService.swift`

files:

- `migrations/runtime-replay/v014-runtime-dashboard-snapshots-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../../Sources/RelayConsoleCore/Migrations.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0029`

validationCommandIds: `VC-0100`

demoIds: `Demo 4`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-030-itc-0029-runtime-dashboard-snapshots.md`

surface: `Runtime dashboard retained snapshot tables`

stateKind: `verified-migration`

reasonCode: `runtime-dashboard-snapshot-schema`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

missingPrerequisites: `Manual Applications dashboard screenshots and real-harness runtime observations remain separate evidence rows.`

currentState: `Version 14 adds retained runtime dashboard snapshot and row tables with workspace, state, snapshot, and harness indexes. The schema stores read-only dashboard summaries derived from retained runtime records and does not add Mission Control host-control, local app process status, local action, or icon endpoint tables.`

notParityStatement: `This fixture does not claim Mission Control host-control parity, local app process telemetry, connected-app fabrication, real-harness transcript proof, or release readiness.`

activationRequirement: `Service, contract, and visual evidence must consume these tables before release aggregation cites runtime dashboard availability.`

releaseImpact: `Provides durable storage required by ITC-0029 while preserving manual dashboard and real-harness residuals.`

determinism: `Migration checks assert table, column, and index names in an isolated local test store.`

noFakeProductSeed: `No product-visible seed data is added by the migration.`

noSimulatedRuntimeOutput: `No runtime transcript output is generated or stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, raw command environments, and runtime logs are excluded.`

redactionReview: `The schema stores sanitized snapshot JSON and row JSON only; source records with private local state are not copied into migration fixtures.`

failureHandling: `If version 14 fails to create durable snapshot tables or indexes, ITC-0029 dashboard evidence must be downgraded.`
