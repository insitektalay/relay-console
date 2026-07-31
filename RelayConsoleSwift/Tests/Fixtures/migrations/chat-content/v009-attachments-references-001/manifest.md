# Migration Fixture Manifest - Chat Attachments References v009

id: `fix-migrations-chat-content-v009-attachments-references-001`

layer: `migration`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `schema-attachment-reference-evidence`

owner: `persistence`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:05:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Migrations.swift`, `LocalDataService.swift`, `screen-contracts/chat/composer-attachments-references.md`, `ITC-0016`

files:

- `migrations/chat-content/v009-attachments-references-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0016`

validationCommandIds: `VC-0100`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-017-itc-0016-attachments-references.md`

surface: `Durable chat attachments and document reference schema`

stateKind: `active`

reasonCode: `verified-local-migration`

decisionIds: `none`

missingPrerequisites: `Screenshot capture, full renderer parity, runtime transcript proof, and Paperclip link behavior remain outside this fixture.`

currentState: `Schema version 9 adds chat_attachments and chat_document_references with message linkage, thread/profile staged attachment lookup, status/progress/error metadata, redacted provenance, and redacted reference display fields.`

notParityStatement: `This fixture proves retained native attachment/reference persistence only; Paperclip, browser upload chunks, and full web renderer parity are excluded.`

activationRequirement: `Service, UI, visual, and accessibility evidence must cite this fixture before user-facing attachment behavior is claimed.`

releaseImpact: `Unblocks ITC-0016 persistence evidence while preserving later renderer and screenshot residuals.`

determinism: `The migration test asserts fixed table, column, and index names and verifies migrations do not seed product-visible rows.`

noFakeProductSeed: `The migration creates no attachment rows, reference rows, transcript rows, generated greetings, or fake messages.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, raw file bytes, and runtime snapshots are excluded.`

redactionReview: `Attachment provenance and reference metadata use redacted fixed values only; service tests assert no private path leakage.`

failureHandling: `If v009 misses attachment/reference schema, seeds product data, or leaks private fields, ITC-0016 migration evidence fails.`
