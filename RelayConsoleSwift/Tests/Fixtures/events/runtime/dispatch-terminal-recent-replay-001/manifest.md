# Event Replay Fixture Manifest - Terminal Dispatch Replay

id: `fix-events-runtime-dispatch-terminal-recent-replay-001`

layer: `event-replay`

productArea: `chat-runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0124`, `RCSPR-0146`

sourceMapIds: `SM-0112`, `SM-0114`, `SM-0115`, `SM-0154`

featureIds: `FI-0079`, `FI-0080`, `FI-0117`, `FI-0137`

gapOrDecisionIds: `G-0033`, `SBD-0005`

fixtureKind: `expected-output`

owner: `runtime`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0006-0008-service-replay-visual-scaffold`

commit: `69b6e30`

appVersion: `0.1.0`

capturedAt: `2026-06-22T19:42:08Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `RuntimeEventReplay.swift`, `DispatchService.swift`,
`LocalDataService.swift`, `Models.swift`, `fixture-catalog.md`,
`runtime-replay-negative-drill-matrix.md`

files:

- `events/runtime/dispatch-terminal-recent-replay-001/manifest.md`
- `../RelayConsoleEventReplayTests/EventReplayTests.swift`

expectedChecks:

- `VC-0103`
- `swift run RelayConsoleEventReplayTests`

implementationTaskIds: `ITC-0007`

validationCommandIds: `VC-0103`, `VC-0001`, `VC-0002`, `VC-0003`

demoIds: `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0006-0008-service-replay-visual-scaffold/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-008-itc-0007-event-replay-scaffold.md`

determinism: `The consuming replay test uses stable terminal dispatch, terminal event, late duplicate event, posted agent-message metadata, and timestamp ids; terminal status has priority over late active events.`

noFakeProductSeed: `The fixture is decoded inside the replay test only and does not seed product-visible conversations, agents, harnesses, dashboards, reports, or runtime rows.`

noSimulatedRuntimeOutput: `The fixture records terminal reconciliation with redacted placeholders only; it is not runtime harness output and is not counted as real dispatch proof.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Machine-specific paths, account values, private prompts, and raw credentials are excluded.`

redactionReview: `RelayConsoleEventReplayTests checks redacted replay detail and branch evidence redaction scan covers event fixture paths.`

failureHandling: `Any terminal duplicate-output, late-event priority, redaction, build, smoke, or diff-hygiene failure blocks ITC-0007 closeout.`

releaseImpact: `This fixture can unblock later terminal-replay cards only as scaffold proof; it does not prove real-harness, UI, dashboard, AgentOps, report, or release readiness.`
