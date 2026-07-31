# Event Replay Fixture Manifest - Delayed Terminal Reconciliation

id: `fix-events-runtime-dispatch-delayed-terminal-reconciliation-001`

layer: `event-replay`

productArea: `chat-runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0124`, `RCSPR-0146`,
`RCSPR-0165`, `RCSPR-0167`

sourceMapIds: `SM-0112`, `SM-0115`, `SM-0154`, `SM-0157`

featureIds: `FI-0079`, `FI-0137`, `FI-0156`, `FI-0157`

gapOrDecisionIds: `G-0033`, `SBD-0005`

fixtureKind: `expected-output`

owner: `runtime`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:45:39Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `RuntimeEventReplay.swift`, `DispatchService.swift`,
`implementation-task-cards.md`, `runtime-dispatch-chat-cards.md`

files:

- `events/runtime/dispatch-delayed-terminal-reconciliation-001/manifest.md`
- `../RelayConsoleEventReplayTests/EventReplayTests.swift`

expectedChecks:

- `VC-0103`
- `swift run RelayConsoleEventReplayTests`

implementationTaskIds: `ITC-0019`

validationCommandIds: `VC-0103`

demoIds: `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-020-itc-0019-local-event-replay-dispatch-reconciliation.md`

determinism: `The consuming replay test uses fixed completed, failed, cancelled, late-delta, posted-message, event, dispatch, correlation, and timestamp ids.`

noFakeProductSeed: `The fixture is decoded inside the replay test only and does not seed product-visible conversations, agents, harnesses, dashboards, reports, or runtime rows.`

noSimulatedRuntimeOutput: `The fixture records terminal reconciliation with redacted placeholders only; it is not runtime harness output and is not counted as real dispatch proof.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Machine-specific paths, account values, private prompts, and raw credentials are excluded.`

redactionReview: `RelayConsoleEventReplayTests checks redacted replay detail and branch redaction scans cover event fixture paths.`

failureHandling: `Any delayed terminal priority, posted-message reconciliation, failure-card, cancelled-card, retry-safety, or duplicate-output failure blocks ITC-0019 closeout.`

releaseImpact: `Unblocks ITC-0019 delayed terminal reconciliation evidence only; real runtime transcript and full chat demo evidence remain downstream residuals.`
