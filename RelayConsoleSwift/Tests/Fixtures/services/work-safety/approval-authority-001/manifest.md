# Service Fixture Manifest - Work Safety Approval Authority

id: `fix-service-work-safety-approval-authority-001`

layer: `service`

productArea: `work-safety`

requirementIds: `RCSPR-0007`, `RCSPR-0049`, `RCSPR-0050`, `RCSPR-0096`, `RCSPR-0110`, `RCSPR-0127`, `RCSPR-0131`, `RCSPR-0136`, `RCSPR-0187`, `ITC-0038`, `ITC-0039`, `ITC-0040`

sourceMapIds: `SM-0079`, `SM-0080`, `SM-0081`, `SM-0082`, `SM-0086`, `SM-0128`, `SM-0141`, `SM-0145`, `SM-0146`, `SM-0150`, `SM-0151`, `SM-0155`, `SM-0160`

featureIds: `FI-0057`, `FI-0058`, `FI-0059`, `FI-0065`, `FI-0120`, `FI-0124`, `FI-0128`, `FI-0177`

gapOrDecisionIds: `APPROVALS-NAV-EXCLUDED-001`, `CONTROLLED-WRITES-LATER-001`, `AUDIT-COMPLETE-LATER-001`

fixtureKind: `work-safety-approval-authority-service`

owner: `work-safety-task-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `service-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `WorkSafetyTaskService.swift`, `LocalDataService.swift`, `ServiceTests.swift`

files:

- `services/work-safety/approval-authority-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/WorkSafetyTaskService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0040`, `CODE-001-040`, `ITC-0039`, `CODE-001-039`

validationCommandIds: `VC-0102`

demoIds: `Demo 5`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-040-itc-0040-task-scoped-approval-authority-linked-transitions.md`

surface: `Retained task-scoped approval list/detail reads, explicit approver authority, admin fallback, pending-only decisions, expiry, duplicate-decision rejection, linked task queued/failed transitions, event publication, and redacted audit hooks`

stateKind: `verified-service`

reasonCode: `task-scoped-approval-authority-service-backed`

decisionIds: `APPROVALS-NAV-EXCLUDED-001`

missingPrerequisites: `Standalone Approvals queue/detail/navigation, active task-scoped approval UI, complete audit-log parity, permission-policy parity, controlled writes, native file access, provider writes, source-host/local app workflows, release readiness, and task execution output remain later evidence.`

currentState: `WorkSafetyTaskService resolves retained task-scoped approvals through service authority only: explicit approver metadata wins, admin fallback is allowed only when policy permits, non-admin and cross-workspace attempts fail without linked-state mutation, approval-required dispatch remains gated until resolution, pending-only decisions are enforced, expired approvals become expired and cannot resolve, approved approvals queue linked tasks, rejected approvals fail linked tasks, notes and events are redacted, and runtime action rows remain empty.`

notParityStatement: `This fixture does not claim standalone Approvals navigation, approval queue/detail UI, permission-policy parity, complete audit logs, controlled-write execution, native file access, provider write execution, source-host/local app parity, task execution output, or release readiness.`

activationRequirement: `Active task-scoped approval UI and high-risk execution require later UI, audit, permission, controlled-write, visual, accessibility, and manual evidence.`

releaseImpact: `Closes the retained ITC-0040 service authority and linked-task transition slice only.`

determinism: `The service test uses isolated stores, fixed timestamps, deterministic actor ids, deterministic task/approval records, and no live provider data.`

noFakeProductSeed: `No product-visible approval queue, task execution output, runtime action row, source-host row, audit release row, or controlled-write row is seeded outside isolated service tests.`

noSimulatedRuntimeOutput: `No runtime transcript, command result, generated artifact, provider result, or task execution output is generated or stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, source-host records, raw command environments, auth/session data, runtime logs, decision notes, and local filesystem roots are excluded or redacted.`

redactionReview: `Service assertions scan persisted approval, note, event, and event-log JSON for raw private paths and sensitive token values and require redacted sentinels.`

failureHandling: `If explicit approver policy is bypassed, admin fallback ignores policy, non-admin or cross-workspace users resolve approvals, expired or duplicate approvals mutate linked tasks twice, notes leak sensitive values, events duplicate, runtime output appears, standalone Approvals are claimed, or task execution output is produced, this fixture fails.`
