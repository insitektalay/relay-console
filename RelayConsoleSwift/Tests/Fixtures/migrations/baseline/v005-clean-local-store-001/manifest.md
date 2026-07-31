# Migration Fixture Manifest - Version 5 Clean Local Store

id: `fix-migrations-baseline-v005-clean-local-store-001`

layer: `migration`

productArea: `baseline`

requirementIds: `RCSPR-0100`, `RCSPR-0129`, `RCSPR-0143`

sourceMapIds: `SM-0144`, `SM-0147`, `SM-0154`

featureIds: `FI-0122`, `FI-0134`

gapOrDecisionIds: `SBD-0001`

fixtureKind: `evidence`

owner: `persistence`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0004-0005-migration-contract-scaffold`

commit: `69b6e30`

appVersion: `0.1.0`

capturedAt: `2026-06-22T19:16:05Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Migrations.swift`, `DatabaseService.swift`,
`LocalDataService.swift`, `Tests/RelayConsoleMigrationTests/MigrationTests.swift`

files:

- `migrations/baseline/v005-clean-local-store-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`
- `swift run RelayConsoleCoreSmokeTests`
- `git diff --check -- .`

implementationTaskIds: `ITC-0004`

validationCommandIds: `VC-0100`, `VC-0001`, `VC-0002`, `VC-0003`

demoIds: `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0004-0005-migration-contract-scaffold/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-005-itc-0004-migration-scaffold.md`

determinism: `The consuming test creates a temporary SQLite store, runs the fixed migration registry, checks stable table/index names, inserts stable legacy ids, and removes the store after the run.`

noFakeProductSeed: `The fixture does not seed product-visible sample conversations, agents, harnesses, or runtime rows; temporary rows exist only inside migration cleanup tests.`

noSimulatedRuntimeOutput: `The fixture contains no runtime output.`

noGeneratedWelcome: `The consuming migration test verifies generated welcome rows are removed by version 5 cleanup.`

privateStateExclusions: `Temporary roots are not recorded; private paths, personal account values, and raw credentials are excluded.`

redactionReview: `RelayConsoleMigrationTests redaction check plus branch evidence redaction scan.`

failureHandling: `Any migration test, smoke preflight, build, or diff-hygiene failure blocks migration scaffold closeout.`

activationRequirement: `Screens may cite migration readiness only after their migration family has a manifest and passing consuming check.`

releaseImpact: `This packet verifies only the current version 5 baseline; future migration families remain planned until their own fixture packets and tests pass.`
