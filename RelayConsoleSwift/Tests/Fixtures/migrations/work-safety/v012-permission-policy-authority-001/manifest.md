# Migration Fixture Manifest - Work Safety Permission Policy Authority

id: `fix-migrations-work-safety-v012-permission-policy-authority-001`

layer: `migration`

productArea: `work-safety`

requirementIds: `RCSPR-0007`, `RCSPR-0051`, `RCSPR-0090`, `RCSPR-0096`,
`RCSPR-0110`, `RCSPR-0127`, `RCSPR-0131`, `RCSPR-0136`, `RCSPR-0137`,
`ITC-0041`

sourceMapIds: `SM-0081`, `SM-0084`, `SM-0085`, `SM-0086`, `SM-0145`,
`SM-0146`, `SM-0148`, `SM-0150`, `SM-0151`, `SM-0155`

featureIds: `FI-0060`, `FI-0065`, `FI-0120`, `FI-0124`, `FI-0128`, `FI-0178`

gapOrDecisionIds: `SBD-0003`, `SBD-0006`, `LOCAL-APP-AUTONOMY-EXCLUDED-001`

fixtureKind: `evidence`

owner: `persistence`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `migration evidence`

sourceBaseline: `Migrations.swift`, `MigrationTests.swift`, `ITC-0041`

files:

- `migrations/work-safety/v012-permission-policy-authority-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0041`, `CODE-001-041`

validationCommandIds: `VC-0100`

demoIds: `Demo 5`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-041-itc-0041-permission-policy-local-authority.md`

schemaVersion: `22`

tableCoverage: `permission_policies with workspace, lookup, effect, and actor indexes.`

defaultPolicyLocation: `Default policies are installed by PermissionPolicyService for the active workspace, not by migration seed rows.`

determinism: `Migration assertions use schema introspection only and require zero policy rows after bare migration.`

noFakeProductSeed: `The migration creates empty permission policy tables and does not seed product-visible policies.`

noSimulatedRuntimeOutput: `No runtime output, task output, command output, or provider result is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, tokens, and local app/source-host values are excluded.`

redactionReview: `Migration tests and branch scans verify no private-state fixture values are introduced.`

failureHandling: `Missing policy table/index/column coverage or seeded policy rows blocks ITC-0041 migration evidence.`
