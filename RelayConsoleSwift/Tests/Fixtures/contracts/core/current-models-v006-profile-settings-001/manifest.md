# Contract Fixture Manifest - Current Models Version 6 Profile Settings

id: `fix-contracts-core-current-models-v006-profile-settings-001`

layer: `contract`

productArea: `profile-workspace`

requirementIds: `RCSPR-0021`, `RCSPR-0058`, `RCSPR-0059`, `RCSPR-0060`, `RCSPR-0061`, `RCSPR-0062`, `RCSPR-0063`, `RCSPR-0064`, `RCSPR-0065`, `RCSPR-0106`, `RCSPR-0122`, `RCSPR-0132`

sourceMapIds: `SM-0092`, `SM-0093`, `SM-0094`, `SM-0095`, `SM-0096`, `SM-0097`, `SM-0098`, `SM-0099`, `SM-0100`, `SM-0101`, `SM-0102`, `SM-0103`, `SM-0104`, `SM-0105`, `SM-0144`, `SM-0148`, `SM-0151`

featureIds: `FI-0025`, `FI-0075`, `FI-0116`, `FI-0121`

gapOrDecisionIds: `D-0004`, `SBD-0003`

fixtureKind: `expected-output`

owner: `contracts`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0009-profile-settings-foundation`

commit: `working-tree`

appVersion: `0.1.0`

capturedAt: `2026-06-22T00:00:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Models.swift`, `LocalDataService.swift`, `screen-contracts/settings/account-appearance-workspace.md`

files:

- `contracts/core/current-models-v006-profile-settings-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0009`

validationCommandIds: `VC-0101`, `VC-0100`, `VC-0002`

branchPacket:
`evidence/branches/codex-itc-0009-profile-settings-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-010-itc-0009-profile-settings-foundation.md`

determinism: `The consuming test decodes fixed profile and workspace samples with v6 fields, decodes v5-shaped samples with v6 defaults, re-encodes with sorted keys, decodes again, and checks equality.`

noFakeProductSeed: `Samples are deterministic contract records only and do not seed product-visible data.`

noSimulatedRuntimeOutput: `Runtime-related samples contain status and redacted metadata only, not simulated runtime output.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, raw credentials, and cloud account state are excluded.`

redactionReview: `Model contract tests verify redacted metadata and secret-reference-only examples.`

failureHandling: `Any Codable, enum raw value, profile/workspace default, optional/null, or secret-reference check failure blocks ITC-0009 closeout.`

releaseImpact: `This packet verifies local model contract expansion only; unsupported web-only settings and cloud account fields remain outside the verified contract.`
