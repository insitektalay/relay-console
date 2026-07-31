# Service Fixture Manifest - Runtime Dispatch Cancel Failure

id: `fix-service-runtime-dispatch-cancel-failure-001`

layer: `service`

productArea: `runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0087`, `RCSPR-0093`

sourceMapIds: `SM-0042`, `SM-0077`, `SM-0133`

featureIds: `FI-0031`, `FI-0055`, `FI-0097`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`

fixtureKind: `service-authority-runtime-dispatch`

owner: `runtime-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `service-fixture`

branch: `codex/itc-0018-0020-runtime-dispatch-chat-evidence`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:35:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `DispatchService.swift`, `RuntimeDispatchState.swift`, `ServiceTests.swift`

files:

- `services/runtime/dispatch-cancel-failure-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0018`

validationCommandIds: `VC-0102`

demoIds: `Demo 2`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-019-itc-0018-runtime-dispatch-state-retry-cancel.md`

surface: `Dispatch retry/cancel service authority`

stateKind: `verified-service`

reasonCode: `service-runtime-dispatch-retry-cancel`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`

missingPrerequisites: `Manual real-harness Hermes/OpenClaw observations remain planned and are not replaced by this deterministic service test.`

currentState: `Service tests prove retry authority denies viewer calls without side effects, retries reuse the original user message, create a new dispatch attempt, link terminal agent output once, cancel supported Hermes-style active dispatches, keep cancelled terminal state monotonic, and deny unsupported OpenClaw cancellation without mutating the dispatch.`

notParityStatement: `This fixture does not claim real-harness transcript proof, OpenClaw cancellation support, relaunch replay closeout, dashboard parity, or release readiness.`

activationRequirement: `Real-harness evidence must still record actual Hermes/OpenClaw install/auth/health/dispatch/cancel-or-unavailable observations before release aggregation cites runtime proof.`

releaseImpact: `Automated service authority is covered for ITC-0018; real-harness/manual proof remains a residual.`

determinism: `Tests use deterministic bridge-boundary doubles and fixed local ids; no runtime transcript fixture text is treated as product proof.`

noFakeProductSeed: `No product-visible seed data is added outside isolated temporary test stores.`

noSimulatedRuntimeOutput: `No simulated runtime output is stored as product evidence; deterministic bridge output only verifies service state transitions.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, and runtime logs are excluded.`

redactionReview: `Service snapshots and event logs use redacted metadata and fixed non-secret strings.`

failureHandling: `If denied retry/cancel mutates dispatches, duplicates user messages, or creates duplicate terminal output, this fixture fails.`
