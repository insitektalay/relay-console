# Migration Fixture Manifest - Version 6 Profile Preferences

id: `fix-migrations-profile-workspace-v006-profile-preferences-001`

layer: `migration`

productArea: `profile-workspace`

requirementIds: `RCSPR-0021`, `RCSPR-0058`, `RCSPR-0059`, `RCSPR-0060`, `RCSPR-0061`, `RCSPR-0062`, `RCSPR-0063`, `RCSPR-0064`, `RCSPR-0065`, `RCSPR-0106`, `RCSPR-0122`, `RCSPR-0132`, `ITC-0047`

sourceMapIds: `SM-0092`, `SM-0093`, `SM-0094`, `SM-0095`, `SM-0096`, `SM-0097`, `SM-0098`, `SM-0099`, `SM-0100`, `SM-0101`, `SM-0102`, `SM-0103`, `SM-0104`, `SM-0105`, `SM-0144`, `SM-0148`, `SM-0151`

featureIds: `FI-0025`, `FI-0075`, `FI-0116`, `FI-0121`

gapOrDecisionIds: `D-0004`, `SBD-0003`

fixtureKind: `evidence`

owner: `persistence`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0009-profile-settings-foundation`

commit: `working-tree`

appVersion: `0.1.0`

capturedAt: `2026-06-22T00:00:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Migrations.swift`, `Models.swift`, `LocalDataService.swift`, `Tests/RelayConsoleMigrationTests/MigrationTests.swift`

files:

- `migrations/profile-workspace/v006-profile-preferences-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../RelayConsoleProfileSettingsTests/ProfileSettingsTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`
- `swift run RelayConsoleProfileSettingsTests`
- `git diff --check -- .`

implementationTaskIds: `ITC-0009`, `ITC-0047`

validationCommandIds: `VC-0100`, `VC-0001`, `VC-0002`, `VC-0003`

demoIds: `Demo 1`, `Demo 6`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0009-profile-settings-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-010-itc-0009-profile-settings-foundation.md`

determinism: `The consuming tests create temporary SQLite stores, apply the fixed migration registry, insert stable legacy profile and workspace ids, verify stable v6 profile and workspace defaults, and pair that durable settings foundation with ITC-0047 selected Settings panel preference checks.`

noFakeProductSeed: `The fixture does not seed product-visible sample conversations, agents, harnesses, runtime output, or cloud account data.`

noSimulatedRuntimeOutput: `The fixture contains no runtime output.`

noGeneratedWelcome: `No generated welcome content is included, and the existing v5 cleanup remains covered by RelayConsoleMigrationTests.`

privateStateExclusions: `Private paths, personal account values, raw credentials, and account lifecycle state are excluded.`

redactionReview: `RelayConsoleMigrationTests and RelayConsoleProfileSettingsTests use redacted deterministic values only; branch evidence includes a scoped redaction scan.`

failureHandling: `Any migration, profile settings, selected Settings panel persistence, smoke, build, or diff-hygiene failure blocks ITC-0009 and ITC-0047 closeout.`

activationRequirement: `Later Settings panes may consume this foundation only after migration, service, model contract, relaunch, and unavailable decision-gate evidence remain current.`

releaseImpact: `This packet verifies only durable local profile, workspace, selected Settings panel, and settings foundations. Cloud account, support/legal, destructive lifecycle, delivery settings, and full Settings parity remain decision-gated or later-scope work.`
