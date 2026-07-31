# UI Fixture Manifest - Chat Composer Keyboard

id: `fix-ui-chat-composer-keyboard-001`

layer: `ui`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `source-backed-ui-flow-evidence`

owner: `composer-ui`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `automated-source-fixture`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:20:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `AppViewModel.swift`, `screen-contracts/chat/composer-attachments-references.md`

files:

- `ui/chat/composer-keyboard-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0015`

validationCommandIds: `VC-0105`

demoIds: `Demo 2`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-016-itc-0015-composer-drafts-send-failure-mentions.md`

surface: `Chat composer keyboard submit and disabled states`

stateKind: `active`

reasonCode: `verified-source-ui`

decisionIds: `none`

missingPrerequisites: `Screenshot automation and manual keyboard review remain evidence residuals before Demo 2/Demo 8 closeout.`

currentState: `ComposerTextView binds to AppViewModel draft state, SubmitTextView submits on Return, Shift+Return remains editable text entry, and send controls expose disabled reasons for busy, active dispatch, uploading, no-agent, and read-only states.`

notParityStatement: `This fixture is source-backed UI evidence only; it is not full visual parity or manual accessibility proof.`

activationRequirement: `Branch-local screenshots/manual review must cite this fixture before user-facing Demo closeout.`

releaseImpact: `Supports ITC-0015 keyboard behavior proof while preserving visual/manual residuals.`

determinism: `The source checks look for stable Swift type names and help/keyboard anchors.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private account values, paths, credentials, and runtime snapshots are excluded.`

redactionReview: `Fixture text contains only source filenames and fixed ids.`

failureHandling: `If keyboard submit hooks or disabled reason-backed help disappear, ITC-0015 UI evidence fails.`
