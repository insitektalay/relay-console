# Visual Fixture Manifest - Agents Picker Create Classification

id: `fix-visual-agents-create-edit-classification-001`

layer: `visual`

productArea: `agents-picker-create-classification`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0079`, `RCSPR-0108`, `ITC-0008`, `ITC-0025`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`

gapOrDecisionIds: `AD-001`, `ITC-0045`, `ITC-0053`

fixtureKind: `source-backed-visual-contract`

owner: `agents-ui`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:59:43Z`

reviewer: `Codex`

reviewerRole: `Visual source evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `screen-contracts/agents/agents-overview-and-picker.md`, `ITC-0025`

files:

- `visual/agents/create-edit-classification-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0025`

validationCommandIds: `VC-0106`, `ITC-0008`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-026-itc-0025-agents-picker-detail-edit-create-classification-ui.md`

surface: `Agents grouped picker, selected summary, subview rows, guarded residual panels, and classification board`

stateKind: `verified-source`

reasonCode: `agents-visual-source-backed`

decisionIds: `AD-001`

missingPrerequisites: `Standard/minimum-window screenshots, hover/focus captures, no-match screenshots, create-progress screenshots, and manual Demo 8 review remain later work.`

currentState: `Source checks verify stable rows, icons, status badges, grouped popover, no-match state, guarded panels, and no synthetic calendar/task rows.`

notParityStatement: `This fixture does not claim rendered screenshot parity, VoiceOver completion, native file tree/editor parity, Work Calendar parity, Schedule Tasks parity, or real upload observation.`

activationRequirement: `Screenshot artifacts and manual visual review must be attached before release signoff claims.`

releaseImpact: `Documents ITC-0025 visual source coverage while keeping screenshot residuals explicit.`

determinism: `RelayConsoleVisualEvidenceTests scans deterministic Swift source anchors for visible controls and guarded residual copy.`

noFakeProductSeed: `No product-visible records, screenshots, avatars, org rows, provisioning jobs, departments, teams, or runtime identities are seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, images, prompts, credentials, runtime logs, and filesystem listings are excluded.`

redactionReview: `The fixture is source-only and contains no private visual artifacts.`

failureHandling: `If grouped picker, no-match state, guarded panels, or manager warning copy disappear from Swift source, ITC-0025 visual source evidence fails.`
