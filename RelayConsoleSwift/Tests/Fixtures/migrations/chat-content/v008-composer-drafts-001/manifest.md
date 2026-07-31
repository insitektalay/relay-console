# Migration Fixture Manifest - Chat Composer Drafts v008

id: `fix-migrations-chat-content-v008-composer-drafts-001`

layer: `migration`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `schema-and-draft-recovery-evidence`

owner: `persistence`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:14:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Migrations.swift`, `LocalDataService.swift`, `implementation-task-cards.md` `ITC-0015`, `itc-0015-composer-drafts-send-failure-mentions-packet-dry-run.md`

files:

- `migrations/chat-content/v008-composer-drafts-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0015`

validationCommandIds: `VC-0100`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-016-itc-0015-composer-drafts-send-failure-mentions.md`

surface: `Durable chat composer draft schema`

stateKind: `active`

reasonCode: `verified-local-migration`

decisionIds: `none`

missingPrerequisites: `Attachment staging/upload records, renderer proof, runtime transcript proof, and visual manual closeout remain later task-card scope.`

currentState: `Schema version 8 adds chat_composer_drafts with thread/profile scoped uniqueness, redacted metadata, and updated-at indexing for durable per-thread draft recovery.`

notParityStatement: `This fixture proves draft storage schema only; it is not proof of attachment upload, Paperclip behavior, renderer parity, or real runtime output.`

activationRequirement: `Composer service and UI evidence must link this fixture before claiming durable draft behavior.`

releaseImpact: `Unblocks ITC-0015 draft persistence evidence while keeping attachment and renderer work blocked.`

determinism: `The migration test asserts fixed table, column, and index names and verifies migrations do not seed product-visible rows.`

noFakeProductSeed: `The migration creates no draft rows, transcript rows, generated greetings, or fake messages.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Draft content in tests is fixed placeholder text and excludes private paths, account values, credentials, and runtime snapshots.`

redactionReview: `Draft metadata is stored through the existing redaction path and branch scans cover fixture text.`

failureHandling: `If v008 misses scoped uniqueness, seeds draft content, or fails migration tests, ITC-0015 draft persistence evidence fails.`
