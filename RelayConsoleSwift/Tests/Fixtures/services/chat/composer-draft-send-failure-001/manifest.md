# Service Fixture Manifest - Composer Draft Send Failure

id: `fix-services-chat-composer-draft-send-failure-001`

layer: `service`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `authority-state-and-failure-evidence`

owner: `chat-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:14:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `ChatService.swift`, `DispatchService.swift`, `LocalDataService.swift`, `screen-contracts/chat/composer-attachments-references.md`

files:

- `services/chat/composer-draft-send-failure-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0015`

validationCommandIds: `VC-0102`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-016-itc-0015-composer-drafts-send-failure-mentions.md`

surface: `Composer drafts, mention unavailable state, and local send failure metadata`

stateKind: `active`

reasonCode: `verified-service-guard`

decisionIds: `none`

missingPrerequisites: `Visual screenshots, manual accessibility review, attachment upload, runtime retry, renderer, and real runtime transcript evidence remain later cards.`

currentState: `Service tests save, reload, and clear per-thread/profile drafts; return explicit mention-unavailable reasons; and prove an unhealthy runtime persists one user message with localSendState failed, retry source id, redacted error code, no dispatch row, and no agent reply.`

notParityStatement: `This fixture does not claim real runtime output, attachment upload, Paperclip behavior, full retry UI, or renderer parity.`

activationRequirement: `UI and visual evidence must link this service proof before claiming user-facing composer closeout.`

releaseImpact: `Unblocks service-level ITC-0015 evidence while preserving later runtime, visual, and attachment residuals.`

determinism: `Tests use temporary stores, a deterministic unhealthy runtime bridge, fixed fixture text, and count-based no-side-effect assertions.`

noFakeProductSeed: `The fixture creates only test-owned rows in temporary stores and no product seed data.`

noSimulatedRuntimeOutput: `The unhealthy bridge returns before dispatch, so no runtime output or fake agent reply is produced.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, raw credentials, and runtime snapshots are excluded.`

redactionReview: `Failure metadata stores a redacted local error code/message only and branch redaction scans inspect fixture text.`

failureHandling: `If failed local sends create dispatch rows, duplicate user messages, or agent replies, ITC-0015 service evidence fails.`
