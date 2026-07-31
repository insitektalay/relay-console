# Migration Fixture Manifest - Chat Thread Session Read State v007

id: `fix-migrations-chat-content-v007-thread-session-read-state-001`

layer: `migration`

productArea: `chat`

requirementIds: `RCSPR-0123`, `RCSPR-0162`

sourceMapIds: `SM-0147`, `SM-0157`, `SM-0228`

featureIds: `FI-0153`, `FI-0258`

gapOrDecisionIds: `G-0032`, `G-0042`

fixtureKind: `schema-and-relaunch-evidence`

owner: `persistence`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0013-0014-chat-state-service`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T21:04:03Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Migrations.swift`, `LocalDataService.swift`, `implementation-task-cards.md` `ITC-0013`, `itc-0013-0014-chat-state-service-packet-dry-run.md`

files:

- `migrations/chat-content/v007-thread-session-read-state-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0013`

validationCommandIds: `VC-0100`

branchPacket:
`evidence/branches/codex-itc-0013-0014-chat-state-service/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-014-itc-0013-chat-session-thread-state-foundation.md`

surface: `Chat thread/session/read-state migration`

stateKind: `active`

reasonCode: `verified-local-migration`

decisionIds: `none`

missingPrerequisites: `Runtime dispatch, renderer, composer, attachment, and full visual evidence remain later task-card scope.`

currentState: `Schema version 7 adds thread type, active session id, read/unread/archive fields, message session linkage, thread sessions, participants, read states, and wrap-up report tables. Existing direct thread/message rows are backfilled from source records only.`

notParityStatement: `This fixture proves retained chat-state persistence only; it is not proof of runtime output, renderer parity, attachments, composer drafts, or visual chat parity.`

activationRequirement: `Later chat service, composer, attachment, renderer, runtime, and visual cards must link this verified fixture before claiming their dependent surfaces.`

releaseImpact: `Unblocks local chat state foundation evidence while preserving downstream residuals.`

determinism: `The migration test uses fixed ids and timestamps and asserts deterministic session ids derived from existing thread ids.`

noFakeProductSeed: `The migration does not insert sample conversations, generated greetings, fake agent replies, or wrap-up report rows.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, raw credentials, and runtime snapshots are excluded.`

redactionReview: `Migration tests and branch redaction scans inspect persisted strings for sensitive values.`

failureHandling: `If v007 loses existing direct rows, inserts fake transcript data, misses required indexes, or fails relaunch-safe mapping, ITC-0013 closeout fails.`
