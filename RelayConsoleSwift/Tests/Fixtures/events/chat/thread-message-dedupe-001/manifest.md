# Event Replay Fixture Manifest - Chat Thread Message Dedupe

id: `fix-events-chat-thread-message-dedupe-001`

layer: `event-replay`

productArea: `chat`

requirementIds: `RCSPR-0162`, `RCSPR-0167`

sourceMapIds: `SM-0157`, `SM-0228`

featureIds: `FI-0153`, `FI-0157`, `FI-0258`

gapOrDecisionIds: `G-0033`, `G-0042`

fixtureKind: `expected-output`

owner: `chat-events`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0013-0014-chat-state-service`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T21:16:13Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `ChatService.swift`, `EventBus.swift`, `RuntimeEventReplay.swift`, `itc-0013-0014-chat-state-service-packet-dry-run.md`

files:

- `events/chat/thread-message-dedupe-001/manifest.md`
- `../RelayConsoleEventReplayTests/EventReplayTests.swift`

expectedChecks:

- `VC-0103`
- `swift run RelayConsoleEventReplayTests`

implementationTaskIds: `ITC-0014`

validationCommandIds: `VC-0103`

branchPacket:
`evidence/branches/codex-itc-0013-0014-chat-state-service/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-015-itc-0014-chat-service-boundary-event-publication.md`

surface: `Local chat event subscriber replay`

stateKind: `active`

reasonCode: `verified-local-event-replay`

decisionIds: `none`

missingPrerequisites: `Real runtime dispatch, composer retry/failure UI, attachments, renderer, and visual chat evidence remain later cards.`

currentState: `Chat event replay tests decode local message.new, thread.read_state.update, and thread.archived payloads, dedupe duplicate event ids, and project thread/message/read/archive source ids without creating messages.`

notParityStatement: `This fixture proves local event subscriber replay semantics only; it is not Web websocket proof or real runtime transcript proof.`

activationRequirement: `Later runtime and chat UI cards must add real dispatch/replay and visual evidence before claiming full live chat parity.`

releaseImpact: `Unblocks ITC-0014 local event publication evidence while preserving downstream runtime/UI residuals.`

determinism: `The consuming test uses fixed event, thread, message, session, read-state, workspace, timestamp, and source-record ids.`

noFakeProductSeed: `The fixture is decoded inside the replay test only and does not seed product-visible conversations.`

noSimulatedRuntimeOutput: `The fixture contains no runtime output and is not counted as real dispatch proof.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Machine-specific paths, account values, private prompts, and raw credentials are excluded.`

redactionReview: `Event replay tests use fixed redacted fixture data and branch redaction scans cover event fixture paths.`

failureHandling: `If duplicate event ids create duplicate projected source records or chat event payloads lose required ids, ITC-0014 event evidence fails.`
