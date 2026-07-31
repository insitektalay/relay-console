# Contract Fixture Manifest - Current Models Version 5

id: `fix-contracts-core-current-models-v005-001`

layer: `contract`

productArea: `core`

requirementIds: `RCSPR-0100`, `RCSPR-0144`

sourceMapIds: `SM-0116`, `SM-0145`, `SM-0154`

featureIds: `FI-0081`, `FI-0083`, `FI-0135`

gapOrDecisionIds: `SBD-0001`

fixtureKind: `expected-output`

owner: `contracts`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0004-0005-migration-contract-scaffold`

commit: `69b6e30`

appVersion: `0.1.0`

capturedAt: `2026-06-22T19:16:05Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Models.swift`, `source-map.md`, `fixture-catalog.md`

files:

- `contracts/core/current-models-v005-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`
- `swift run RelayConsoleMigrationTests`
- `swift run RelayConsoleCoreSmokeTests`

implementationTaskIds: `ITC-0005`

validationCommandIds: `VC-0101`, `VC-0100`, `VC-0002`

branchPacket:
`evidence/branches/codex-itc-0004-0005-migration-contract-scaffold/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-006-itc-0005-model-contract-scaffold.md`

determinism: `The consuming test decodes fixed JSON samples into current version 5 Swift models, re-encodes with sorted keys, decodes again, and checks equality.`

noFakeProductSeed: `Samples are deterministic contract records only and do not seed product-visible data.`

noSimulatedRuntimeOutput: `Runtime-related samples contain status and redacted metadata only, not simulated runtime output.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, and raw credentials are excluded.`

redactionReview: `Model contract tests verify redacted metadata and secret-reference-only examples.`

failureHandling: `Any Codable, enum raw value, optional/null, or secret-reference check failure blocks contract scaffold closeout.`
