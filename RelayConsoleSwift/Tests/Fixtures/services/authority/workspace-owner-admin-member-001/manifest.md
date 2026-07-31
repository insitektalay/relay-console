# Service Fixture Manifest - Workspace Owner Admin Member Authority

id: `fix-services-authority-workspace-owner-admin-member-001`

layer: `service`

productArea: `authority`

requirementIds: `RCSPR-0130`, `RCSPR-0131`, `RCSPR-0132`, `RCSPR-0145`,
`RCSPR-0152`, `RCSPR-0153`

sourceMapIds: `SM-0148`, `SM-0150`, `SM-0151`, `SM-0154`, `SM-0155`

featureIds: `FI-0123`, `FI-0124`, `FI-0125`, `FI-0136`, `FI-0143`, `FI-0144`

gapOrDecisionIds: `SBD-0001`

fixtureKind: `evidence`

owner: `services`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0006-0008-service-replay-visual-scaffold`

commit: `69b6e30`

appVersion: `0.1.0`

capturedAt: `2026-06-22T19:31:46Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `ServiceGuards.swift`, `LocalDataService.swift`,
`guarded-state-standard.md`, `service-authority-negative-drill-matrix.md`

files:

- `services/authority/workspace-owner-admin-member-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0006`

validationCommandIds: `VC-0102`

branchPacket:
`evidence/branches/codex-itc-0006-0008-service-replay-visual-scaffold/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-007-itc-0006-service-guard-scaffold.md`

drillIdsReviewed: `SAN-001`, `SAN-002`, `SAN-003`, `SAN-007`, `SAN-009`,
`SAN-015`, `SAN-016`

roleContexts: `owner`, `admin`, `member`, `viewer`

directCallEvidence: `RelayConsoleServiceTests guarded direct-call helpers`

sideEffectCheck: `Denied agent/thread mutations check persisted counts and event publication before and after guard results.`

reasonCode: `authority.role_required`

auditEvidence: `Denied authority events are written through LocalDataService.log with redacted details.`

determinism: `The consuming service test uses stable role contexts, correlation ids, canonical reason codes, and temporary local data roots.`

noFakeProductSeed: `The fixture does not seed product-visible sample conversations, agents, harnesses, or runtime output.`

noSimulatedRuntimeOutput: `The fixture contains no runtime output.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Temporary roots are not recorded; private paths, personal account values, and raw credentials are excluded.`

redactionReview: `RelayConsoleServiceTests redaction check plus branch evidence redaction scan.`

failureHandling: `Any direct-call mutation bypass, missing reason code, missing audit detail, or redaction failure blocks service scaffold closeout.`
