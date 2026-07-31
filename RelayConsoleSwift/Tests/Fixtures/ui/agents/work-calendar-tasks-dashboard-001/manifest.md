# UI Fixture Manifest - Agents Work Calendar Tasks Dashboard

id: `fix-ui-agents-work-calendar-tasks-dashboard-001`

layer: `ui`

productArea: `agents-work-calendar-tasks-dashboard`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0079`, `RCSPR-0108`, `ITC-0008`, `ITC-0026`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`

gapOrDecisionIds: `AD-001`, `ITC-0045`, `ITC-0053`

fixtureKind: `source-backed-ui-contract`

owner: `agents-ui`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `UI source evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `screen-contracts/agents/agent-structure.md`, `screen-contracts/agents/work-calendar.md`, `screen-contracts/agents/tasks.md`, `ITC-0026`

files:

- `ui/agents/work-calendar-tasks-dashboard-001/manifest.md`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0026`

validationCommandIds: `VC-0105`, `ITC-0008`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-027-itc-0026-work-calendar-tasks-team-memory-dashboards.md`

surface: `Org Structure dashboard, Agent work calendar, Schedule Tasks list/detail, team memory, and handovers`

stateKind: `verified-source`

reasonCode: `agents-work-ui-service-backed`

decisionIds: `ITC-0045`

missingPrerequisites: `Rendered screenshots, keyboard traversal, VoiceOver traversal, task creation authority, task dispatch authority, task-scoped approvals, and manual Demo 8 signoff remain later work.`

currentState: `Source checks verify AgentWorkCalendarPanel, AgentTasksPanel, service-backed AppViewModel state, empty states, search/sort controls, redacted memory/handover text paths, and disabled task write actions.`

notParityStatement: `This source fixture does not claim screenshot parity, final AgentOps parity, task creation parity, approval workflow parity, or manual accessibility completion.`

activationRequirement: `Task creation, dispatch, approval, and memory authoring controls must remain disabled until their authority gates are implemented and tested.`

releaseImpact: `Unblocks ITC-0026 source-backed UI evidence for read-only dashboards and calendar/task inspection.`

determinism: `Static source tests scan deterministic Swift anchors and do not rely on live local data.`

noFakeProductSeed: `No product-visible agents, org rows, tasks, task runs, memory, handovers, screenshots, or runtime identities are seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, real task text, prompts, credentials, account data, screenshots, and runtime logs are excluded.`

redactionReview: `The fixture is source-only; sensitive team memory and handover UI paths use redaction copy rather than raw content.`

failureHandling: `If panels lose service-backed state, invent rows, enable gated write actions, remove empty states, or remove redaction paths, ITC-0026 UI evidence fails.`
