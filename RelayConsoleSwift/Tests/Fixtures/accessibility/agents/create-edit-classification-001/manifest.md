# Accessibility Fixture Manifest - Agents Picker Create Classification

id: `fix-accessibility-agents-create-edit-classification-001`

layer: `accessibility`

productArea: `agents-picker-create-classification`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0079`, `RCSPR-0108`, `ITC-0008`, `ITC-0025`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`

gapOrDecisionIds: `AD-001`, `ITC-0045`, `ITC-0053`

fixtureKind: `source-backed-accessibility-contract`

owner: `agents-ui`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:59:43Z`

reviewer: `Codex`

reviewerRole: `Accessibility source evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `screen-contracts/agents/agents-overview-and-picker.md`, `screen-contracts/agents/create-agent.md`, `screen-contracts/agents/agent-category.md`, `ITC-0025`

files:

- `accessibility/agents/create-edit-classification-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0025`

validationCommandIds: `VC-0107`, `ITC-0008`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-026-itc-0025-agents-picker-detail-edit-create-classification-ui.md`

surface: `Agents picker, subview navigation, create form, classification board`

stateKind: `verified-source`

reasonCode: `agents-accessibility-source-backed`

decisionIds: `AD-001`

missingPrerequisites: `Manual keyboard traversal, VoiceOver traversal, focus screenshots, upload observation, and full Demo 8 accessibility review remain later work.`

currentState: `Source checks verify labelled picker open/close, subview rows with disabled labels, create controls, manager disabled reasons, Save labels, and guarded residual status copy.`

notParityStatement: `This fixture does not claim VoiceOver completion, keyboard traversal completion, rendered screenshot parity, real upload observation, or html_native support.`

activationRequirement: `Manual accessibility observations must be attached before release signoff claims.`

releaseImpact: `Documents ITC-0025 accessibility source coverage while keeping manual review residuals explicit.`

determinism: `Static source checks verify labels, help text, disabled reasons, and guarded residual copy.`

noFakeProductSeed: `No product-visible records, screenshots, avatars, org rows, provisioning jobs, departments, teams, or runtime identities are seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, images, credentials, prompts, runtime logs, and filesystem listings are excluded.`

redactionReview: `The fixture is source-only and contains no private accessibility recordings or personal data.`

failureHandling: `If controls lose labels/help text, manager disabled reasons, guarded residual copy, or service-backed Save paths, ITC-0025 accessibility source evidence fails.`
