# Migration Fixture Manifest - Applications Needed Tools V020

id: `fix-migration-applications-needed-tools-v020-001`

layer: `migration`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0036`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `LOCAL-APP-EXCLUDED-001`, `TOOL-AUTO-GRANT-EXCLUDED-001`

fixtureKind: `schema-migration`

owner: `local-data-service`

status: `verified`

secretsPolicy: `secret-references-only`

artifactClass: `migration-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `migration evidence`

sourceBaseline: `Migrations.swift`, `MigrationTests.swift`

files:

- `migrations/applications/v020-needed-tools-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../../Sources/RelayConsoleCore/Migrations.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0036`

validationCommandIds: `VC-0100`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-036-itc-0036-needed-tools.md`

surface: `applications_tool_requests and applications_needed_tools_snapshots schema with dedupe index, status fields, evidence references, suggested apps, redacted metadata, and snapshot counts`

stateKind: `verified-migration`

reasonCode: `applications-needed-tools-schema`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `LOCAL-APP-EXCLUDED-001`, `TOOL-AUTO-GRANT-EXCLUDED-001`

missingPrerequisites: `Paperclip connection/link/setup/test/member/chat integration, automatic installs, automatic grants, source-host file access, and release readiness remain excluded or later.`

currentState: `Schema v020 stores retained tool request records and Needed Tools snapshots without product seed rows.`

notParityStatement: `This migration fixture does not claim Paperclip parity, live tool install execution, automatic grants, local file access, or manual visual completion.`

activationRequirement: `Tool grant and install activation require later permission, audit, and approval authority cards.`

releaseImpact: `Unblocks durable local Needed Tools request persistence for ITC-0036.`

determinism: `The migration creates deterministic tables and indexes and inserts no product-visible rows.`

noFakeProductSeed: `No Needed Tools request rows, snapshots, fake grants, app installs, provider credentials, or Paperclip rows are seeded by migration.`

noSimulatedRuntimeOutput: `No runtime transcript, tool output, or generated agent output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw tokens, API keys, client secrets, bearer values, local paths, source-host metadata, private prompts, and raw workspace state are excluded.`

redactionReview: `The schema includes redaction_status and stores request/snapshot JSON only through LocalDataService sanitizers.`

failureHandling: `If v020 drops tool request status, dedupe, evidence references, suggested app metadata, snapshot counts, redaction status, or inert seed guarantees, ITC-0036 migration evidence fails.`
