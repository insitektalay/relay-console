# Contract Fixture Manifest - JSON Value Round Trip

id: `fix-contracts-core-json-value-roundtrip-001`

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

sourceBaseline: `Models.swift`, `fixture-catalog.md`,
`validation-command-registry.md`

files:

- `contracts/core/json-value-roundtrip-001/manifest.md`
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

determinism: `The consuming test uses a fixed JSONValue object with stable array ordering and redacted metadata.`

noFakeProductSeed: `This fixture does not seed product-visible data.`

noSimulatedRuntimeOutput: `This fixture contains no runtime output.`

noGeneratedWelcome: `This fixture contains no generated welcome content.`

privateStateExclusions: `Private paths, personal account values, and raw credentials are excluded.`

redactionReview: `Model contract tests plus branch evidence redaction scan.`

failureHandling: `Any JSONValue round-trip failure blocks contract scaffold closeout.`
