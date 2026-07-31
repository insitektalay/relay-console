# Visual Fixture Manifest - Agents Work Calendar Tasks Dashboard

id: `fix-visual-agents-work-calendar-tasks-dashboard-001`

layer: `visual`

productArea: `agents-work-calendar-tasks-dashboard`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0079`, `RCSPR-0108`, `ITC-0008`, `ITC-0026`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`

gapOrDecisionIds: `AD-001`, `ITC-0045`, `ITC-0053`

fixtureKind: `source-backed-visual-contract`

owner: `agents-ui`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `Visual source evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `screen-contracts/agents/work-calendar.md`, `screen-contracts/agents/tasks.md`, `ITC-0026`

files:

- `visual/agents/work-calendar-tasks-dashboard-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0026`

validationCommandIds: `VC-0106`, `ITC-0008`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-027-itc-0026-work-calendar-tasks-team-memory-dashboards.md`

surface: `Read-only Agents work calendar and task dashboard source layout`

stateKind: `verified-source`

reasonCode: `agents-work-visual-source-backed`

decisionIds: `ITC-0045`

missingPrerequisites: `Standard/minimum-window screenshots, populated/empty calendar captures, task detail captures, focus captures, and manual Demo 8 review remain later work.`

currentState: `Source checks verify the Work Calendar sort dropdown, Business/Family/Personal group selector, empty/populated calendar states, task search, scheduler toggle, task detail, and disabled task action affordances.`

notParityStatement: `This fixture does not claim rendered screenshot parity, hover/focus parity, final task scheduling parity, approval parity, or manual visual signoff.`

activationRequirement: `Rendered visual artifacts must be captured before release signoff claims.`

releaseImpact: `Documents ITC-0026 visual source coverage while keeping screenshot residuals explicit.`

determinism: `RelayConsoleVisualEvidenceTests scans stable Swift source anchors for retained panel structure and states.`

noFakeProductSeed: `No product-visible tasks, calendar rows, org rows, screenshots, or runtime identities are seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, screenshots, task messages, prompts, credentials, account data, and runtime logs are excluded.`

redactionReview: `The fixture is source-only and contains no private visual artifacts.`

failureHandling: `If calendar/task source anchors, disabled write-action states, or empty states disappear, ITC-0026 visual source evidence fails.`
