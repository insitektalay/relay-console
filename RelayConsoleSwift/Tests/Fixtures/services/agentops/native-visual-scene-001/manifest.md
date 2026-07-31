# Service Fixture Manifest - AgentOps Native Visual Scene

id: `fix-services-agentops-native-visual-scene-001`

layer: `service`

productArea: `agentops-native-visual-scene`

requirementIds: `RCSPR-0004`, `RCSPR-0033`, `RCSPR-0080`, `RCSPR-0094`, `RCSPR-0098`, `RCSPR-0108`, `RCSPR-0111`, `RCSPR-0125`, `RCSPR-0134`, `RCSPR-0199`, `ITC-0052`

sourceMapIds: `SM-0049`, `SM-0050`, `SM-0051`, `SM-0052`, `SM-0053`, `SM-0127`, `SM-0130`, `SM-0135`, `SM-0143`, `SM-0145`, `SM-0148`, `SM-0150`, `SM-0151`, `SM-0158`, `SM-0161`

featureIds: `FI-0040`, `FI-0090`, `FI-0098`, `FI-0118`, `FI-0125`, `FI-0189`

gapOrDecisionIds: `D-0005`, `SBD-0004`, `EP-0002`

fixtureKind: `agentops-service-visual-scene`

owner: `agentops-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0052-agentops-native-visual`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `AgentOpsService.swift`, `Models.swift`, `ServiceTests.swift`, `screen-contracts/agentops/hq.md`, `ITC-0052`

files:

- `services/agentops/native-visual-scene-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0052`, `CODE-001-051`

validationCommandIds: `VC-0102`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0052-agentops-native-visual/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-051-itc-0052-agentops-native-visual-scene.md`

surface: `AgentOpsService visualSceneSnapshot native scene derivation`

stateKind: `verified-service`

reasonCode: `agentops-visual-scene-source-backed`

decisionIds: `D-0005`

missingPrerequisites: `Rendered standard/minimum-window screenshots, manual VoiceOver traversal, and editable service-backed layout override persistence remain planned evidence.`

currentState: `Service tests verify AgentOpsVisualSceneSnapshot derives from retained AgentOpsLiveStateSnapshot rows, preserves sourceRecordIds for dispatch/message/task/agent rows, marks weak missing-data rows as visual fallback, records bundled_web_agentops_floor_worker_assets, and keeps layoutPersistenceStatus web_default_operations_floor_layout_source_record_backed.`

notParityStatement: `This service fixture proves source-backed native scene derivation only. It does not claim final asset parity, Pixi parity, editable layout mutation parity, screenshot proof, or manual release signoff.`

activationRequirement: `Writable AgentOps layout editing must add authority, audit, storage, relaunch, screenshot, and accessibility evidence before activation.`

releaseImpact: `Unblocks ITC-0052 automated service evidence for native AgentOps visuals while preserving D-0005 asset residuals.`

determinism: `The test uses a temporary local store, retained dispatch/message/agent rows, fixed selected ids, deterministic room bounds, deterministic entity positions, and no product-visible seed data.`

noFakeProductSeed: `The fixture creates only temporary service-test agents, dispatches, messages, and AgentOps scene objects; it does not seed product-visible AgentOps rows.`

noSimulatedRuntimeOutput: `No mock runtime output or mock AgentOps event stream is used; visual state is derived from retained local dispatch, task, message, health, and agent records.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Private paths, account values, raw prompt text, runtime logs, credentials, tokens, and screenshots are excluded.`

redactionReview: `The service test inserts synthetic sensitive operator text and asserts the encoded AgentOps visual scene does not contain it.`

failureHandling: `Missing sourceRecordIds, leaked operator text, mock product-state dependency, missing visual fallback label, missing deterministic asset status, or missing layoutPersistenceStatus blocks ITC-0052 service evidence.`
