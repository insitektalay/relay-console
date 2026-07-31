# UI Fixture Manifest - Settings Integrations Notifications Alerts Harnesses

id: `fix-ui-settings-integrations-notifications-alerts-harnesses-001`

layer: `ui`

productArea: `settings`

requirementIds: `RCSPR-0021`, `RCSPR-0063`, `RCSPR-0064`, `ITC-0008`, `ITC-0049`

sourceMapIds: `SM-0092`, `SM-0093`, `SM-0094`, `SM-0095`, `SM-0096`, `SM-0097`, `SM-0098`, `SM-0099`, `SM-0100`, `SM-0101`, `SM-0102`, `SM-0103`, `SM-0104`, `SM-0105`, `SM-0144`, `SM-0148`, `SM-0151`

featureIds: `FI-0025`, `FI-0075`, `FI-0116`, `FI-0121`

gapOrDecisionIds: `D-0001`, `D-0004`, `PAPERCLIP-EXCLUDED-001`

fixtureKind: `source-backed-ui-contract`

owner: `settings-ui`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `UI source evidence`

sourceBaseline: `AppViewModel.swift`, `Views.swift`, `SettingsStatusService.swift`, `LocalDataService.swift`, `RelayConsoleProfileSettingsTests`, `RelayConsoleVisualEvidenceTests`

files:

- `ui/settings/integrations-notifications-alerts-harnesses-001/manifest.md`
- `../RelayConsoleProfileSettingsTests/ProfileSettingsTests.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `swift run RelayConsoleProfileSettingsTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0049`, `CODE-001-048`

validationCommandIds: `VC-0105`, `VC-0106`, `ITC-0008`

demoIds: `Demo 6`, `Demo 7`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-048-itc-0049-settings-integrations-notifications-alerts-harnesses.md`

surface: `Settings Integrations, Notifications, Alerts, Harnesses, provider/Marketplace/Needed Tools summaries, unread filtering, mark-read controls, in-app notification preferences, read-only setup state`

stateKind: `verified-source`

reasonCode: `settings-integrations-notifications-alerts-source-backed`

decisionIds: `D-0001`, `D-0004`, `PAPERCLIP-EXCLUDED-001`

missingPrerequisites: `Rendered screenshot parity, keyboard traversal, VoiceOver traversal, cloud account lifecycle actions, email/mobile delivery, support/legal/status actions, Paperclip settings, Mission Control host-control, and destructive local lifecycle actions remain excluded or unavailable.`

currentState: `Source checks verify SettingsStatusService-backed integration summaries, Keychain reference counts, Paperclip excluded copy, in-app alert preferences, unread-only filtering, mark-read controls, and Harnesses panel preservation.`

notParityStatement: `This source fixture does not claim rendered screenshot proof, cloud account parity, support/legal/status parity, email/mobile delivery parity, Paperclip parity, Mission Control host-control parity, or release readiness.`

activationRequirement: `Email/mobile notification delivery, Paperclip-equivalent settings, cloud-account settings, support/legal/status actions, and host-control controls must remain hidden or unavailable until retained services, decisions, migrations, and visual/accessibility evidence exist.`

releaseImpact: `Unblocks ITC-0049 source-backed Settings integration/notification/alert/Harness evidence while keeping excluded web-only and host-control surfaces honest.`

determinism: `Static source tests scan fixed Swift anchors; service tests use isolated temporary stores, fixed timestamps, deterministic alert records, deterministic provider snapshots, and relaunch reads.`

noFakeProductSeed: `No product-visible chats, cloud sessions, support tickets, legal records, account lifecycle records, fake connected services, notification delivery destinations, or Paperclip rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output, notification delivery output, provider callback, support/legal action, Mission Control action, or account lifecycle output is generated.`

noGeneratedWelcome: `No generated welcome messages are inserted.`

privateStateExclusions: `Raw tokens, API keys, bearer values, Keychain secret values, private local paths, cloud session metadata, notification delivery addresses, screenshots, prompts, runtime logs, source-host state, and workspace roots are excluded.`

redactionReview: `UI source exposes provider secret-reference counts and redacted alert metadata only; raw credentials, raw Keychain ids, email/mobile destinations, and cloud session values stay out of source-backed fixtures.`

failureHandling: `If Settings exposes raw credentials, fake connected services, Paperclip controls, email/mobile delivery toggles, host-control actions, or claims screenshot/accessibility completion, ITC-0049 UI evidence fails.`
