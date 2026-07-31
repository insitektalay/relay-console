# Service Fixture Manifest - insights-wrapups-001

id: `fix-services-reports-insights-wrapups-001`

layer: `services`

productArea: `reports`

requirementIds: `ITC-0051`, `RCSPR-0150`, `RCSPR-0153`

sourceMapIds: `SM-0155`, `SM-0162`, `SM-0163`

featureIds: `FI-0144`, `FI-0188`

gapOrDecisionIds: `REPORT-STRUCTURED-JOBS-PENDING`

fixtureKind: `service-behavior`

owner: `reports-insights`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `service-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `InsightsService.swift`, `LocalDataService.swift`, `AppViewModel.swift`, `Views.swift`, `RelayConsoleServiceTests`

files:

- `Tests/Fixtures/services/reports/insights-wrapups-001/manifest.md`
- `Sources/RelayConsoleCore/InsightsService.swift`
- `Sources/RelayConsoleCore/LocalDataService.swift`
- `Tests/RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`
- `swift run RelayConsoleModelContractTests`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0051`, `CODE-001-050`

validationCommandIds: `VC-0102`, `VC-0105`, `VC-0106`

demoIds: `Demo 6`, `Demo 8`

branchPacket:
`agent-loop-relayconsole-swift-coding/evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`agent-loop-relayconsole-swift-coding/loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-050-itc-0051-reports-insights-wrapups.md`

surface: `Insights report centre list/detail, local snapshots, chat wrap-up rows, archived-list behavior, retry unavailable state, and derived thread analytics.`

stateKind: `source-backed`

reasonCode: `source-backed-reports`

decisionIds: `REPORT-STRUCTURED-JOBS-PENDING`

missingPrerequisites: `Structured-job runtime report generation and retry execution are not wired. Rendered screenshot, keyboard, VoiceOver, and release evidence remain pending.`

currentState: `InsightsService derives rows from thread_wrap_up_reports and insights_report_snapshots, exposes empty/no-match states without fake rows, archives retained rows, exports analytics from real messages, and rejects retry with feature.missing_service until structured-job support exists.`

notParityStatement: `This fixture does not claim generated report execution, retry execution, external analytics parity, rendered screenshot proof, keyboard proof, VoiceOver proof, or release readiness.`

activationRequirement: `Connect approved structured-job report generation and capture visual/accessibility evidence before enabling retry or claiming full Reports parity.`

releaseImpact: `Allows release aggregation to cite source-backed local reports and honest unavailable retry behavior while keeping runtime generation out of scope.`

determinism: `Service tests use isolated temporary stores, fixed timestamps for visible records, stable reason codes, and no environment-specific account or workspace values.`

noFakeProductSeed: `No product-visible reports are seeded. Test rows are created through LocalDataService and InsightsService APIs, then projected by the same service the UI consumes.`

noSimulatedRuntimeOutput: `No runtime transcript output, generated report job, retry job, provider callback, or external analytics output is generated.`

noGeneratedWelcome: `No generated welcome messages are inserted.`

privateStateExclusions: `Raw prompts, runtime logs, private paths, workspace ids, account values, and unredacted report metadata are excluded or redacted before persistence/projection.`

redactionReview: `RelayConsoleServiceTests checks redacted structured metadata, archive durability, no-match behavior, retry unavailable state, and relaunch recovery.`

failureHandling: `If Insights fabricates rows, leaks private metadata, allows retry without structured-job support, loses archived rows, or derives analytics from anything other than retained messages, ITC-0051 service evidence fails.`
