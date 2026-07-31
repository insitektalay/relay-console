# Event Replay Fixture Manifest - Context And Health Semantics

id: `fix-events-runtime-context-health-participant-001`

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

sourceBaseline: `RuntimeEventReplay.swift`, `Models.swift`,
`source-map.md`, `fixture-catalog.md`,
`runtime-replay-negative-drill-matrix.md`

files:

- `events/runtime/context-health-participant-001/manifest.md`
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

determinism: `The consuming replay test verifies the fixed runtime event semantic list for queued, started, status, delta, thinking, tool, context, completed, failed, cancelled, and health-changed events.`

noFakeProductSeed: `The fixture is semantic scaffold evidence only and does not seed product-visible participant, context, health, dashboard, AgentOps, report, or runtime rows.`

noSimulatedRuntimeOutput: `The fixture contains no runtime transcript or generated output; it verifies event type mapping and secret-safe replay detail handling only.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Machine-specific paths, account values, private prompts, and raw credentials are excluded.`

redactionReview: `RelayConsoleEventReplayTests checks redacted replay detail and branch evidence redaction scan covers event fixture paths.`

failureHandling: `Any event semantic coverage, redaction, build, smoke, or diff-hygiene failure blocks ITC-0007 closeout.`

releaseImpact: `This fixture can unblock later context and health replay cards only as scaffold proof; it does not prove participant UI, real harness, dashboard, AgentOps, report, or release readiness.`
