# UI Fixture Manifest - Applications Provider Connections

id: `fix-ui-applications-provider-connections-001`

layer: `ui`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0008`, `ITC-0033`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

fixtureKind: `source-backed-ui-contract`

owner: `applications-ui`

status: `verified-source`

secretsPolicy: `secret-references-only`

artifactClass: `source-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `UI source evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `ProviderConnectionService.swift`

files:

- `ui/applications/provider-connections-001/manifest.md`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0033`

validationCommandIds: `VC-0105`, `ITC-0008`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-034-itc-0033-provider-connections.md`

surface: `ApplicationsProviderConnectionPanel, setup details disclosure, manual token setup, required scopes, Keychain references, and provider action states`

stateKind: `verified-source`

reasonCode: `applications-provider-ui-service-backed`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

missingPrerequisites: `Rendered screenshot parity, keyboard traversal, VoiceOver traversal, live OAuth activation, runtime tool grants, local apps, generated packs, and Paperclip remain later or excluded.`

currentState: `Source checks verify X/LinkedIn connection copy, manual token setup, provider action states, required scopes, status labels, and Keychain reference copy.`

notParityStatement: `This source fixture does not claim live provider OAuth completion, raw secret reveal, shared Relay-owned OAuth accounts, Paperclip support, local app support, screenshot parity, or release readiness.`

activationRequirement: `Provider authorization buttons must remain unavailable until native OAuth activation and manual evidence are explicitly approved.`

releaseImpact: `Unblocks ITC-0033 source-backed UI evidence for retained provider connection state.`

determinism: `Static source tests scan deterministic Swift anchors and do not rely on live provider data.`

noFakeProductSeed: `No product-visible provider connection, install, local app, or Paperclip rows are seeded.`

noSimulatedRuntimeOutput: `No runtime output is used as UI input.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw tokens, API keys, client secrets, bearer values, account values, local paths, source-host metadata, screenshots, prompts, and raw workspace state are excluded.`

redactionReview: `UI copy exposes token/key status and Keychain reference summaries only.`

failureHandling: `If provider UI loses service-backed state, exposes raw secrets, activates live OAuth without evidence, shows Paperclip/local app controls, or claims screenshot/accessibility completion, ITC-0033 UI evidence fails.`
