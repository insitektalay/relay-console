# Accessibility Fixture Manifest - Chat Slice Signoff

id: `fix-accessibility-chat-signoff-001`

layer: `accessibility`

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

fixtureKind: `source-backed-accessibility-signoff`

owner: `accessibility`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:05:57Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`,
`thread-list-and-detail.md`, `message-stream-and-rendering.md`,
`composer-attachments-references.md`, `runtime-dispatch-chat-cards.md`

files:

- `accessibility/chat/chat-signoff-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0020`, `CODE-001-021`

validationCommandIds: `VC-0107`, `VC-0108`

demoIds: `Demo 2`, `Demo 7`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-021-itc-0020-chat-ui-visual-accessibility-demo-evidence.md`

surface: `Chat slice accessibility signoff source aggregation`

stateKind: `verified-source-accessibility`

reasonCode: `chat-slice-accessibility-source-signoff`

decisionIds: `none`

missingPrerequisites: `Manual keyboard traversal and VoiceOver review remain planned before release accessibility closeout.`

currentState: `Source-backed tests verify visible help/accessibility anchors for send, cancel, retry, copy, attachment, reference, guarded shell, composer, and long-message controls without activating Paperclip or HTML-native scope.`

notParityStatement: `This accessibility signoff is not a manual VoiceOver transcript, screenshot review, real runtime proof, or release readiness claim. Paperclip and HTML-native evidence remain excluded unless reinstated.`

activationRequirement: `A reviewer must capture focus order and VoiceOver/help label observations before final Demo 8 accessibility release claims.`

releaseImpact: `Completes ITC-0020 automated/source-backed accessibility aggregation while preserving manual review residuals.`

determinism: `The consuming test checks fixed manifest links, source strings, demo ids, report ids, and exclusion statements.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, prompts, screenshots, and runtime snapshots are excluded.`

redactionReview: `Manifest contains no secrets and is covered by scoped fixture/evidence redaction scans.`

failureHandling: `If source-backed accessibility anchors, exclusions, demo links, or manual residual statements are removed, ITC-0020 evidence must be downgraded.`
