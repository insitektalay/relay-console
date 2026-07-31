# Accessibility Fixture Manifest - Runtime Applications Slice Signoff

id: `fix-accessibility-applications-runtime-applications-keyboard-001`

layer: `accessibility`

productArea: `runtime-applications-slice-signoff`

requirementIds: `RCSPR-0005`, `RCSPR-0006`, `RCSPR-0095`,
`RCSPR-0109`, `RCSPR-0124`, `RCSPR-0126`, `RCSPR-0135`,
`RCSPR-0175`, `RCSPR-0176`, `RCSPR-0177`, `RCSPR-0178`,
`RCSPR-0179`, `RCSPR-0180`, `RCSPR-0181`, `RCSPR-0182`,
`RCSPR-0183`, `ITC-0008`, `ITC-0037`

sourceMapIds: `SM-0055`, `SM-0056`, `SM-0057`, `SM-0058`,
`SM-0059`, `SM-0060`, `SM-0138`, `SM-0139`, `SM-0153`,
`SM-0154`, `SM-0155`, `SM-0159`

featureIds: `FI-0041`, `FI-0042`, `FI-0043`, `FI-0044`,
`FI-0045`, `FI-0046`, `FI-0047`, `FI-0048`, `FI-0049`,
`FI-0050`, `FI-0051`, `FI-0052`, `FI-0053`, `FI-0054`,
`FI-0055`, `FI-0056`, `FI-0102`, `FI-0138`, `FI-0139`,
`FI-0165`, `FI-0166`, `FI-0167`, `FI-0168`, `FI-0169`,
`FI-0170`, `FI-0171`, `FI-0172`, `FI-0173`

gapOrDecisionIds: `ITC-0035-excluded`, `ITC-0043`, `ITC-0045`,
`ITC-0046`, `ITC-0054`, `PAPERCLIP-EXCLUDED-001`

fixtureKind: `accessibility-source-signoff`

owner: `runtime-applications-ui`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `manual-evidence-scaffold`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `AppViewModel.swift`,
`RelayConsoleComponentBaselineTests`, `RelayConsoleVisualEvidenceTests`,
`ITC-0037`

files:

- `accessibility/applications/runtime-applications-keyboard-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0029`, `ITC-0030`, `ITC-0031`,
`ITC-0032`, `ITC-0033`, `ITC-0034`, `ITC-0036`, `ITC-0037`,
`CODE-001-037`

validationCommandIds: `VC-0107`, `VC-0108`, `ITC-0008`

demoIds: `Demo 4`, `Demo 5`, `Demo 7`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-037-itc-0037-runtime-applications-evidence-packet.md`

surface: `Runtime dashboard and Applications keyboard, VoiceOver/help, focus, disabled-state, and non-color cue review`

stateKind: `planned-accessibility-review`

reasonCode: `runtime-applications-accessibility-signoff-pending`

decisionIds: `ITC-0035 remains excluded historical source evidence; Paperclip remains excluded historical source evidence.`

missingPrerequisites: `Manual keyboard traversal, VoiceOver traversal, focus order review, disabled-reason review, long-content review, Demo 4 reviewer observations, Demo 7 relaunch observations, and Demo 8 accessibility review remain required. Live OAuth completion, provider API execution, install writes, automatic tool grants, command execution, local file access, local app/source-host/generated-pack workflows, and Paperclip mutation remain unavailable or excluded.`

currentState: `Source-backed labels, help text, badges, guarded states, disabled states, empty states, and table/list copy are covered by automated source tests for retained runtime and Applications surfaces; manual traversal is not yet claimed.`

notParityStatement: `This planned accessibility manifest is not keyboard completion, VoiceOver completion, screenshot proof, real OAuth/install proof, release readiness, local app/source-host/generated-pack parity, or Paperclip proof.`

activationRequirement: `Reviewer must attach redacted keyboard and VoiceOver observations for retained runtime and Applications states before this manifest can become verified accessibility evidence.`

releaseImpact: `Keeps Slice 6/7 accessibility residuals explicit while allowing source-backed ITC-0037 aggregation to close honestly.`

determinism: `The placeholder uses fixed ids, branch references, dependency card ids, and exclusion statements without environment-specific values.`

noFakeProductSeed: `No product-visible runtime, provider, install, tool, local app, generated pack, or Paperclip rows are seeded.`

noSimulatedRuntimeOutput: `No runtime output, provider callback, install result, command output, or generated pack content is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, provider tokens, screenshots, prompts, runtime logs, auth/session data, source-host data, and local filesystem roots are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future keyboard and VoiceOver observations must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified keyboard or VoiceOver proof, or includes excluded local app/source-host/generated-pack/Paperclip scope, ITC-0037 closeout must be downgraded to partial-proof or no-go.`
