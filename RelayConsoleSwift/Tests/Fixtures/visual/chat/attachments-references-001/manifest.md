# Visual Fixture Manifest - Chat Attachments References

id: `fix-visual-chat-attachments-references-001`

layer: `visual`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `source-backed-visual-state-evidence`

owner: `composer-ui`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `visual-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:05:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `AppViewModel.swift`

files:

- `visual/chat/attachments-references-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0016`

validationCommandIds: `VC-0106`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-017-itc-0016-attachments-references.md`

surface: `Attachment chips and message attachment/reference rows`

stateKind: `active`

reasonCode: `verified-source-visual`

decisionIds: `none`

missingPrerequisites: `Standard-window and minimum-window screenshots remain required before visual closeout.`

currentState: `ComposerAttachmentChip and MessageMetadataStack provide source-backed visual states for uploaded, failed, cancelled, sensitive, and redacted attachment/reference display.`

notParityStatement: `This fixture does not claim screenshot parity, runtime transcript proof, Paperclip visuals, or full renderer parity.`

activationRequirement: `Visual screenshot packets must cite this source-backed state fixture before final Demo 8 claims.`

releaseImpact: `Provides source-backed visual state coverage for ITC-0016 while preserving screenshot residuals.`

determinism: `The source anchors are stable Swift view/type names and fixed visible state labels.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, account values, local file bytes, and runtime snapshots are excluded.`

redactionReview: `Visual rows use redacted sensitive-reference copy and omit raw local paths.`

failureHandling: `If attachment chip or reference row source anchors disappear, ITC-0016 visual evidence fails.`
