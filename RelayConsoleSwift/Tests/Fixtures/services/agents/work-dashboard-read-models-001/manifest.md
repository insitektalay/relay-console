# Service Fixture Manifest - Agent Work Dashboard Read Models

id: `fix-services-agents-work-dashboard-read-models-001`

layer: `service`

productArea: `agents-work-dashboard`

requirementIds: `RCSPR-0031`, `RCSPR-0032`, `RCSPR-0131`, `RCSPR-0134`, `RCSPR-0152`, `ITC-0026`

sourceMapIds: `SM-0047`, `SM-0048`, `SM-0150`, `SM-0151`, `SM-0155`, `SM-0158`

featureIds: `FI-0036`, `FI-0037`, `FI-0124`, `FI-0125`, `FI-0143`

gapOrDecisionIds: `SBD-0001`, `ITC-0045`

fixtureKind: `agent-work-dashboard-service`

owner: `agents-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `AgentWorkDashboardService.swift`, `LocalDataService.swift`, `Migrations.swift`, `ServiceTests.swift`, `ITC-0026`

files:

- `services/agents/work-dashboard-read-models-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0026`

validationCommandIds: `VC-0102`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-027-itc-0026-work-calendar-tasks-team-memory-dashboards.md`

surface: `AgentWorkDashboardService structure dashboard, task list, task runs, work calendar, team memory, and handovers`

stateKind: `verified-service`

reasonCode: `agents-work-dashboard-service-backed`

decisionIds: `ITC-0045`

missingPrerequisites: `Task creation, dispatch actions, task-scoped approvals, screenshot parity, and manual Demo 8 review remain later gated work.`

currentState: `Service tests prove empty dashboards do not invent rows, viewer access is denied, persisted task rows drive running/blocked/approval/incident counts, persisted task runs drive completed calendar counts, persisted team memory and handovers drive team dashboard counts, and sensitive memory/handover records remain marked for UI redaction.`

notParityStatement: `This fixture does not claim task creation parity, approval workflow parity, final AgentOps dashboard parity, screenshot parity, or manual release signoff.`

activationRequirement: `Any UI that exposes task creation, dispatch, approval, memory authoring, or mutation must add explicit authority and write-action gates before becoming enabled.`

releaseImpact: `Provides ITC-0026 automated service proof for retained read-only dashboards while preserving write-action residuals.`

determinism: `The test uses temporary local stores, stable service contexts, persisted local rows, and no product-visible seed data.`

noFakeProductSeed: `The fixture creates only temporary service-test agents, org rows, tasks, task runs, memory, and handovers. It does not seed product-visible rows.`

noSimulatedRuntimeOutput: `No runtime chat output is included or simulated; the calendar test asserts no chat activity is invented when no source agent messages exist.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, raw credentials, tokens, prompts, customer data, and runtime logs are excluded.`

redactionReview: `Synthetic sensitive memory and handover values are used only in temporary test rows and asserted through sensitivity flags rather than copied into UI evidence.`

failureHandling: `Any invented task/calendar row, missing authority guard, missing event, incorrect dashboard count, missing run history, or missing sensitive flag blocks ITC-0026 service evidence.`
