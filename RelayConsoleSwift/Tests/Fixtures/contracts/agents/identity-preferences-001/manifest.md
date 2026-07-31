# Contract Fixture Manifest - Agent Identity Preferences

id: `fix-contracts-agents-identity-preferences-001`

layer: `contract`

productArea: `agents-preferences`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0079`, `RCSPR-0108`, `RCSPR-0151`, `RCSPR-0169`, `RCSPR-0170`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`, `FI-0159`, `FI-0160`

gapOrDecisionIds: `AD-001`

fixtureKind: `agent-preferences-contract`

owner: `contracts`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `contract-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:34:39Z`

reviewer: `Codex`

reviewerRole: `contract evidence`

sourceBaseline: `Models.swift`, `ModelContractTests.swift`, `screen-contracts/agents/agent-detail.md`, `ITC-0022`

files:

- `contracts/agents/identity-preferences-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0022`

validationCommandIds: `VC-0101`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-023-itc-0022-agent-identity-preferences-response-presentation.md`

surface: `AgentPreferences and AgentAvatarState Codable contracts`

stateKind: `verified-contract`

reasonCode: `agent-identity-preferences-contract`

decisionIds: `AD-001`

missingPrerequisites: `Visual screenshots, VoiceOver traversal, real provisioning jobs, and full Agents edit parity remain later evidence.`

currentState: `Model contracts round-trip AgentPreferences with cosmetic display name, avatar state/reference, markdown/plain response presentation, and redacted metadata. AgentAvatarState raw values remain fallback, illustrated, uploaded, and no_avatar.`

notParityStatement: `This fixture does not claim html_native response presentation, runtime identity mutation, avatar upload file handling, or visual parity.`

activationRequirement: `Service and UI fixtures must consume this contract before claiming durable preferences.`

releaseImpact: `Provides ITC-0022 contract coverage for preference shape and excluded html_native scope.`

determinism: `The fixture uses fixed synthetic ids, sorted Codable round trips, and redacted metadata.`

noFakeProductSeed: `Contract samples do not seed product-visible agents, avatars, display names, or runtime identities.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, raw image bytes, credentials, prompts, and real person or organization names are excluded.`

redactionReview: `Metadata uses [REDACTED] markers and synthetic ids only.`

failureHandling: `If AgentPreferences drifts, AgentAvatarState raw values change, or html_native becomes supported without reinstatement, ITC-0022 contract evidence fails.`
