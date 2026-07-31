# UI Fixture Manifest - Agents Picker Create Classification

id: `fix-ui-agents-create-edit-classification-001`

layer: `ui`

productArea: `agents-picker-create-classification`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0031`, `RCSPR-0034`, `RCSPR-0079`, `RCSPR-0108`, `RCSPR-0151`, `RCSPR-0169`, `RCSPR-0170`, `ITC-0008`, `ITC-0024`, `ITC-0025`, `ITC-0026`, `ITC-0027`, `CODE-002-001`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`, `FI-0159`, `FI-0160`

gapOrDecisionIds: `AD-001`, `ITC-0045`, `ITC-0053`

fixtureKind: `source-backed-ui-contract`

owner: `agents-ui`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:59:43Z`

reviewer: `Codex`

reviewerRole: `UI source evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `AgentOrganizationService.swift`, `screen-contracts/agents/agents-overview-and-picker.md`, `screen-contracts/agents/create-agent.md`, `screen-contracts/agents/agent-category.md`, `screen-contracts/agents/agent-structure.md`, `ITC-0024`, `ITC-0025`, `ITC-0026`, `ITC-0027`, `CODE-002-001`

files:

- `ui/agents/create-edit-classification-001/manifest.md`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0024`, `ITC-0025`, `ITC-0026`, `ITC-0027`, `CODE-002-001`

validationCommandIds: `VC-0105`, `ITC-0008`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-026-itc-0025-agents-picker-detail-edit-create-classification-ui.md`
`loop-runs/002-release-blocker-remediation-and-screen-contract-revalidation/reports/CODE-002-001-agent-structure-filter-quick-create-repair.md`

surface: `Agents picker, detail, create, classification controls, and Org Structure filter/quick-create controls`

stateKind: `verified-source`

reasonCode: `agents-ui-service-backed`

decisionIds: `AD-001`

missingPrerequisites: `Standard/minimum-window screenshots, VoiceOver traversal, real avatar upload observation, native file tree/editor, rendered Org Structure quick-create review, Work Calendar service, Schedule Tasks service, and manual Demo 3/Demo 8 signoff remain later work.`

currentState: `Source checks verify grouped picker/search, selected-agent subview navigation, dynamic organization pickers, Org Structure Business/Family/Personal filter selectors, Create organization/Create department/Create team cards, duplicate runtime identity blocking, manager disabled reasons, explicit manager replacement confirmation, and classification/structure saves through AgentOrganizationService-backed AppViewModel paths.`

notParityStatement: `This source fixture does not claim screenshot parity, VoiceOver completion, native workspace file tree/editor parity, rendered Org Structure visual parity, calendar/task data parity, real upload observation, or html_native response presentation support.`

activationRequirement: `Visual and accessibility packets must add screenshots and manual observations before release signoff claims.`

releaseImpact: `Unblocks ITC-0025/CODE-002-001 source-backed UI proof while leaving visual/accessibility and future service residuals explicit.`

determinism: `The component and visual tests scan static Swift source for grouped picker, guarded subviews, Org Structure contextual selectors, organization-backed quick-create controls, and excluded response presentation options.`

noFakeProductSeed: `No product-visible records, screenshots, avatars, org rows, provisioning jobs, family labels, departments, teams, or runtime identities are seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, real images, credentials, prompts, runtime logs, and local filesystem listings are excluded.`

redactionReview: `The fixture contains source references only and no private avatar/image data.`

failureHandling: `If controls bypass AgentOrganizationService, reintroduce html_native, submit unsupported manager state, invent organization labels, or remove guarded residual copy, ITC-0025 UI evidence fails.`
