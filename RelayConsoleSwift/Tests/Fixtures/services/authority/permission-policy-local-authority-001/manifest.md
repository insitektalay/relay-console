# Service Fixture Manifest - Permission Policy Local Authority

id: `fix-services-authority-permission-policy-local-authority-001`

layer: `service`

productArea: `authority`

requirementIds: `RCSPR-0007`, `RCSPR-0051`, `RCSPR-0090`, `RCSPR-0096`,
`RCSPR-0110`, `RCSPR-0127`, `RCSPR-0131`, `RCSPR-0136`, `RCSPR-0137`,
`RCSPR-0188`, `ITC-0041`

sourceMapIds: `SM-0081`, `SM-0084`, `SM-0085`, `SM-0086`, `SM-0145`,
`SM-0146`, `SM-0148`, `SM-0150`, `SM-0151`, `SM-0155`

featureIds: `FI-0060`, `FI-0065`, `FI-0120`, `FI-0124`, `FI-0128`, `FI-0178`

gapOrDecisionIds: `SBD-0003`, `SBD-0006`, `APPROVALS-NAV-EXCLUDED-001`,
`LOCAL-APP-AUTONOMY-EXCLUDED-001`

fixtureKind: `evidence`

owner: `services`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `PermissionPolicyService.swift`, `WorkSafetyTaskService.swift`,
`LocalDataService.swift`, `ServiceTests.swift`, `ITC-0041`

files:

- `services/authority/permission-policy-local-authority-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0041`, `CODE-001-041`

validationCommandIds: `VC-0102`

demoIds: `Demo 5`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-041-itc-0041-permission-policy-local-authority.md`

roleContexts: `owner`, `admin`, `member`, `viewer`, `approver`, `operator`

policyCoverage: `Default owner/admin wildcard allow, default viewer/member read allow, approver approval resolve allow, operator tool-request report allow, scoped deny, disabled policy, delete policy, and workspace isolation.`

reasonCode: `policy.blocked`

auditEvidence: `Policy changes and denied retained actions write redacted permission audit event-log details.`

determinism: `The consuming service test uses stable role contexts, correlation ids, fixed timestamps, temporary roots, and deterministic policy matching rules.`

noFakeProductSeed: `The fixture does not seed product-visible sample tasks, agents, messages, approvals, policies, or runtime outputs.`

noSimulatedRuntimeOutput: `The fixture contains no runtime transcript, command output, provider result, generated artifact, or task execution output.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Temporary roots, private paths, raw credentials, raw tokens, local app paths, and source-host records are excluded or redacted.`

redactionReview: `RelayConsoleServiceTests scans permission policy rows and event-log details for raw private-path sentinel leakage.`

failureHandling: `Any policy lookup mismatch, workspace bleed, UI-only authority, missing audit link, runtime side effect, or redaction failure blocks ITC-0041 closeout.`
