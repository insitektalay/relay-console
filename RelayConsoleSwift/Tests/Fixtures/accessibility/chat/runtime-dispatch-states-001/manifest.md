# Accessibility Fixture Manifest - Chat Runtime Dispatch States

id: `fix-accessibility-chat-runtime-dispatch-states-001`

layer: `accessibility`

productArea: `chat-runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0087`, `RCSPR-0093`

sourceMapIds: `SM-0042`, `SM-0077`, `SM-0133`

featureIds: `FI-0031`, `FI-0055`, `FI-0097`

gapOrDecisionIds: `G-0129`

fixtureKind: `source-backed-accessibility-state-evidence`

owner: `accessibility`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-source-review`

branch: `codex/itc-0018-0020-runtime-dispatch-chat-evidence`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:35:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`

files:

- `accessibility/chat/runtime-dispatch-states-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0018`

validationCommandIds: `VC-0107`

demoIds: `Demo 2`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-019-itc-0018-runtime-dispatch-state-retry-cancel.md`

surface: `Runtime Cancel Retry Reconnect accessibility labels`

stateKind: `verified-source-accessibility`

reasonCode: `runtime-dispatch-accessibility-source`

decisionIds: `none`

missingPrerequisites: `Manual keyboard and VoiceOver traversal remain planned before accessibility closeout.`

currentState: `Cancel runtime dispatch, Retry runtime dispatch, and Reconnect ChatGPT controls expose help and accessibility labels from Swift source.`

notParityStatement: `This fixture is not a manual VoiceOver review, screenshot review, real-harness review, or release claim.`

activationRequirement: `Manual accessibility proof must record focus order and spoken labels before Demo 8 closeout.`

releaseImpact: `Automated source anchors exist; manual accessibility remains residual.`

determinism: `The fixture checks fixed Swift accessibility strings.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, screenshots, and runtime snapshots are excluded.`

redactionReview: `Fixture text contains no secrets.`

failureHandling: `If runtime action labels disappear, accessibility evidence fails until restored.`
