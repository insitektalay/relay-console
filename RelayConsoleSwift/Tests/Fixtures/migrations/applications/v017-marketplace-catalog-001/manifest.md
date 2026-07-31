# Migration Fixture Manifest - Applications Marketplace Catalog

id: `fix-migration-applications-v017-marketplace-catalog-001`

layer: `migration`

productArea: `applications`

requirementIds: `RCSPR-0035`, `RCSPR-0036`, `RCSPR-0178`, `ITC-0032`

sourceMapIds: `SM-0019`, `SM-0141`, `SM-0155`, `SM-0160`

featureIds: `FI-0041`, `FI-0141`

gapOrDecisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

fixtureKind: `schema-fixture`

owner: `applications-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `migration-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `migration evidence`

sourceBaseline: `Migrations.swift`, `MigrationTests.swift`, `LocalDataService.swift`

files:

- `migrations/applications/v017-marketplace-catalog-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../../Sources/RelayConsoleCore/Migrations.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0032`

validationCommandIds: `VC-0100`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-033-itc-0032-applications-marketplace-catalog.md`

surface: `applications_navigation_records, marketplace_catalog_apps, applications_catalog_snapshots`

stateKind: `verified-schema`

reasonCode: `applications-marketplace-catalog`

decisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

missingPrerequisites: `Provider OAuth, install execution, local app creation, source-host records, generated pack review, and Paperclip flows remain later or excluded scope.`

currentState: `Version 17 adds retained Applications navigation, Marketplace catalog app, and Applications catalog snapshot tables with indexes and no product-visible seed rows.`

notParityStatement: `This fixture does not claim live provider catalogue fetches, provider installs, local app management, generated pack review, Paperclip, or release readiness.`

activationRequirement: `Service, contract, UI, visual, and accessibility fixtures must remain aligned before Applications Marketplace can be counted as usable.`

releaseImpact: `Adds durable schema backing for service-owned Applications Marketplace catalog state without seeding product truth.`

determinism: `Migration checks use an isolated empty database and static schema introspection.`

noFakeProductSeed: `The migration creates no Applications catalog, Marketplace app, local app, review, or Paperclip rows.`

noSimulatedRuntimeOutput: `No runtime output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private account values, provider tokens, local paths, source-host metadata, prompts, and raw workspace state are excluded.`

redactionReview: `Schema metadata contains canonical ids and no secrets.`

failureHandling: `If v17 tables or indexes disappear, seed rows appear, or local/source-host/Paperclip state is introduced, this fixture fails.`
