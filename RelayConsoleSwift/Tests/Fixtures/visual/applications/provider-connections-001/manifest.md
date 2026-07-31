# Visual Fixture Manifest - Applications Provider Connections

id: `fix-visual-applications-provider-connections-001`

layer: `visual`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0008`, `ITC-0033`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

fixtureKind: `visual-source-scaffold`

owner: `applications-ui`

status: `planned`

secretsPolicy: `secret-references-only`

artifactClass: `visual-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `ProviderConnectionService.swift`

files:

- `visual/applications/provider-connections-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0033`

validationCommandIds: `VC-0106`, `ITC-0008`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-034-itc-0033-provider-connections.md`

surface: `Provider connection card, diagnostics copy, setup details disclosure, callback copy, required scopes, and disabled action row`

stateKind: `planned-visual-review`

reasonCode: `applications-provider-visual-scaffold`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

missingPrerequisites: `Rendered screenshot capture, keyboard traversal, VoiceOver traversal, live OAuth activation, provider write execution, runtime tool grants, local apps, generated packs, and Paperclip remain later or excluded.`

currentState: `Source anchors are verified; manual screenshot observations are not yet claimed.`

notParityStatement: `This visual scaffold does not claim screenshot parity, live OAuth completion, raw credential display, shared Relay-owned OAuth accounts, Paperclip, local app support, or release readiness.`

activationRequirement: `Capture standard and minimum window screenshots after fixed provider fixture data exists, then review wrapping, disabled actions, diagnostics, and redacted status labels.`

releaseImpact: `Tracks pending visual signoff for ITC-0033 without overstating source-backed UI evidence.`

determinism: `Planned screenshots must use fixed fixture records, fixed window sizes, and redacted data.`

noFakeProductSeed: `No product-visible provider connection rows are seeded by this scaffold.`

noSimulatedRuntimeOutput: `No runtime output is used.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Screenshots must exclude raw tokens, API keys, client secrets, bearer values, account values, local paths, source-host data, prompts, and raw workspace state.`

redactionReview: `Future screenshot review must confirm token/key/callback state is redacted and secret-reference-only.`

failureHandling: `If screenshots show raw secrets, active unsupported OAuth writes, Paperclip/local app controls, private state, or layout overlap, visual evidence remains blocked.`
