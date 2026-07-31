# UI Fixture Manifest - Agent Identity Preferences

id: `fix-ui-agents-identity-preferences-001`

layer: `ui`

productArea: `agents-preferences`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0079`, `RCSPR-0108`, `RCSPR-0151`, `RCSPR-0169`, `RCSPR-0170`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`, `FI-0159`, `FI-0160`

gapOrDecisionIds: `AD-001`

fixtureKind: `source-backed-ui-contract`

owner: `agents-ui`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:34:39Z`

reviewer: `Codex`

reviewerRole: `UI source evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `AppViewModel.swift`, `screen-contracts/agents/agent-detail.md`, `screen-contracts/agents/create-agent.md`, `ITC-0022`

files:

- `ui/agents/identity-preferences-001/manifest.md`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`

expectedChecks:

- `VC-0105`
- `swift run RelayConsoleComponentBaselineTests`

implementationTaskIds: `ITC-0022`

validationCommandIds: `VC-0105`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-023-itc-0022-agent-identity-preferences-response-presentation.md`

surface: `Agent edit/create identity preference controls`

stateKind: `verified-source`

reasonCode: `agent-preferences-source-backed`

decisionIds: `AD-001`

missingPrerequisites: `Standard/minimum-window screenshots, VoiceOver traversal, manual avatar upload observation, and full Agents visual parity remain later work.`

currentState: `Source checks verify edit/create controls save display name, avatar, and no-avatar through durable preference services; response presentation is not exposed in the UI and new agents use Markdown by default.`

notParityStatement: `This source fixture does not claim screenshot parity, VoiceOver completion, real upload observation, provisioning job UI parity, or html_native response presentation support.`

activationRequirement: `Visual and accessibility packets must add screenshots and manual observations before release signoff claims.`

releaseImpact: `Unblocks ITC-0022 source-backed UI proof while leaving visual/accessibility residuals explicit.`

determinism: `The component baseline test scans static Swift source for durable service calls and excluded options.`

noFakeProductSeed: `No product-visible records, screenshots, avatars, org rows, provisioning jobs, or runtime identities are seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, real images, credentials, prompts, and runtime logs are excluded.`

redactionReview: `The fixture contains source references only and no private avatar/image data.`

failureHandling: `If controls reintroduce response presentation options, bypass durable preference services, expose editable runtime identity, or write response presentation into runtime config, ITC-0022 UI evidence fails.`
