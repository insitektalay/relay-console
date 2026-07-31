# Service Fixture Manifest - Work Safety Approval Required Block

id: `fix-service-work-safety-approval-required-block-001`

layer: `service`

productArea: `work-safety`

requirementIds: `RCSPR-0005`, `RCSPR-0006`, `RCSPR-0095`, `RCSPR-0124`, `RCSPR-0175`, `RCSPR-0176`, `RCSPR-0177`, `ITC-0038`, `ITC-0039`

sourceMapIds: `SM-0055`, `SM-0056`, `SM-0057`, `SM-0058`, `SM-0059`, `SM-0060`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0159`

featureIds: `FI-0041`, `FI-0042`, `FI-0043`, `FI-0044`, `FI-0045`, `FI-0046`, `FI-0165`, `FI-0166`, `FI-0167`

gapOrDecisionIds: `APPROVALS-NAV-EXCLUDED-001`, `CONTROLLED-WRITES-LATER-001`, `LOCAL-FILE-ACCESS-EXCLUDED-001`

fixtureKind: `work-safety-approval-required-service`

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

- `services/work-safety/approval-required-block-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/WorkSafetyTaskService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0039`, `CODE-001-039`

validationCommandIds: `VC-0102`

demoIds: `Demo 5`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-039-itc-0039-task-service-scheduling-targeting-approval-gates.md`

surface: `Approval-required task dispatch block, relaunch persistence, redacted denial detail, reusable blocked run, and no runtime action output`

stateKind: `verified-service`

reasonCode: `approval-required-dispatch-blocked`

decisionIds: `APPROVALS-NAV-EXCLUDED-001`

missingPrerequisites: `Standalone Approvals queue/detail, resolver UI decisions, permission-policy parity, controlled writes, native file access, release readiness, and task execution output remain later evidence.`

currentState: `WorkSafetyTaskService creates approval-required tasks in blocked-by-approval state, records a pending task-scoped approval, denies dispatch before approval across relaunch, redacts denial detail, and leaves runtime action rows empty.`

notParityStatement: `This fixture does not claim standalone Approvals navigation, provider write execution, local file access, approval queue policy decisions, task execution output, or release readiness.`

activationRequirement: `Approved dispatch remains retained-service-only until later controlled-write and permission cards add executable runtime behavior with audit evidence.`

releaseImpact: `Closes the ITC-0039 approval-required service gate for inert task dispatch.`

determinism: `The service test uses isolated stores, fixed timestamps, deterministic agents, redacted denial payloads, and a relaunch reopen against the same local database root.`

noFakeProductSeed: `No product-visible approval, task, action-run, source-host, scheduled-message, or runtime output rows are seeded outside isolated service tests.`

noSimulatedRuntimeOutput: `No runtime transcript, command result, generated artifact, provider result, or task execution output is generated or stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, source-host records, raw command environments, auth/session data, runtime logs, and local filesystem roots are excluded or redacted.`

redactionReview: `Service assertions scan persisted event JSON for raw private paths and sensitive values and require redacted sentinels for denial detail.`

failureHandling: `If approval-required dispatch succeeds before approval, relaunch bypasses the block, duplicate blocked runs are created, raw sensitive values persist, runtime action rows appear, standalone Approvals are claimed, or task execution output is produced, this fixture fails.`
