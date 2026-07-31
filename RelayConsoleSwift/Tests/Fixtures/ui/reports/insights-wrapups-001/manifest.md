# UI Fixture Manifest - Reports Insights Wrapups

id: `fix-ui-reports-insights-wrapups-001`

layer: `ui`

productArea: `reports`

requirementIds: `ITC-0008`, `ITC-0051`, `ITC-0055`, `CODE-002-002`, `RCSPR-0150`, `RCSPR-0153`

sourceMapIds: `SM-0155`, `SM-0162`, `SM-0163`

featureIds: `FI-0144`, `FI-0188`

gapOrDecisionIds: `REPORT-STRUCTURED-JOBS-PENDING`

fixtureKind: `source-backed-ui-contract`

owner: `reports-ui`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `UI source evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `InsightsService.swift`, `ShellNavigation.swift`, `RelayConsoleVisualEvidenceTests`, `screen-contracts/reports/insights-wrapups.md`

files:

- `Tests/Fixtures/ui/reports/insights-wrapups-001/manifest.md`
- `Sources/RelayConsoleApp/Views.swift`
- `Sources/RelayConsoleApp/AppViewModel.swift`
- `Sources/RelayConsoleCore/InsightsService.swift`
- `Tests/RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0051`, `ITC-0055`, `CODE-001-050`, `CODE-002-002`

validationCommandIds: `VC-0105`, `VC-0106`, `ITC-0008`

demoIds: `Demo 6`, `Demo 8`

branchPacket:
`agent-loop-relayconsole-swift-coding/evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`agent-loop-relayconsole-swift-coding/loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-050-itc-0051-reports-insights-wrapups.md`
`agent-loop-relayconsole-swift-coding/loop-runs/002-release-blocker-remediation-and-screen-contract-revalidation/reports/CODE-002-002-reports-insights-repeat-analysis-repair.md`

surface: `Insights sidebar, grouped report search/filter/sort controls, report detail, analytics panel, Active Periods, Session Breakdown, Agent Repeat Analysis, group and row archive controls, retry unavailable state, repeat-analysis unavailable state, CSV and JSON export controls.`

stateKind: `verified-source`

reasonCode: `source-backed-reports`

decisionIds: `REPORT-STRUCTURED-JOBS-PENDING`

missingPrerequisites: `Rendered standard-window screenshots, minimum-window screenshots, keyboard traversal, VoiceOver traversal, structured-job report generation, retry execution, repeat-analysis execution, and release evidence remain pending.`

currentState: `SwiftUI source exposes InsightsScreen, InsightsSidebarPanel, grouped InsightsReportGroup rows, persisted InsightsViewState, Search reports, All reports, Snapshots, Chat reports, Newest, Oldest, Title, Report, Analytics, Markdown report, Structured data, Snapshot data, Active gap, Export CSV, Export JSON, Active Periods, User messages, Session Breakdown, Agent Repeat Analysis, Run Repeat Analysis, and Re-run Repeat Analysis while AppViewModel loads rows from InsightsService and repeat analysis fails closed through a service-backed unavailable guard.`

notParityStatement: `This source fixture is not screenshot proof, keyboard proof, VoiceOver proof, runtime report generation proof, retry execution proof, repeat-analysis execution proof, external analytics proof, or release readiness.`

activationRequirement: `Reviewer must attach redacted standard and minimum-window observations before this source fixture becomes verified visual evidence. Structured-job generation must be wired before retry becomes active.`

releaseImpact: `Unblocks ITC-0051/CODE-002-002 source-backed Insights UI evidence while keeping runtime report generation, retry, and repeat analysis clearly unavailable until structured-job support exists.`

determinism: `Static source tests scan fixed Swift anchors and fixture ids; service tests use isolated temporary stores, fixed visible timestamps, and no persisted repeat-analysis result rows.`

noFakeProductSeed: `No product-visible report rows are seeded. Empty, no-match, and ready states must come from retained LocalDataService records.`

noSimulatedRuntimeOutput: `No runtime transcript output, generated report job, retry job, repeat-analysis job, analytics provider output, or external export side effect is generated.`

noGeneratedWelcome: `No generated welcome messages are inserted.`

privateStateExclusions: `Screenshots or future review notes must exclude private paths, workspace ids, raw prompts, account values, runtime logs, and unredacted report metadata.`

redactionReview: `RelayConsoleVisualEvidenceTests checks source anchors only; future screenshots must be redacted before status changes from source-backed to visual-reviewed.`

failureHandling: `If the UI source fabricates rows, loses empty-state copy, enables retry or repeat analysis without structured-job support, hides archive state, omits analytics controls, or claims screenshot/accessibility completion, ITC-0051 UI evidence fails.`
