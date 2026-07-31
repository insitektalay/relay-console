# Event Replay Fixture Manifest - AgentOps Live State Priority

id: `fix-events-agentops-live-state-priority-001`

layer: `event-replay`

productArea: `agentops-live-state-priority`

requirementIds: `RCSPR-0004`, `RCSPR-0033`, `RCSPR-0080`, `RCSPR-0094`, `RCSPR-0125`, `RCSPR-0134`, `ITC-0052`

sourceMapIds: `SM-0049`, `SM-0050`, `SM-0051`, `SM-0052`, `SM-0053`, `SM-0143`, `SM-0145`, `SM-0148`, `SM-0150`, `SM-0151`

featureIds: `FI-0040`, `FI-0090`, `FI-0098`, `FI-0118`, `FI-0125`

gapOrDecisionIds: `D-0005`, `SBD-0004`

fixtureKind: `agentops-event-priority-evidence`

owner: `agentops-runtime`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0052-agentops-native-visual`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `event replay evidence`

sourceBaseline: `AgentOpsService.swift`, `RuntimeEventReplay.swift`, `ServiceTests.swift`, `EventReplayTests.swift`, `ITC-0052`

files:

- `events/agentops/live-state-priority-001/manifest.md`
- `../RelayConsoleEventReplayTests/EventReplayTests.swift`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0103`
- `swift run RelayConsoleEventReplayTests`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0052`, `CODE-001-051`

validationCommandIds: `VC-0103`, `VC-0102`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0052-agentops-native-visual/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-051-itc-0052-agentops-native-visual-scene.md`

surface: `AgentOps live-state priority across runtime_dispatch, task approval, message, agent_status, and source:none fallback`

stateKind: `verified-event-replay`

reasonCode: `agentops-live-state-priority-source-backed`

decisionIds: `D-0005`

missingPrerequisites: `Manual real-harness event observations remain planned; this packet covers deterministic local replay/source-priority semantics.`

currentState: `Service and event manifest tests cover runtime_dispatch as the strongest active signal, approval task state, agent message state, agent_status offline state, and source:none weak visual fallback.`

notParityStatement: `This event fixture does not claim live Hermes/OpenClaw harness execution, screenshot parity, host-control, standalone Approvals, or final release readiness.`

activationRequirement: `Any new AgentOps source such as runtime_tool or runtime_thinking must add retained record replay and redaction evidence before being counted as product truth.`

releaseImpact: `Provides ITC-0052 event-replay evidence that AgentOps visual state priority is source-backed and not a mock event stream.`

determinism: `The evidence uses stable local ids, fixed service contexts, retained source records, and no generated runtime output.`

noFakeProductSeed: `The fixture does not seed product-visible AgentOps rows, agents, chats, screenshots, or runtime logs.`

noSimulatedRuntimeOutput: `No simulated runtime output is included; source priority is verified from retained local records and redacted replay semantics only.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Private paths, credentials, prompt text, tokens, account data, screenshots, and raw runtime logs are excluded.`

redactionReview: `AgentOps service tests assert encoded snapshots and visual scenes exclude synthetic sensitive operator text.`

failureHandling: `Missing runtime_dispatch, approval, message, agent_status, source:none, redaction, or CODE-001-051/ITC-0052 links blocks AgentOps event evidence.`
