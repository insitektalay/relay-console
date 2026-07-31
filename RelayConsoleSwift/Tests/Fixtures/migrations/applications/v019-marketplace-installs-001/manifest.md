# Migration Fixture Manifest - Applications Marketplace Installs V019

id: `fix-migration-applications-marketplace-installs-v019-001`

layer: `migration`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0034`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `LOCAL-APP-EXCLUDED-001`, `RUNTIME-WRITE-DEFERRED-001`

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

- `migrations/applications/v019-marketplace-installs-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../../Sources/RelayConsoleCore/Migrations.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0034`

validationCommandIds: `VC-0100`

demoIds: `Demo 4`, `Demo 5`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-035-itc-0034-marketplace-installs.md`

surface: `applications_marketplace_installs and applications_marketplace_install_snapshots schema with active-target uniqueness, drift indexes, retained JSON snapshots, and redaction status`

stateKind: `verified-migration`

reasonCode: `applications-marketplace-install-schema`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `LOCAL-APP-EXCLUDED-001`, `RUNTIME-WRITE-DEFERRED-001`

missingPrerequisites: `Runtime file writes, provider-side tool grants, generated pack installs, source-host installs, local repo apps, Paperclip, and release readiness remain later or excluded.`

currentState: `Schema v019 stores Marketplace install records, role assignment fields, target agent and runtime binding ids, approval profile ids, selected capabilities, install lifecycle, drift state, removal timestamps, redacted metadata, and read-only install snapshots without product seed rows.`

notParityStatement: `This migration fixture does not claim runtime dispatch writes, provider bridge writes, local app installs, generated pack installs, source-host persistence, Paperclip support, or manual visual completion.`

activationRequirement: `Runtime/provider writes require later safety-card authorization and manual evidence before install execution can become live.`

releaseImpact: `Unblocks durable local install-state persistence for ITC-0034 while keeping execution paths deferred.`

determinism: `The migration creates deterministic tables and indexes and inserts no product-visible rows.`

noFakeProductSeed: `No Marketplace install rows, compatible agents, provider credentials, or snapshots are seeded by migration.`

noSimulatedRuntimeOutput: `No runtime transcript, tool output, or generated agent output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw tokens, API keys, client secrets, bearer values, local paths, source-host metadata, private prompts, and raw workspace state are excluded.`

redactionReview: `The schema includes redaction_status and stores install/snapshot JSON only through LocalDataService sanitizers.`

failureHandling: `If v019 drops install lifecycle, drift, target runtime, approval profile, selected capabilities, snapshot retention, redaction status, active-target uniqueness, or inert seed guarantees, ITC-0034 migration evidence fails.`
