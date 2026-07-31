# Migration Fixture Manifest - Runtime Recovery Records

id: `fix-migration-runtime-recovery-records-001`

layer: `migration`

productArea: `runtime`

requirementIds: `RCSPR-0006`, `RCSPR-0046`, `RCSPR-0047`, `RCSPR-0124`, `RCSPR-0133`, `RCSPR-0176`, `RCSPR-0177`

sourceMapIds: `SM-0073`, `SM-0074`, `SM-0075`, `SM-0076`, `SM-0078`, `SM-0145`, `SM-0146`, `SM-0148`, `SM-0151`, `SM-0159`

featureIds: `FI-0053`, `FI-0054`, `FI-0117`, `FI-0126`, `FI-0167`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

fixtureKind: `runtime-recovery-migration`

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

sourceBaseline: `Migrations.swift`, `MigrationTests.swift`, `RuntimeRecoveryService.swift`

files:

- `migrations/runtime-replay/v016-runtime-recovery-records-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../../Sources/RelayConsoleCore/Migrations.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0031`

validationCommandIds: `VC-0100`

demoIds: `Demo 4`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-032-itc-0031-runtime-recovery-records.md`

surface: `Runtime structured jobs, missing tools, and recovery schema`

stateKind: `verified-migration`

reasonCode: `runtime-recovery-schema`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

missingPrerequisites: `Applications UI, Needed Tools UI, and controlled writes remain later evidence.`

currentState: `Version 16 adds structured job, missing-tool event, and runtime recovery record tables with workspace, dispatch, action-run, agent, job, and state indexes.`

notParityStatement: `This fixture does not claim source-host/local app support, auto-install, fake tool grants, or release readiness.`

activationRequirement: `Service evidence must prove source-host exclusion, typed events, redaction, and no auto-install before UI evidence cites recovery records.`

releaseImpact: `Provides durable storage required by ITC-0031 while preserving source-host and local app exclusions.`

determinism: `Migration checks assert table, column, and index names in an isolated local test store.`

noFakeProductSeed: `No product-visible seed data is added by the migration.`

noSimulatedRuntimeOutput: `No runtime transcript output is generated or stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, source-host records, raw command environments, and runtime logs are excluded.`

redactionReview: `The schema stores sanitized structured-job, missing-tool, and recovery JSON.`

failureHandling: `If version 16 fails to create durable recovery records, ITC-0031 evidence must be downgraded.`
