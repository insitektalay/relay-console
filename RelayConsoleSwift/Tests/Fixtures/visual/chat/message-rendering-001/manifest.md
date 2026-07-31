# Visual Fixture Manifest - Chat Message Rendering

id: `fix-visual-chat-message-rendering-001`

layer: `visual`

productArea: `chat`

requirementIds: `RCSPR-0025`, `RCSPR-0079`, `RCSPR-0114`, `RCSPR-0116`, `RCSPR-0152`, `RCSPR-0163`

sourceMapIds: `SM-0035`, `SM-0122`, `SM-0123`, `SM-0130`, `SM-0155`, `SM-0157`

featureIds: `FI-0030`, `FI-0088`, `FI-0114`, `FI-0143`, `FI-0154`

gapOrDecisionIds: `CHAT-MSR-001`

fixtureKind: `source-backed-visual-state-evidence`

owner: `message-renderer`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `visual-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:45:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `MessageRendering.swift`

files:

- `visual/chat/message-rendering-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0017`

validationCommandIds: `VC-0106`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-018-itc-0017-markdown-plain-text-rendering.md`

surface: `Markdown/plain text, long message, and copy feedback visual states`

stateKind: `active`

reasonCode: `verified-source-visual`

decisionIds: `CHAT-MSR-001`

missingPrerequisites: `Standard-window and minimum-window screenshots remain required before visual closeout.`

currentState: `MessageContentView provides source-backed visual states for block-aware retained markdown, plain text, long-message bounded scrolling, Bottom/Top controls, and copied message/thread feedback.`

notParityStatement: `This fixture does not claim screenshot parity, runtime transcript proof, html_native rendering, sanitizer/scoped renderer work, or HTML fallback pipelines.`

activationRequirement: `Visual screenshot packets must cite this source-backed state fixture before final Demo 8 claims.`

releaseImpact: `Provides source-backed visual state coverage for ITC-0017 while preserving screenshot residuals.`

determinism: `The source anchors are stable Swift view/type names and fixed visible state labels.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, account values, and runtime snapshots are excluded.`

redactionReview: `Visual evidence must use fixed non-secret message content and no private paths.`

failureHandling: `If renderer source anchors or long/copy visual states disappear, ITC-0017 visual evidence fails.`
