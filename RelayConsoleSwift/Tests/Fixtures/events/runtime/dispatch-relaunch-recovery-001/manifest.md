# Event Replay Fixture Manifest - Dispatch Relaunch Recovery

id: `fix-events-runtime-dispatch-relaunch-recovery-001`

layer: `event-replay`

productArea: `chat-runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0107`, `RCSPR-0124`,
`RCSPR-0146`, `RCSPR-0165`, `RCSPR-0167`

sourceMapIds: `SM-0037`, `SM-0038`, `SM-0112`, `SM-0115`, `SM-0154`,
`SM-0157`

featureIds: `FI-0031`, `FI-0079`, `FI-0137`, `FI-0156`, `FI-0157`

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

sourceBaseline: `RuntimeEventReplay.swift`, `ChatService.swift`,
`DispatchService.swift`, `implementation-task-cards.md`,
`runtime-dispatch-chat-cards.md`

files:

- `events/runtime/dispatch-relaunch-recovery-001/manifest.md`
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

determinism: `The consuming replay test uses fixed selected thread, unread thread, dispatch, event, message, correlation, timestamp, and posted-message ids; duplicate replay uses the same event id as the dedupe key.`

noFakeProductSeed: `The fixture is decoded inside the replay test only and does not seed product-visible conversations, agents, harnesses, dashboards, reports, or runtime rows.`

noSimulatedRuntimeOutput: `The fixture records replay/recovery state with redacted placeholders only; it is not runtime harness output and is not counted as real dispatch proof.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Machine-specific paths, account values, private prompts, and raw credentials are excluded.`

redactionReview: `RelayConsoleEventReplayTests uses redacted fixture data and branch redaction scans cover event fixture paths.`

failureHandling: `Any relaunch recovery, selected-thread filtering, read-state clearing, duplicate-event, or terminal-output duplication failure blocks ITC-0019 closeout.`

releaseImpact: `Unblocks ITC-0019 local replay recovery evidence only; real-harness relaunch observations and full chat visual signoff remain downstream residuals.`
