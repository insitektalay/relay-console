# Migration Fixture Manifest - Work Safety Task Approval Foundation

id: `fix-migration-work-safety-v011-approvals-permissions-001`

layer: `migration`

productArea: `work-safety`

requirementIds: `RCSPR-0005`, `RCSPR-0006`, `RCSPR-0095`, `RCSPR-0124`, `RCSPR-0175`, `RCSPR-0176`, `RCSPR-0177`, `ITC-0038`

sourceMapIds: `SM-0055`, `SM-0056`, `SM-0057`, `SM-0058`, `SM-0059`, `SM-0060`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0159`

featureIds: `FI-0041`, `FI-0042`, `FI-0043`, `FI-0044`, `FI-0045`, `FI-0046`, `FI-0165`, `FI-0166`, `FI-0167`

gapOrDecisionIds: `ITC-0038`, `ITC-0039`, `ITC-0040`, `ITC-0041`, `APPROVALS-NAV-EXCLUDED-001`

fixtureKind: `work-safety-task-approval-migration`

owner: `work-safety-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `migration-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `migration evidence`

sourceBaseline: `Migrations.swift`, `MigrationTests.swift`, `LocalDataService.swift`

files:

- `migrations/work-safety/v011-approvals-permissions-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../../Sources/RelayConsoleCore/Migrations.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0038`, `CODE-001-038`

validationCommandIds: `VC-0100`

demoIds: `Demo 5`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-038-itc-0038-task-approval-migration-foundation.md`

surface: `Work safety task, task run, task event, approval, approval step, and approval note schema`

stateKind: `verified-migration`

reasonCode: `task-approval-foundation-schema`

decisionIds: `APPROVALS-NAV-EXCLUDED-001`

missingPrerequisites: `Standalone Approvals navigation, task dispatch, approval resolution, policy enforcement, controlled writes, native file access, and audit-log release proof remain later evidence.`

currentState: `Version 21 adds durable work_safety tables and indexes for pending, queued, dispatched, failed, cancelled, blocked-by-approval, and linked task/action/run/approval states without enabling executable work.`

notParityStatement: `This fixture does not claim standalone Approvals UI, approval execution, task dispatch, policy enforcement, source-host/local file access, controlled writes, provider writes, or release readiness.`

activationRequirement: `Service and contract evidence must prove durable redacted records and no-executable-work boundaries before later UI or policy layers cite this schema.`

releaseImpact: `Provides storage foundations required by ITC-0038 while preserving standalone Approvals and executable work exclusions.`

determinism: `Migration checks assert table, column, and index names in an isolated local test store with fixed expected schema names.`

noFakeProductSeed: `No product-visible task, approval, action-run, source-host, scheduled-message, or audit rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output, approval result, command output, provider result, or task execution output is generated or stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, source-host records, raw command environments, auth/session data, runtime logs, and local filesystem roots are excluded.`

redactionReview: `Schema and service helpers store sanitized JSON records with private-state-excluded redaction status.`

failureHandling: `If version 21 cannot create durable task and approval records while preserving standalone Approvals exclusion, ITC-0038 evidence must be downgraded.`
