# Accessibility Fixture Manifest - AgentOps Entry Live State

id: `fix-accessibility-agentops-entry-live-state-001`

layer: `accessibility`

productArea: `agentops-entry-live-state`

requirementIds: `RCSPR-0018`, `ITC-0008`, `ITC-0027`

sourceMapIds: `SM-0018`, `SM-0150`, `SM-0151`, `SM-0158`

featureIds: `FI-0018`, `FI-0143`

gapOrDecisionIds: `ITC-0045`, `ITC-0053`

fixtureKind: `accessibility-source-scaffold`

owner: `agentops-ui`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `manual-evidence-scaffold`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `screen-contracts/agentops/hq.md`, `ITC-0027`

files:

- `accessibility/agentops/entry-live-state-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0027`

validationCommandIds: `VC-0107`, `ITC-0008`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-028-itc-0027-agentops-live-state-runtime-overview.md`

surface: `AgentOps HQ entry live-state screen keyboard and VoiceOver review`

stateKind: `planned-accessibility-review`

reasonCode: `agentops-entry-accessibility-scaffold`

decisionIds: `ITC-0045`

missingPrerequisites: `Keyboard traversal, VoiceOver traversal, focus order review, contrast review, and manual Demo 8 signoff remain later work.`

currentState: `Source exposes help and accessibility labels for AgentOps route, refresh, panel toggles, agent selection, live-state badges, and runtime overview guard marker. Manual traversal is not yet captured.`

notParityStatement: `This accessibility scaffold does not claim keyboard completion, VoiceOver completion, screenshot parity, final AgentOps visualization parity, or release signoff.`

activationRequirement: `Capture keyboard and VoiceOver notes before using this fixture as accessibility release proof.`

releaseImpact: `Provides ITC-0027 accessibility evidence planning while preserving manual review residuals.`

determinism: `The scaffold is source-only and does not rely on live data.`

noFakeProductSeed: `No product-visible records are seeded.`

noSimulatedRuntimeOutput: `No mock AgentOps events are included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompt text, account data, screenshots, and runtime logs are excluded.`

redactionReview: `Manual review must confirm runtime overview and event feed announce redacted summaries rather than raw operator text.`

failureHandling: `If keyboard traversal, VoiceOver labels, focus visibility, contrast, or redaction review fails, accessibility evidence fails until corrected.`
