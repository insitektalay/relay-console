# Accessibility Fixture Manifest - Chat Attachments References

id: `fix-accessibility-chat-attachments-references-001`

layer: `accessibility`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `source-backed-accessibility-evidence`

owner: `composer-ui`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:05:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`, `screen-contracts/chat/composer-attachments-references.md`

files:

- `accessibility/chat/attachments-references-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0016`

validationCommandIds: `VC-0107`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-017-itc-0016-attachments-references.md`

surface: `Attachment and reference accessibility labels`

stateKind: `active`

reasonCode: `verified-source-accessibility`

decisionIds: `none`

missingPrerequisites: `Manual keyboard traversal and VoiceOver review remain required before final accessibility closeout.`

currentState: `Attach files, Attach images or videos, Remove attachment, attachment rows, and document reference rows expose help/accessibility labels and combined row labels.`

notParityStatement: `This fixture does not claim manual VoiceOver completion, screenshot parity, Paperclip accessibility, or browser upload transport parity.`

activationRequirement: `Manual accessibility packets must cite this source-backed state before final Demo 8 claims.`

releaseImpact: `Provides source-backed accessibility coverage for ITC-0016 controls and rows.`

determinism: `The source anchors are fixed help/accessibility labels in Swift source.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, account values, local file bytes, and runtime snapshots are excluded.`

redactionReview: `Accessibility labels include filenames/statuses and redacted reference states only.`

failureHandling: `If attach/remove controls lose help or accessibility labels, ITC-0016 accessibility evidence fails.`
