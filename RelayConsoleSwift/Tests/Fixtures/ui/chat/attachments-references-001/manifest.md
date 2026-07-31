# UI Fixture Manifest - Chat Attachments References

id: `fix-ui-chat-attachments-references-001`

layer: `ui`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `source-backed-ui-evidence`

owner: `composer-ui`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `ui-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:05:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `AppViewModel.swift`, `screen-contracts/chat/composer-attachments-references.md`

files:

- `ui/chat/attachments-references-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0016`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-017-itc-0016-attachments-references.md`

surface: `Composer attachment buttons, chips, send state, and message metadata rows`

stateKind: `active`

reasonCode: `verified-source-ui`

decisionIds: `none`

missingPrerequisites: `Standard-window and minimum-window screenshots remain required before final Demo 8 visual closeout.`

currentState: `ComposerTextView exposes Attach files, Attach images or videos, Remove attachment, status chips, and attachment-enabled send state; MessageBubble renders attachment and document reference metadata rows.`

notParityStatement: `This source fixture does not claim screenshot parity, Paperclip link UI, or browser upload transport parity.`

activationRequirement: `Manual screenshot and accessibility packets must cite this source-backed state before final visual claims.`

releaseImpact: `Provides source-backed UI coverage for retained ITC-0016 attachment/reference behavior.`

determinism: `The source anchors are stable Swift view/type names and fixed visible/help labels.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, account values, local file bytes, and runtime snapshots are excluded.`

redactionReview: `UI renders filenames, MIME/type/size/status, and redacted document-reference indicators only.`

failureHandling: `If attach/remove controls or message metadata rows disappear, ITC-0016 UI evidence fails.`
