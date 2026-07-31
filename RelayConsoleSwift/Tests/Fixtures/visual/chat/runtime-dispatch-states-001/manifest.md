# Visual Fixture Manifest - Chat Runtime Dispatch States

id: `fix-visual-chat-runtime-dispatch-states-001`

layer: `visual`

productArea: `chat-runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0087`, `RCSPR-0093`

sourceMapIds: `SM-0042`, `SM-0077`, `SM-0133`

featureIds: `FI-0031`, `FI-0055`, `FI-0097`

gapOrDecisionIds: `G-0129`

fixtureKind: `source-backed-visual-state-evidence`

owner: `chat-ui`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `visual-source-review`

branch: `codex/itc-0018-0020-runtime-dispatch-chat-evidence`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:35:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`

files:

- `visual/chat/runtime-dispatch-states-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0018`

validationCommandIds: `VC-0106`

demoIds: `Demo 2`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-019-itc-0018-runtime-dispatch-state-retry-cancel.md`

surface: `Runtime dispatch cards visual state source anchors`

stateKind: `verified-source-visual`

reasonCode: `runtime-dispatch-visual-source`

decisionIds: `none`

missingPrerequisites: `Standard-window and minimum-window screenshots remain required before visual closeout.`

currentState: `Source renders full active, failed, retryable, reconnect, cancelled, runtime badge, attempt badge, and error-code states without adding fake runtime cards.`

notParityStatement: `This fixture does not claim screenshot parity, VoiceOver traversal, real runtime transcript evidence, or release readiness.`

activationRequirement: `A reviewer must capture redacted runtime-card screenshots before Demo 8 visual claims.`

releaseImpact: `Keeps ITC-0018 visual evidence partial but source-backed.`

determinism: `Source anchors are stable labels and view names.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, and screenshots are excluded until reviewed.`

redactionReview: `Manifest contains no secrets.`

failureHandling: `If runtime card controls overlap or lose state labels in future screenshots, visual closeout must stay partial.`
