# Visual Fixture Manifest - Chat Slice Signoff

id: `fix-visual-chat-signoff-001`

layer: `visual`

productArea: `chat`

requirementIds: `RCSPR-0003`, `RCSPR-0023`, `RCSPR-0024`, `RCSPR-0025`,
`RCSPR-0026`, `RCSPR-0028`, `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0093`,
`RCSPR-0107`, `RCSPR-0167`

sourceMapIds: `SM-0037`, `SM-0038`, `SM-0042`, `SM-0077`, `SM-0112`,
`SM-0115`, `SM-0133`, `SM-0154`, `SM-0157`

featureIds: `FI-0031`, `FI-0079`, `FI-0137`, `FI-0156`, `FI-0157`,
`FI-0308`, `FI-0321`, `FI-0322`

gapOrDecisionIds: `G-0008`, `G-0010`, `G-0011`, `G-0012`, `G-0013`,
`G-0014`, `G-0033`, `G-0172`

fixtureKind: `source-backed-visual-signoff`

owner: `chat-ui`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `visual-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:05:57Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`,
`MessageRendering.swift`, `RuntimeDispatchState.swift`,
`RuntimeEventReplay.swift`, `thread-list-and-detail.md`,
`message-stream-and-rendering.md`, `composer-attachments-references.md`,
`runtime-dispatch-chat-cards.md`

files:

- `visual/chat/chat-signoff-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0020`, `CODE-001-021`

validationCommandIds: `VC-0106`, `VC-0108`

demoIds: `Demo 2`, `Demo 7`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-021-itc-0020-chat-ui-visual-accessibility-demo-evidence.md`

surface: `Chat slice visual signoff source aggregation`

stateKind: `verified-source-visual`

reasonCode: `chat-slice-source-signoff`

decisionIds: `none`

missingPrerequisites: `Standard-window and minimum-window screenshots remain planned manual evidence before release visual closeout.`

currentState: `Source-backed manifests cover thread list/detail, composer, attachments, references, markdown/plain text rendering, failed local sends, runtime retry/cancel cards, and replay reconciliation without activating Paperclip or HTML-native scope.`

notParityStatement: `This source-backed visual signoff is not screenshot parity, real runtime transcript proof, manual VoiceOver proof, or release readiness. Paperclip and HTML-native evidence remain excluded unless reinstated.`

activationRequirement: `A reviewer must capture redacted standard and minimum-window screenshots before final Demo 8 visual release claims.`

releaseImpact: `Completes ITC-0020 automated/source-backed visual aggregation while preserving manual screenshot residuals.`

determinism: `The consuming test checks fixed manifest links, source anchors, demo ids, report ids, and exclusion statements.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, prompts, screenshots, and runtime snapshots are excluded.`

redactionReview: `Manifest contains no secrets and is covered by scoped fixture/evidence redaction scans.`

failureHandling: `If source-backed visual anchors, exclusions, demo links, or screenshot residual statements are removed, ITC-0020 evidence must be downgraded.`
