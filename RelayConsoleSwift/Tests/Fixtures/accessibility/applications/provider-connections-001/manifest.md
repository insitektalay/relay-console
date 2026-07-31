# Accessibility Fixture Manifest - Applications Provider Connections

id: `fix-accessibility-applications-provider-connections-001`

layer: `accessibility`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0008`, `ITC-0033`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

fixtureKind: `accessibility-source-scaffold`

owner: `applications-ui`

status: `planned`

secretsPolicy: `secret-references-only`

artifactClass: `accessibility-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `AppViewModel.swift`

files:

- `accessibility/applications/provider-connections-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0033`

validationCommandIds: `VC-0107`, `ITC-0008`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-034-itc-0033-provider-connections.md`

surface: `Provider connection actions, callback copy button, setup details disclosure, diagnostics copy, required scopes, and Keychain reference labels`

stateKind: `planned-accessibility-review`

reasonCode: `applications-provider-accessibility-scaffold`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

missingPrerequisites: `Manual keyboard traversal, VoiceOver/help-label review, rendered focus review, live OAuth activation, provider write execution, runtime tool grants, local apps, generated packs, and Paperclip remain later or excluded.`

currentState: `Source anchors include accessibility/help labels for provider authorization, reauthorize, disconnect, callback copy, and retained provider detail controls; manual observations are not yet claimed.`

notParityStatement: `This accessibility scaffold does not claim completed keyboard traversal, VoiceOver traversal, live OAuth completion, raw credential display, shared Relay-owned OAuth accounts, Paperclip, local app support, or release readiness.`

activationRequirement: `Complete manual keyboard and VoiceOver review after fixed provider fixture data is available.`

releaseImpact: `Tracks pending accessibility signoff for ITC-0033 without overstating source-backed UI evidence.`

determinism: `Future review must use fixed fixture records and redacted data.`

noFakeProductSeed: `No product-visible provider connection rows are seeded by this scaffold.`

noSimulatedRuntimeOutput: `No runtime output is used.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Manual review must exclude raw tokens, API keys, client secrets, bearer values, account values, local paths, source-host data, prompts, and raw workspace state.`

redactionReview: `Accessibility copy must expose token/key state as status only and never as raw secret values.`

failureHandling: `If controls lack labels, disabled states are color-only, raw secrets appear, Paperclip/local app controls are active, or private state is exposed, accessibility evidence remains blocked.`
