# Service Fixture Manifest - Runtime Action Runs

id: `fix-service-runtime-action-runs-001`

layer: `service`

productArea: `runtime`

requirementIds: `RCSPR-0006`, `RCSPR-0044`, `RCSPR-0045`, `RCSPR-0095`, `RCSPR-0109`, `RCSPR-0124`, `RCSPR-0133`, `RCSPR-0176`

sourceMapIds: `SM-0071`, `SM-0072`, `SM-0075`, `SM-0076`, `SM-0078`, `SM-0145`, `SM-0148`, `SM-0151`, `SM-0159`

featureIds: `FI-0051`, `FI-0052`, `FI-0117`, `FI-0126`, `FI-0166`, `FI-0167`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

fixtureKind: `runtime-action-run-service`

owner: `runtime-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `service-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `RuntimeActionService.swift`, `LocalDataService.swift`, `ServiceTests.swift`

files:

- `services/runtime/action-runs-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/RuntimeActionService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0030`

validationCommandIds: `VC-0102`

demoIds: `Demo 4`, `Demo 5`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-031-itc-0030-runtime-action-runs.md`

surface: `Runtime action capability and action-run read model`

stateKind: `verified-service`

reasonCode: `runtime-action-run-service`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

missingPrerequisites: `Controlled write actions, task-scoped approvals, permission policy, and audit UI remain later evidence.`

currentState: `RuntimeActionService persists read-only capabilities and action-run history, reuses idempotency keys, records dry-run, unsupported, destructive-blocked, and failed terminal rows, trims history, survives relaunch, and does not execute runtime commands.`

notParityStatement: `This fixture does not claim Mission Control host-control parity, local app process status, local command execution, controlled writes, or release readiness.`

activationRequirement: `UI evidence must present these rows as read-only until controlled write-action cards and safety gates pass.`

releaseImpact: `Automated service coverage closes the durable action-run foundation for ITC-0030 while preserving write-action residuals.`

determinism: `The test uses isolated temporary stores, fixed timestamps, fixed idempotency keys, and retained runtime dispatch state.`

noFakeProductSeed: `No product-visible seed data is added outside isolated temporary test stores.`

noSimulatedRuntimeOutput: `No simulated runtime output is stored as product evidence; action-run records are deterministic service state.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, raw command environments, and runtime logs are excluded.`

redactionReview: `Stored action-run JSON, request JSON, and failure JSON are checked for excluded private path and sensitive command text.`

failureHandling: `If idempotency creates duplicates, unsupported/destructive actions execute, terminal rows disappear after relaunch, or private state persists, this fixture fails.`
