# Visual Fixture Manifest - AgentOps Native Visual Scene

id: `fix-visual-agentops-native-visual-scene-001`

layer: `visual`

productArea: `agentops-native-visual-scene`

requirementIds: `RCSPR-0004`, `RCSPR-0033`, `RCSPR-0080`, `RCSPR-0094`, `RCSPR-0098`, `RCSPR-0108`, `RCSPR-0111`, `RCSPR-0125`, `RCSPR-0134`, `RCSPR-0199`, `ITC-0008`, `ITC-0052`

sourceMapIds: `SM-0049`, `SM-0050`, `SM-0051`, `SM-0052`, `SM-0053`, `SM-0127`, `SM-0130`, `SM-0135`, `SM-0143`, `SM-0145`, `SM-0148`, `SM-0150`, `SM-0151`, `SM-0158`, `SM-0161`

featureIds: `FI-0040`, `FI-0090`, `FI-0098`, `FI-0118`, `FI-0125`, `FI-0189`

gapOrDecisionIds: `D-0005`, `SBD-0004`, `EP-0002`

fixtureKind: `visual-source-scaffold`

owner: `agentops-visual`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `manual-evidence-scaffold`

branch: `codex/itc-0052-agentops-native-visual`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `Views.swift`, `AgentOpsService.swift`, `screen-contracts/agentops/hq.md`, `ITC-0052`

files:

- `visual/agentops/native-visual-scene-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0052`, `CODE-001-051`

validationCommandIds: `VC-0106`, `ITC-0008`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0052-agentops-native-visual/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-051-itc-0052-agentops-native-visual-scene.md`

surface: `AgentOps native visual scene standard and minimum windows`

stateKind: `planned-visual-review`

reasonCode: `agentops-native-scene-screenshot-pending`

decisionIds: `D-0005`

missingPrerequisites: `Standard-window screenshots, minimum-window screenshots, selected room/agent screenshots, empty/no-agents screenshots, stale/error screenshots, and rendered overlap review remain required.`

currentState: `Source defines full-window AgentOpsVisualSceneView, HUD/status strip, live-state banner, deterministic room bounds, path overlay, selectable agent nodes, event feed, selected panel, and editable layout controls. Screenshots are not yet captured.`

notParityStatement: `This visual scaffold does not claim screenshot parity, final floor/worker asset parity, editable layout parity, manual Demo 8 completion, or release readiness.`

activationRequirement: `Capture and review standard/minimum-window screenshots plus selected and empty states before using this as visual release proof.`

releaseImpact: `Provides ITC-0052 visual evidence planning and source anchors while preserving manual screenshot residuals.`

determinism: `The scene uses bundled_web_agentops_floor_worker_assets and web_default_operations_floor_layout_source_record_backed instead of generated screenshots or mock event state.`

noFakeProductSeed: `No product-visible rows or screenshots are seeded.`

noSimulatedRuntimeOutput: `No mock AgentOps event stream or simulated runtime output is included.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Private paths, account values, raw prompt text, screenshots, credentials, tokens, and runtime logs are excluded.`

redactionReview: `Future screenshot review must confirm scene nodes show ids/statuses only and no raw operator or message content.`

failureHandling: `Overlap, clipping, color-only state, missing selected labels, missing fallback disclosure, leaked text, or mock-event dependence blocks visual evidence.`
