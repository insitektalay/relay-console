# Migration Fixture Manifest - v027-insights-reports-001

id: `fix-migrations-reports-v027-insights-reports-001`

layer: `migrations`

productArea: `reports`

requirementIds: `ITC-0051`, `RCSPR-0150`, `RCSPR-0153`

sourceMapIds: `SM-0155`, `SM-0162`, `SM-0163`

featureIds: `FI-0144`, `FI-0188`

gapOrDecisionIds: `REPORT-STRUCTURED-JOBS-PENDING`

fixtureKind: `schema-manifest`

owner: `reports-insights`

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

- `Tests/Fixtures/migrations/reports/v027-insights-reports-001/manifest.md`
- `Sources/RelayConsoleCore/Migrations.swift`
- `Tests/RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0051`, `CODE-001-050`

validationCommandIds: `VC-0100`

demoIds: `Demo 6`

branchPacket:
`agent-loop-relayconsole-swift-coding/evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`agent-loop-relayconsole-swift-coding/loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-050-itc-0051-reports-insights-wrapups.md`

surface: `thread_wrap_up_reports archive/retry metadata and insights_report_snapshots`

currentState: `Schema v27 adds archived/retry/redaction metadata to thread_wrap_up_reports and creates insights_report_snapshots for retained local report snapshots without product-visible seed rows.`

notParityStatement: `This migration fixture does not activate runtime report generation, retry execution, external analytics, screenshot proof, release readiness, or any fabricated report centre rows.`

activationRequirement: `Structured-job report generation, retry execution, rendered visual review, and release evidence must be completed before those capabilities are marked active parity.`

releaseImpact: `Allows ITC-0051 service and UI source tests to prove source-backed report rows, archived-list behavior, and honest empty states.`

determinism: `The fixture names exact tables, archive columns, retry columns, and indexes with no runtime-specific values.`

noFakeProductSeed: `No report snapshots, wrap-up reports, chats, agents, analytics rows, or archived-list rows are seeded by migration.`

noSimulatedRuntimeOutput: `No runtime transcript, generated report markdown, analytics export, or retry output is generated.`

noGeneratedWelcome: `No generated welcome messages are inserted.`

privateStateExclusions: `Raw report payloads, private paths, prompts, account values, workspace values, runtime logs, and generated transcript contents are excluded.`

redactionReview: `RelayConsoleMigrationTests verifies schema only; service tests verify retained report metadata is redacted before Insights projection.`

failureHandling: `If v27 seeds product reports, exposes raw private data, omits archive/retry columns, or claims runtime generation/retry support, ITC-0051 migration evidence fails.`
