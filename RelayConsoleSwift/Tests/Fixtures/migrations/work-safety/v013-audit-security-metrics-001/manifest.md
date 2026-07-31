# Migration Fixture Manifest - Audit Security Metrics v013

id: `fix-migrations-work-safety-v013-audit-security-metrics-001`
layer: `migration`
productArea: `work-safety`
requirementIds: `RCSPR-0007, RCSPR-0052, RCSPR-0096, RCSPR-0110, RCSPR-0127, RCSPR-0131, RCSPR-0136, RCSPR-0137, RCSPR-0188`
sourceMapIds: `SM-0081, SM-0084, SM-0085, SM-0086, SM-0111, SM-0145, SM-0146, SM-0148, SM-0150, SM-0151, SM-0155, SM-0160`
fixtureKind: `schema-manifest`
owner: `relay-console-swift`
status: `verified`
secretsPolicy: `redacted`

files:
- `Sources/RelayConsoleCore/Migrations.swift`
- `Tests/RelayConsoleMigrationTests/MigrationTests.swift`
- `Tests/Fixtures/migrations/work-safety/v013-audit-security-metrics-001/manifest.md`

expectedChecks:
- `VC-0100`
- `swift run --disable-sandbox RelayConsoleMigrationTests`
- Schema version `23` creates `audit_log_records` and `security_metric_snapshots`.
- Audit indexes cover workspace/time, event/time, resource, actor, and correlation lookups.
- Security metric indexes cover workspace generation time and fixed summary windows.

determinism: `Migration creates empty durable tables and indexes only; audit rows and metric snapshots are created by service calls from real retained events.`
noFakeProductSeed: `No audit_log_records or security_metric_snapshots rows are seeded by migration.`
noSimulatedRuntimeOutput: `No runtime output, command payload, provider response, approval result, export, reset, or file-permission result is included.`
noGeneratedWelcome: `No generated welcome messages are added.`
privateStateExclusions: `Raw credentials, tokens, command arguments, private paths, environment values, runtime payloads, screenshots, and export snippets are excluded from fixture content.`
redactionReview: `Manifest text contains no secrets or private paths; service fixtures provide redacted representative records.`
failureHandling: `If v013 seeds product audit data, omits audit/security indexes, stores raw sensitive payloads, or is cited as UI/release proof, ITC-0042 migration evidence fails.`

tableCoverage: `audit_log_records and security_metric_snapshots.`
branchScope: `ITC-0042`
