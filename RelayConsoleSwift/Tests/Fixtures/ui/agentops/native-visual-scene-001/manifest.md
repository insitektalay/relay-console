# UI Fixture Manifest - AgentOps Native Visual Scene

id: `fix-ui-agentops-native-visual-scene-001`

layer: `ui`

productArea: `agentops-native-visual-scene`

requirementIds: `RCSPR-0004`, `RCSPR-0033`, `RCSPR-0080`, `RCSPR-0094`, `RCSPR-0098`, `RCSPR-0108`, `RCSPR-0111`, `RCSPR-0125`, `RCSPR-0134`, `RCSPR-0199`, `ITC-0008`, `ITC-0052`

sourceMapIds: `SM-0049`, `SM-0050`, `SM-0051`, `SM-0052`, `SM-0053`, `SM-0127`, `SM-0130`, `SM-0135`, `SM-0143`, `SM-0145`, `SM-0148`, `SM-0150`, `SM-0151`, `SM-0158`, `SM-0161`

featureIds: `FI-0040`, `FI-0090`, `FI-0098`, `FI-0118`, `FI-0125`, `FI-0189`

gapOrDecisionIds: `D-0005`, `SBD-0004`, `EP-0002`

fixtureKind: `swiftui-source-evidence`

owner: `agentops-ui`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `source-check-fixture`

branch: `codex/itc-0052-agentops-native-visual`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `ui evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `AgentOpsService.swift`, `Models.swift`, `screen-contracts/agentops/hq.md`, `ITC-0052`

files:

- `ui/agentops/native-visual-scene-001/manifest.md`
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

surface: `AgentOps HQ native visual scene, HUD, live-state banner, selected panel, event feed, and editable layout controls`

stateKind: `verified-source-ui`

reasonCode: `agentops-native-scene-source-backed`

decisionIds: `D-0005`

missingPrerequisites: `Rendered standard/minimum-window screenshots and manual keyboard/VoiceOver traversal remain planned before release visual signoff.`

currentState: `Source checks verify AgentOpsVisualSceneView, AgentOpsSceneRoomView, AgentOpsSceneEntityNode, AgentOpsLiveStateBanner, AgentOpsLayoutEditorPanel, Source records, deterministic asset fallback labels, and AppViewModel scene selection helpers.`

notParityStatement: `This UI fixture proves source-visible native scene wiring only. It does not claim screenshot parity, final asset parity, editable layout parity, or manual accessibility completion.`

activationRequirement: `Product-write layout controls remain disabled/read-only until service-backed layout persistence, authority, audit, and relaunch evidence are added.`

releaseImpact: `Unblocks ITC-0052 source UI evidence for native AgentOps visual scene over real local live-state records.`

determinism: `The UI consumes AgentOpsVisualSceneSnapshot from AgentOpsService and uses deterministic native room/entity positioning rather than seeded screenshots or mock events.`

noFakeProductSeed: `No product-visible AgentOps rows, agents, chats, screenshots, or reports are seeded by this fixture.`

noSimulatedRuntimeOutput: `No mock AgentOps event controls or simulated runtime output are product UI inputs.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Private paths, raw prompt text, account data, screenshots, credentials, and runtime logs are excluded.`

redactionReview: `UI source exposes redactionStatus, source records by id only, and no operator/message content fields in scene nodes.`

failureHandling: `Removing source-backed scene state, sourceRecordIds, fallback labels, layout editor controls, no-mock discipline, or visual scene components blocks ITC-0052 UI evidence.`
