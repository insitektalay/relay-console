# UI Fixture Manifest - Chat Message Rendering

id: `fix-ui-chat-message-rendering-001`

layer: `ui`

productArea: `chat`

requirementIds: `RCSPR-0025`, `RCSPR-0079`, `RCSPR-0114`, `RCSPR-0116`, `RCSPR-0152`, `RCSPR-0163`

sourceMapIds: `SM-0035`, `SM-0122`, `SM-0123`, `SM-0130`, `SM-0155`, `SM-0157`

featureIds: `FI-0030`, `FI-0088`, `FI-0114`, `FI-0143`, `FI-0154`

gapOrDecisionIds: `CHAT-MSR-001`

fixtureKind: `source-backed-ui-evidence`

owner: `message-renderer`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `ui-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:45:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `MessageRendering.swift`, `screen-contracts/chat/message-stream-and-rendering.md`

files:

- `ui/chat/message-rendering-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0017`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-018-itc-0017-markdown-plain-text-rendering.md`

surface: `MessageContentView markdown/plain-text rendering`

stateKind: `active`

reasonCode: `verified-source-ui`

decisionIds: `CHAT-MSR-001`

missingPrerequisites: `Standard-window and minimum-window screenshots remain required before final Demo 8 visual closeout.`

currentState: `MessageContentView consumes MessageRenderer.plan and MessageRenderer.blocks, renders retained markdown with block-aware paragraph/list/code/quote layout plus Foundation AttributedString inline parsing, falls back to plain text for excluded HTML-native content, shows long-message Bottom/Top controls, and exposes copy feedback labels.`

notParityStatement: `This source fixture does not claim html_native rendering, sanitizer/scoped renderer work, CSS allowlists, constrained web renderers, or HTML fallback pipelines.`

activationRequirement: `Manual screenshot and accessibility packets must cite this source-backed state before final visual claims.`

releaseImpact: `Provides source-backed UI coverage for retained ITC-0017 renderer behavior.`

determinism: `The source anchors are stable Swift view/type names and fixed visible/help labels.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, account values, and runtime snapshots are excluded.`

redactionReview: `UI source renders retained text and metadata only; screenshots must exclude private content.`

failureHandling: `If MessageContentView, markdown parsing, long-message controls, or copy feedback disappear, ITC-0017 UI evidence fails.`
