# Service Fixture Manifest - Audit Security Redaction

id: `fix-services-work-safety-audit-security-redaction-001`
layer: `service`
productArea: `work-safety`
requirementIds: `RCSPR-0007, RCSPR-0052, RCSPR-0096, RCSPR-0110, RCSPR-0127, RCSPR-0131, RCSPR-0136, RCSPR-0137, RCSPR-0188, ITC-0042`
sourceMapIds: `SM-0081, SM-0084, SM-0085, SM-0086, SM-0111, SM-0145, SM-0146, SM-0148, SM-0150, SM-0151, SM-0155, SM-0160`
featureIds: `FI-0061, FI-0065, FI-0120, FI-0124, FI-0128, FI-0178`
gapOrDecisionIds: `ITC-0039, ITC-0042, APPROVALS-NAV-EXCLUDED-001`
fixtureKind: `service-authority-redaction`
owner: `audit-security-service`
status: `verified`
secretsPolicy: `redacted`

files:
- `Tests/Fixtures/services/work-safety/audit-security-redaction-001/manifest.md`
- `Tests/RelayConsoleServiceTests/ServiceTests.swift`
- `Sources/RelayConsoleCore/AuditSecurityService.swift`
- `Sources/RelayConsoleCore/LocalDataService.swift`
- `Sources/RelayConsoleCore/Redaction.swift`

expectedChecks:
- `VC-0102`
- `swift run --disable-sandbox RelayConsoleServiceTests`
- Admin-only audit list and metric summary reads.
- Viewer/member denial with audit rows.
- Pagination, filtering, workspace isolation, relaunch persistence, and security metric aggregation.
- Redaction of secrets, command arguments, environment values, private paths, runtime-style payload metadata, and evidence snippets.

determinism: `Uses fixed timestamps, fixture ids, direct service calls, and durable SQLite relaunch checks.`
noFakeProductSeed: `No migration seed rows, fake approvals, fake task runs, fake tool grants, fake file grants, or fabricated security metric rows are used.`
noSimulatedRuntimeOutput: `No runtime transcript output, approval result, command output, provider result, file access result, export result, reset result, or task execution output is included or simulated.`
noGeneratedWelcome: `No generated welcome content is included.`
privateStateExclusions: `Raw credentials, tokens, command arguments, private paths, environment values, runtime payloads, screenshots, and export snippets are excluded or redacted before persistence.`
redactionReview: `Representative audit records contain [REDACTED] markers and service tests scan audit, metric, and event storage for raw sensitive sentinels.`
failureHandling: `If admin-only reads, write-resilience behavior, redaction, relaunch persistence, workspace isolation, approval-required linkage, or security metric aggregation regress, ITC-0042 service evidence fails.`

implementationTaskIds: `ITC-0039, ITC-0042, CODE-001-039, CODE-001-042`
validationCommandIds: `VC-0102`
demoIds: `Demo 5, Demo 7`
stateKind: `verified-service`
reasonCode: `audit-security-redaction`
approvalBoundary: `standalone Approvals navigation remains excluded; task-scoped approval-required audit rows are retained service evidence only.`
branchScope: `CODE-001-042`
