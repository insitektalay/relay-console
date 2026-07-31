# Service Fixture Manifest - Agent Identity Preferences

id: `fix-services-agents-identity-preferences-001`

layer: `service`

productArea: `agents-preferences`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0079`, `RCSPR-0108`, `RCSPR-0151`, `RCSPR-0169`, `RCSPR-0170`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`, `FI-0159`, `FI-0160`

gapOrDecisionIds: `AD-001`

fixtureKind: `agent-preferences-service`

owner: `agents-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:34:39Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `LocalDataService.swift`, `AppViewModel.swift`, `ServiceTests.swift`, `screen-contracts/agents/agent-detail.md`, `ITC-0022`

files:

- `services/agents/identity-preferences-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0022`

validationCommandIds: `VC-0102`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-023-itc-0022-agent-identity-preferences-response-presentation.md`

surface: `Agent preference service persistence`

stateKind: `verified-service`

reasonCode: `agent-preferences-durable`

decisionIds: `AD-001`

missingPrerequisites: `Manual avatar upload observation, screenshots, VoiceOver review, provisioning jobs, and manager authority remain later work.`

currentState: `Service tests save cosmetic display name, uploaded avatar reference, no-avatar state, and plain-text response presentation; reopen the same store; and verify agent name, external id, and Hermes profile slug are unchanged.`

notParityStatement: `This fixture does not claim real avatar upload UI execution, runtime provisioning, or html_native response presentation.`

activationRequirement: `UI and visual evidence must cite this service proof before claiming user-facing agent preference editing.`

releaseImpact: `Provides ITC-0022 service proof for durable preferences and runtime identity separation.`

determinism: `The test uses a temporary local store, fixed synthetic ids/values, and no network or runtime process.`

noFakeProductSeed: `The fixture creates only temporary test records and does not seed product-visible agents, avatars, display names, org rows, or provisioning success.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, real uploaded image bytes, credentials, and runtime logs are excluded.`

redactionReview: `Uploaded avatar evidence uses a tiny synthetic data URL and no personal image data.`

failureHandling: `If preferences do not survive relaunch or mutate runtime identity fields, ITC-0022 service evidence fails.`
