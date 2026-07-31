# UI Fixture Manifest - Chat Runtime Dispatch States

id: `fix-ui-chat-runtime-dispatch-states-001`

layer: `ui`

productArea: `chat-runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0087`, `RCSPR-0093`

sourceMapIds: `SM-0042`, `SM-0077`, `SM-0133`

featureIds: `FI-0031`, `FI-0055`, `FI-0097`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`

fixtureKind: `source-backed-ui-state-evidence`

owner: `chat-ui`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `ui-source-review`

branch: `codex/itc-0018-0020-runtime-dispatch-chat-evidence`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:35:00Z`

reviewer: `Codex`

reviewerRole: `UI evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `UIComponents.swift`

files:

- `ui/chat/runtime-dispatch-states-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0018`

validationCommandIds: `VC-0105`

demoIds: `Demo 2`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-019-itc-0018-runtime-dispatch-state-retry-cancel.md`

surface: `Runtime active, failed, retryable, cancel, reconnect, and cancelled chat cards`

stateKind: `verified-source-ui`

reasonCode: `runtime-dispatch-card-state`

decisionIds: `RUNTIME-CHAT-001`

missingPrerequisites: `Screenshot and VoiceOver captures remain planned before visual/manual closeout.`

currentState: `DispatchStatusView renders active thinking/replying cards, runtime/attempt badges, Cancel, failed/offline/auth cards, error-code and Retryable badges, Retry, Reconnect ChatGPT, and cancelled cards from dispatch records.`

notParityStatement: `This source-backed UI fixture is not screenshot proof, real-harness proof, relaunch replay proof, or release readiness.`

activationRequirement: `Manual visual/accessibility evidence must cite window size, focus path, and redaction before this can become Demo proof.`

releaseImpact: `Provides automated source anchors for ITC-0018 UI behavior with manual residuals.`

determinism: `Source anchors are fixed Swift labels and method names.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, screenshots, and runtime snapshots are excluded.`

redactionReview: `Fixture text contains only fixed labels and no secrets.`

failureHandling: `If Cancel, Retry, Reconnect, runtime labels, or error badges lose source anchors, ITC-0018 UI evidence fails.`
