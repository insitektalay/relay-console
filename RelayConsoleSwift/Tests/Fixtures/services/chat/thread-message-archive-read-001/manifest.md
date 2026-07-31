# Service Fixture Manifest - Chat Thread Message Archive Read

id: `fix-services-chat-thread-message-archive-read-001`

layer: `service`

productArea: `chat`

requirementIds: `RCSPR-0162`, `RCSPR-0228`

sourceMapIds: `SM-0157`, `SM-0228`

featureIds: `FI-0153`, `FI-0258`

gapOrDecisionIds: `G-0033`, `G-0042`

fixtureKind: `authority-and-state-evidence`

owner: `chat-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0013-0014-chat-state-service`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T21:16:13Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `ChatService.swift`, `LocalDataService.swift`, `ServiceGuards.swift`, `screen-contracts/chat/thread-list-and-detail.md`

files:

- `services/chat/thread-message-archive-read-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0013`, `ITC-0014`

validationCommandIds: `VC-0102`

branchPacket:
`evidence/branches/codex-itc-0013-0014-chat-state-service/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-014-itc-0013-chat-session-thread-state-foundation.md`

surface: `Chat thread active session, read state, archive guard, and wrap-up reference`

stateKind: `active`

reasonCode: `verified-service-guard`

decisionIds: `none`

missingPrerequisites: `Event replay, runtime dispatch retry/cancel, composer drafts, attachments, renderer, and visual evidence remain later cards.`

currentState: `Service tests create an active direct thread session through ChatService, link messages to the active session, publish local chat events, persist read/unread state, create a wrap-up report reference, archive the thread, close the active session as read-only, and prove denied role, workspace, agent-originated, archived-write, and archived-session calls do not mutate state.`

notParityStatement: `This fixture does not claim full Web chat parity, real runtime transcript proof, team controls, Paperclip, HTML-native rendering, or visual chat closeout.`

activationRequirement: `Later chat UI evidence must build on this service fixture before enabling more controls.`

releaseImpact: `Provides service-level guard evidence for retained chat state while keeping later Slice 4 surfaces blocked.`

determinism: `The service tests use temporary local stores, generated ids scoped to the run, fixed fixture metadata, and count-based no-side-effect assertions.`

noFakeProductSeed: `The fixture creates only test-owned local state and no product seed data.`

noSimulatedRuntimeOutput: `The unread-state check uses a system service notification, not a fake agent runtime reply.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, raw credentials, and runtime snapshots are excluded.`

redactionReview: `Service tests use redacted metadata and branch redaction scans inspect evidence files.`

failureHandling: `If archive/read-only guards mutate messages, emit fake transcript proof, or return non-canonical guard reasons, ITC-0013/ITC-0014 service evidence fails.`
