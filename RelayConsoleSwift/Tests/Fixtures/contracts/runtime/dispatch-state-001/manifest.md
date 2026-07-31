# Contract Fixture Manifest - Runtime Dispatch State

id: `fix-contract-runtime-dispatch-state-001`

layer: `contract`

productArea: `runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0087`, `RCSPR-0093`

sourceMapIds: `SM-0042`, `SM-0077`, `SM-0133`

featureIds: `FI-0031`, `FI-0055`, `FI-0097`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`

fixtureKind: `runtime-dispatch-contract`

owner: `runtime-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `contract-fixture`

branch: `codex/itc-0018-0020-runtime-dispatch-chat-evidence`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:35:00Z`

reviewer: `Codex`

reviewerRole: `contract evidence`

sourceBaseline: `RuntimeDispatchState.swift`, `RuntimeBridge.swift`, `ModelContractTests.swift`

files:

- `contracts/runtime/dispatch-state-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0018`

validationCommandIds: `VC-0101`

demoIds: `Demo 2`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-019-itc-0018-runtime-dispatch-state-retry-cancel.md`

surface: `RuntimeDispatch action state and retry/cancel metadata`

stateKind: `verified-contract`

reasonCode: `runtime-dispatch-state`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`

missingPrerequisites: `Real-harness observations and relaunch replay closeout remain separate evidence rows.`

currentState: `RuntimeDispatch exposes active/terminal state, runtime label, attempt, retry source, retry safety evidence, posted message id, error code/message, and action-state eligibility for cancel and retry.`

notParityStatement: `This fixture does not claim real runtime transcript output, relaunch replay, Mission Control host-control, OpenClaw cancellation support, or release readiness.`

activationRequirement: `Service and UI fixtures must consume this contract before claiming retry/cancel behavior.`

releaseImpact: `Provides contract coverage for ITC-0018 automated closeout while leaving real-harness and replay claims to later evidence.`

determinism: `The fixture uses fixed ids, redacted error text, and deterministic action-state inputs.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, runtime logs, and auth values are excluded.`

redactionReview: `Error messages and auth fields use redacted fixture values.`

failureHandling: `If retry/cancel action state drifts from this contract, ITC-0018 service/UI evidence must be downgraded.`
