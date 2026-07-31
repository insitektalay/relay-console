# Accessibility Fixture Manifest - Agents AgentOps Slice Signoff

id: `fix-accessibility-agents-agentops-signoff-001`

layer: `accessibility`

productArea: `agents-agentops-slice-signoff`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0031`, `RCSPR-0032`,
`RCSPR-0033`, `RCSPR-0034`, `RCSPR-0101`, `RCSPR-0108`, `RCSPR-0147`,
`RCSPR-0148`, `RCSPR-0168`, `RCSPR-0169`, `RCSPR-0170`, `RCSPR-0171`,
`RCSPR-0172`, `RCSPR-0173`, `RCSPR-0174`, `ITC-0028`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0047`, `SM-0048`, `SM-0049`,
`SM-0050`, `SM-0051`, `SM-0052`, `SM-0053`, `SM-0054`, `SM-0128`,
`SM-0130`, `SM-0138`, `SM-0141`, `SM-0154`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0035`, `FI-0036`, `FI-0037`,
`FI-0038`, `FI-0039`, `FI-0040`, `FI-0041`, `FI-0042`, `FI-0102`,
`FI-0138`, `FI-0139`, `FI-0158`, `FI-0159`, `FI-0160`, `FI-0161`,
`FI-0162`, `FI-0163`, `FI-0164`

gapOrDecisionIds: `ITC-0045`, `ITC-0053`

fixtureKind: `accessibility-source-signoff`

owner: `agents-ui`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `manual-evidence-scaffold`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`,
`RelayConsoleComponentBaselineTests`, `RelayConsoleVisualEvidenceTests`,
`ITC-0028`

files:

- `accessibility/agents/agents-agentops-signoff-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0021`, `ITC-0022`, `ITC-0023`, `ITC-0024`,
`ITC-0025`, `ITC-0026`, `ITC-0027`, `ITC-0028`, `CODE-001-029`

validationCommandIds: `VC-0107`, `ITC-0008`

demoIds: `Demo 3`, `Demo 7`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-029-itc-0028-agents-org-agentops-evidence-packet.md`

surface: `Agents and AgentOps keyboard, VoiceOver/help, contrast, focus, and disabled-state review`

stateKind: `planned-accessibility-review`

reasonCode: `agents-agentops-accessibility-signoff-pending`

decisionIds: `none`

missingPrerequisites: `Keyboard traversal, VoiceOver traversal, focus order review, contrast review, long-content review, and manual Demo 8 signoff remain required.`

currentState: `Source-backed labels, help text, badges, guarded states, disabled states, and empty states are covered by automated source tests; manual traversal is not yet claimed.`

notParityStatement: `This planned accessibility manifest is not keyboard completion, VoiceOver completion, screenshot proof, release readiness, or manual Demo 8 completion.`

activationRequirement: `Reviewer must attach redacted keyboard and VoiceOver observations before this manifest can become verified accessibility evidence.`

releaseImpact: `Keeps Slice 5 accessibility residuals explicit while allowing automated/source-backed evidence aggregation to close honestly.`

determinism: `The placeholder uses fixed ids and contains no environment-specific values.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output or mock AgentOps event stream is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, screenshots, prompts, runtime logs, and auth/session data are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future observations must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified accessibility proof, ITC-0028 closeout must be downgraded to partial-proof.`
