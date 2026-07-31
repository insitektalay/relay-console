# Service Fixture Manifest - Work Safety Task Target Resolution

id: `fix-service-work-safety-task-target-resolution-001`

layer: `service`

productArea: `work-safety`

requirementIds: `RCSPR-0005`, `RCSPR-0006`, `RCSPR-0095`, `RCSPR-0124`, `RCSPR-0175`, `RCSPR-0176`, `RCSPR-0177`, `ITC-0038`, `ITC-0039`

sourceMapIds: `SM-0055`, `SM-0056`, `SM-0057`, `SM-0058`, `SM-0059`, `SM-0060`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0159`

featureIds: `FI-0041`, `FI-0042`, `FI-0043`, `FI-0044`, `FI-0045`, `FI-0046`, `FI-0165`, `FI-0166`, `FI-0167`

gapOrDecisionIds: `APPROVALS-NAV-EXCLUDED-001`, `CONTROLLED-WRITES-LATER-001`, `LOCAL-FILE-ACCESS-EXCLUDED-001`

fixtureKind: `work-safety-target-resolution-service`

owner: `work-safety-task-service`

status: `verified`

secretsPolicy: `secret-references-only`

artifactClass: `service-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `WorkSafetyTaskService.swift`, `LocalDataService.swift`, `ServiceTests.swift`

files:

- `services/work-safety/task-target-resolution-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/WorkSafetyTaskService.swift`
- `../../Sources/RelayConsoleCore/Models.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0039`, `CODE-001-039`

validationCommandIds: `VC-0102`

demoIds: `Demo 5`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-039-itc-0039-task-service-scheduling-targeting-approval-gates.md`

surface: `Task create/update target resolution for agent, team, department, thread-compatible direct links, agent-to-agent pair ids, schedule, recurrence, and authority checks`

stateKind: `verified-service`

reasonCode: `task-target-resolution-service-backed`

decisionIds: `APPROVALS-NAV-EXCLUDED-001`

missingPrerequisites: `Standalone Approvals queue/detail, approval resolver UI, executable runtime dispatch, permission-policy parity, controlled writes, native file access, and release readiness remain later evidence.`

currentState: `WorkSafetyTaskService resolves direct agent, team, department, and agent-to-agent task targets to existing workspace records, persists schedule and recurrence references, blocks member mutation, rejects unsupported runtime-binding targets, and leaves approval-required dispatch gating to the paired work-safety service fixture.`

notParityStatement: `This fixture does not claim standalone Approvals navigation, task execution output, provider write execution, local file access, policy parity, or release readiness.`

activationRequirement: `Runtime-binding and action-run task targets require later controlled-write authority and audit evidence before activation.`

releaseImpact: `Closes ITC-0039 service-backed target and schedule behavior for retained task records.`

determinism: `The service test uses isolated stores, fixed timestamps, deterministic organization records, deterministic agents, and no live provider data.`

noFakeProductSeed: `No product-visible task, approval, action-run, source-host, scheduled-message, or runtime output rows are seeded outside isolated service tests.`

noSimulatedRuntimeOutput: `No runtime transcript, command result, generated artifact, provider result, or task execution output is generated or stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, source-host records, raw command environments, auth/session data, runtime logs, and local filesystem roots are excluded.`

redactionReview: `The target-resolution service path stores only retained ids and redacted metadata and does not include raw private state.`

failureHandling: `If member mutation succeeds, invalid targets persist, cross-workspace targets are accepted, schedules are lost, unsupported runtime-binding targets become active, standalone Approvals are claimed, or task execution output is produced, this fixture fails.`
