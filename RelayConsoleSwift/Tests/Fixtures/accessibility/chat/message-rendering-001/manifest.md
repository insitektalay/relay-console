# Accessibility Fixture Manifest - Chat Message Rendering

id: `fix-accessibility-chat-message-rendering-001`

layer: `accessibility`

productArea: `chat`

requirementIds: `RCSPR-0025`, `RCSPR-0079`, `RCSPR-0114`, `RCSPR-0116`, `RCSPR-0152`, `RCSPR-0163`

sourceMapIds: `SM-0035`, `SM-0122`, `SM-0123`, `SM-0130`, `SM-0155`, `SM-0157`

featureIds: `FI-0030`, `FI-0088`, `FI-0114`, `FI-0143`, `FI-0154`

gapOrDecisionIds: `CHAT-MSR-001`

fixtureKind: `source-backed-accessibility-evidence`

owner: `message-renderer`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:45:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `MessageRendering.swift`, `screen-contracts/chat/message-stream-and-rendering.md`

files:

- `accessibility/chat/message-rendering-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0017`

validationCommandIds: `VC-0107`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-018-itc-0017-markdown-plain-text-rendering.md`

surface: `Renderer accessibility labels and keyboard-reachable long-message controls`

stateKind: `active`

reasonCode: `verified-source-accessibility`

decisionIds: `CHAT-MSR-001`

missingPrerequisites: `Manual keyboard traversal and VoiceOver review remain required before final accessibility closeout.`

currentState: `MessageContentView keeps block-rendered markdown and plain text selectable, exposes message text as an accessibility label, and provides Bottom/Top long-message controls with help and accessibility labels. Copy buttons expose Copied message and Copied thread from here feedback labels.`

notParityStatement: `This fixture does not claim manual VoiceOver completion, screenshot parity, html_native accessibility, or browser renderer parity.`

activationRequirement: `Manual accessibility packets must cite this source-backed state before final Demo 8 claims.`

releaseImpact: `Provides source-backed accessibility coverage for ITC-0017 rendering controls and copy feedback.`

determinism: `The source anchors are fixed help/accessibility labels in Swift source.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, account values, and runtime snapshots are excluded.`

redactionReview: `Accessibility labels must use fixed non-secret message content in manual evidence.`

failureHandling: `If renderer text, jump controls, or copy feedback lose labels, ITC-0017 accessibility evidence fails.`
