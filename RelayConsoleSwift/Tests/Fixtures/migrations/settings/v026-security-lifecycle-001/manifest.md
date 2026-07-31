# Migration Fixture Manifest - v026-security-lifecycle-001

id: `fix-migrations-settings-v026-security-lifecycle-001`

layer: `migrations`

productArea: `settings`

requirementIds: `ITC-0050`, `RCSPR-0064`, `RCSPR-0065`, `RCSPR-0097`

sourceMapIds: `SM-0100`, `SM-0101`, `SM-0102`, `SM-0155`

featureIds: `FI-0073`, `FI-0074`, `FI-0075`, `FI-0187`

gapOrDecisionIds: `D-0001`, `D-0004`, `D-0006`

fixtureKind: `schema-manifest`

owner: `settings-security`

status: `verified-source`

secretsPolicy: `no-secrets`

artifactClass: `migration-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `migration evidence`

sourceBaseline: `Migrations.swift`, `MigrationTests.swift`

files:

- `Tests/Fixtures/migrations/settings/v026-security-lifecycle-001/manifest.md`
- `Sources/RelayConsoleCore/Migrations.swift`
- `Tests/RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0050`, `CODE-001-049`

validationCommandIds: `VC-0100`

demoIds: `Demo 6`

branchPacket:
`agent-loop-relayconsole-swift-coding/evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`agent-loop-relayconsole-swift-coding/loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-049-itc-0050-security-support-legal-decision-gates.md`

surface: `settings_decision_gate_dispositions and settings_local_account_exports`

currentState: `Schema v26 adds durable decision-gate disposition records and redacted local account export metadata without seeding product-visible records.`

notParityStatement: `This migration fixture does not activate support/legal/status links, cloud account mode, password/session actions, destructive local lifecycle execution, support upload, or release readiness.`

activationRequirement: `D-0001, D-0004, and D-0006 must be resolved before gated support/legal/cloud/destructive actions become active product features.`

releaseImpact: `Allows ITC-0050 service tests to prove unavailable and decision-gated state honestly.`

determinism: `The fixture names exact table and index expectations with no runtime-specific values.`

noFakeProductSeed: `No support tickets, legal records, cloud sessions, account lifecycle records, local export rows, or destructive action rows are seeded by migration.`

noSimulatedRuntimeOutput: `No runtime transcript, support/legal output, cloud account output, or lifecycle execution output is generated.`

noGeneratedWelcome: `No generated welcome messages are inserted.`

privateStateExclusions: `Raw secrets, profile values, workspace values, browser sessions, support payloads, local paths, account exports, and destructive lifecycle payloads are excluded.`

redactionReview: `RelayConsoleMigrationTests verifies schema only; service tests verify export metadata stays secret-free.`

failureHandling: `If v26 tables seed product data, expose raw account values, or enable destructive/cloud/support/legal actions without decisions, ITC-0050 migration evidence fails.`
