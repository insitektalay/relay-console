# Service Fixture Manifest - Profile Workspace Settings Save

id: `fix-services-profile-workspace-profile-save-settings-001`

layer: `service`

productArea: `profile-workspace`

requirementIds: `RCSPR-0021`, `RCSPR-0058`, `RCSPR-0059`, `RCSPR-0060`, `RCSPR-0061`, `RCSPR-0062`, `RCSPR-0063`, `RCSPR-0064`, `RCSPR-0065`, `RCSPR-0106`, `RCSPR-0122`, `RCSPR-0132`, `ITC-0048`

sourceMapIds: `SM-0092`, `SM-0093`, `SM-0094`, `SM-0095`, `SM-0096`, `SM-0097`, `SM-0098`, `SM-0099`, `SM-0100`, `SM-0101`, `SM-0102`, `SM-0103`, `SM-0104`, `SM-0105`, `SM-0144`, `SM-0148`, `SM-0151`

featureIds: `FI-0025`, `FI-0075`, `FI-0116`, `FI-0121`

gapOrDecisionIds: `D-0004`, `SBD-0003`

fixtureKind: `evidence`

owner: `services`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0009-profile-settings-foundation`

commit: `working-tree`

appVersion: `0.1.0`

capturedAt: `2026-06-22T00:00:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `LocalDataService.swift`, `SettingsPreferenceService.swift`, `RelayConsoleServices.swift`, `AppViewModel.swift`, `Views.swift`

files:

- `services/profile-workspace/profile-save-settings-001/manifest.md`
- `../RelayConsoleProfileSettingsTests/ProfileSettingsTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleProfileSettingsTests`
- `swift run RelayConsoleServiceTests`
- `swift build`

implementationTaskIds: `ITC-0009`, `ITC-0048`

validationCommandIds: `VC-0102`, `VC-0001`, `VC-0002`, `VC-0003`

demoIds: `Demo 1`, `Demo 6`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0009-profile-settings-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-010-itc-0009-profile-settings-foundation.md`,
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-047-itc-0048-settings-services.md`

determinism: `The consuming service test uses temporary local data roots, stable profile/workspace names, deterministic setting keys, owner/admin and viewer/member role contexts, fixed workspace counts, settingsProfileUpdated/settingsWorkspaceUpdated events, and reopen checks against the same root.`

noFakeProductSeed: `The fixture does not seed product-visible sample conversations, fake agents, fake harnesses, runtime output, cloud accounts, or lifecycle state.`

noSimulatedRuntimeOutput: `The fixture contains no runtime output.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Temporary roots are not recorded; private paths, personal account values, and raw credentials are excluded.`

redactionReview: `RelayConsoleProfileSettingsTests uses example.test account values and data-url fixture bytes only; branch evidence includes a scoped redaction scan.`

failureHandling: `Any profile update, avatar removal, appearance theme default, workspace stats, owner/admin workspace mutation, viewer/member read-only denial, legacy migration, workspace selection, relaunch, service, smoke, build, or diff-hygiene failure blocks ITC-0009 and ITC-0048 closeout.`

activationRequirement: `Later Settings UI parity may rely on these services only while decision-gated support/legal/cloud/account lifecycle controls remain unavailable or separately approved.`

releaseImpact: `This packet verifies durable local account, appearance, workspace, Team routing source, and SettingsPreferenceService boundaries only. It does not activate cloud account, support/legal, destructive lifecycle, delivery settings, or full release parity.`
