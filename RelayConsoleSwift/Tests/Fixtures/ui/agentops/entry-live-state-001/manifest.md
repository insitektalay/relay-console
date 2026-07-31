# UI Fixture Manifest - AgentOps Entry Live State

id: `fix-ui-agentops-entry-live-state-001`

layer: `ui`

productArea: `agentops-entry-live-state`

requirementIds: `RCSPR-0018`, `ITC-0008`, `ITC-0027`

sourceMapIds: `SM-0018`, `SM-0150`, `SM-0151`, `SM-0158`

featureIds: `FI-0018`, `FI-0143`

gapOrDecisionIds: `ITC-0045`, `ITC-0053`

fixtureKind: `source-backed-ui-contract`

owner: `agentops-ui`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `UI source evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `ShellNavigation.swift`, `screen-contracts/agentops/hq.md`, `ITC-0027`

files:

- `ui/agentops/entry-live-state-001/manifest.md`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0027`

validationCommandIds: `VC-0105`, `ITC-0008`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-028-itc-0027-agentops-live-state-runtime-overview.md`

surface: `AgentOps HQ entry route, real-time agents list, selected state panel, runtime overview, and redacted event feed`

stateKind: `verified-source`

reasonCode: `agentops-entry-ui-service-backed`

decisionIds: `ITC-0045`

missingPrerequisites: `Rendered screenshot parity, keyboard traversal, VoiceOver traversal, full AgentOps visualization, layout editor polish, and manual Demo 8 signoff remain later work.`

currentState: `Source checks verify AgentOpsHQScreen, AgentOpsSidebarPanel, active AgentOps route, AppViewModel AgentOps snapshot state, redacted runtime overview copy, event feed empty state, and real-agent selection anchors.`

notParityStatement: `This source fixture does not claim full AgentOps visualization parity, AgentOps layout editor parity, host-control parity, screenshot parity, or manual accessibility completion.`

activationRequirement: `AgentOps mutation, approval action, host-control, and layout editing controls must remain out of scope until their service guards and evidence exist.`

releaseImpact: `Unblocks ITC-0027 source-backed UI evidence for AgentOps entry live-state inspection.`

determinism: `Static source tests scan deterministic Swift anchors and do not rely on live local data.`

noFakeProductSeed: `No product-visible agents, dispatches, tasks, messages, screenshots, or runtime identities are seeded.`

noSimulatedRuntimeOutput: `No mock AgentOps events are product UI inputs; source anchors depend on AgentOpsService-backed snapshot state.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, prompt text, account data, credentials, screenshots, and runtime logs are excluded.`

redactionReview: `Runtime overview and event feed source copy explicitly uses redacted summaries and redaction status labels.`

failureHandling: `If AgentOps UI loses service-backed state, depends on mock events, leaks message/task text, or marks later visualization work complete, ITC-0027 UI evidence fails.`
