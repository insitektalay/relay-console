# Accessibility Fixture Manifest - AgentOps Native Visual Scene

id: `fix-accessibility-agentops-native-visual-scene-001`

layer: `accessibility`

productArea: `agentops-native-visual-scene`

requirementIds: `RCSPR-0004`, `RCSPR-0033`, `RCSPR-0080`, `RCSPR-0094`, `RCSPR-0098`, `RCSPR-0108`, `RCSPR-0111`, `RCSPR-0125`, `RCSPR-0134`, `RCSPR-0199`, `ITC-0008`, `ITC-0052`

sourceMapIds: `SM-0049`, `SM-0050`, `SM-0051`, `SM-0052`, `SM-0053`, `SM-0127`, `SM-0130`, `SM-0135`, `SM-0143`, `SM-0145`, `SM-0148`, `SM-0150`, `SM-0151`, `SM-0158`, `SM-0161`

featureIds: `FI-0040`, `FI-0090`, `FI-0098`, `FI-0118`, `FI-0125`, `FI-0189`

gapOrDecisionIds: `D-0005`, `EP-0002`

fixtureKind: `accessibility-source-scaffold`

owner: `agentops-accessibility`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `manual-evidence-scaffold`

branch: `codex/itc-0052-agentops-native-visual`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `screen-contracts/agentops/hq.md`, `ITC-0052`

files:

- `accessibility/agentops/native-visual-scene-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0052`, `CODE-001-051`

validationCommandIds: `VC-0107`, `ITC-0008`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0052-agentops-native-visual/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-051-itc-0052-agentops-native-visual-scene.md`

surface: `AgentOps native visual scene keyboard and VoiceOver review`

stateKind: `planned-accessibility-review`

reasonCode: `agentops-native-scene-a11y-pending`

decisionIds: `D-0005`

missingPrerequisites: `Manual keyboard traversal, VoiceOver traversal, selected-node focus order, minimum-window reachability, and contrast review remain required.`

currentState: `Source exposes accessibility labels for AgentOps native visual scene, room nodes, agent nodes, path overlay, live-state banner, refresh, panel toggles, bounds, paths, and editable layout controls.`

notParityStatement: `This accessibility scaffold does not claim completed keyboard traversal, completed VoiceOver review, screenshot parity, final asset parity, or release signoff.`

activationRequirement: `Manual accessibility evidence must be captured before this surface can count as release accessibility proof.`

releaseImpact: `Provides ITC-0052 accessibility planning and source anchors for native scene controls.`

determinism: `The accessibility source labels are generated from AgentOpsVisualSceneSnapshot records and deterministic scene ids, not mock events.`

noFakeProductSeed: `No product-visible AgentOps rows, screenshots, agents, chats, or reports are seeded.`

noSimulatedRuntimeOutput: `No simulated runtime output or mock AgentOps event stream is included.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Private paths, prompt text, raw message content, account values, screenshots, credentials, tokens, and runtime logs are excluded.`

redactionReview: `VoiceOver review must confirm source records are ids/statuses only and do not expose operator or message text.`

failureHandling: `Missing labels, keyboard traps, unreachable controls, color-only state, leaked content, or mock-event dependence blocks AgentOps accessibility evidence.`
