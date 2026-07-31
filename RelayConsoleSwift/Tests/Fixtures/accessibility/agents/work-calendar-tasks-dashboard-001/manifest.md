# Accessibility Fixture Manifest - Agents Work Calendar Tasks Dashboard

id: `fix-accessibility-agents-work-calendar-tasks-dashboard-001`

layer: `accessibility`

productArea: `agents-work-calendar-tasks-dashboard`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0079`, `RCSPR-0108`, `ITC-0008`, `ITC-0026`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`

gapOrDecisionIds: `AD-001`, `ITC-0045`, `ITC-0053`

fixtureKind: `source-backed-accessibility-contract`

owner: `agents-ui`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `Accessibility source evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `screen-contracts/agents/agent-structure.md`, `screen-contracts/agents/work-calendar.md`, `screen-contracts/agents/tasks.md`, `ITC-0026`

files:

- `accessibility/agents/work-calendar-tasks-dashboard-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0026`

validationCommandIds: `VC-0107`, `ITC-0008`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-027-itc-0026-work-calendar-tasks-team-memory-dashboards.md`

surface: `Read-only Agents structure, work calendar, and task dashboard source accessibility`

stateKind: `verified-source`

reasonCode: `agents-work-accessibility-source-backed`

decisionIds: `ITC-0045`

missingPrerequisites: `Manual keyboard traversal, VoiceOver traversal, focus screenshots, populated-state review, and Demo 8 accessibility signoff remain later work.`

currentState: `Source checks verify accessible labels/help on calendar range controls, task search, scheduler toggle, task row buttons, disabled task action controls, status badges, and empty states.`

notParityStatement: `This fixture does not claim VoiceOver completion, keyboard traversal completion, rendered screenshot parity, task creation parity, approval parity, or final manual accessibility signoff.`

activationRequirement: `Manual accessibility observations must be attached before release signoff claims.`

releaseImpact: `Documents ITC-0026 accessibility source coverage while keeping manual review residuals explicit.`

determinism: `Static source checks verify labels, help text, disabled reasons, and empty-state anchors.`

noFakeProductSeed: `No product-visible tasks, calendar rows, memory, handovers, screenshots, or runtime identities are seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, screenshots, task text, prompts, credentials, account data, and runtime logs are excluded.`

redactionReview: `The fixture is source-only and contains no private accessibility recordings or personal data.`

failureHandling: `If controls lose labels/help text, read-only disabled state, empty states, or redaction paths, ITC-0026 accessibility source evidence fails.`
