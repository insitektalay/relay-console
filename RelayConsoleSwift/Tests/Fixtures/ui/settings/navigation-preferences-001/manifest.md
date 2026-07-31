# UI Fixture Manifest - Settings Navigation Preferences

id: `fix-ui-settings-navigation-preferences-001`

layer: `ui`

productArea: `settings`

requirementIds: `RCSPR-0021`, `RCSPR-0058`, `RCSPR-0063`, `RCSPR-0064`, `ITC-0008`, `ITC-0047`

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

sourceBaseline: `AppViewModel.swift`, `Views.swift`, `LocalDataService.swift`, `RelayConsoleProfileSettingsTests`, `RelayConsoleVisualEvidenceTests`

files:

- `ui/settings/navigation-preferences-001/manifest.md`
- `../RelayConsoleProfileSettingsTests/ProfileSettingsTests.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `swift run RelayConsoleProfileSettingsTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0047`, `CODE-001-046`

validationCommandIds: `VC-0105`, `VC-0106`, `ITC-0008`

demoIds: `Demo 6`, `Demo 7`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-046-itc-0047-settings-navigation-preferences.md`

surface: `Settings sidebar, Account, Appearance, Workspace, Team & members, Integrations, Notifications, Security, Harnesses, selected panel preference, read-only and unavailable states`

stateKind: `verified-source`

reasonCode: `settings-navigation-preferences-source-backed`

decisionIds: `D-0001`, `D-0004`, `PAPERCLIP-EXCLUDED-001`

missingPrerequisites: `Rendered screenshot parity, keyboard traversal, VoiceOver traversal, cloud account lifecycle actions, email/mobile delivery, support/legal/status actions, Paperclip settings, Mission Control host-control, and destructive local lifecycle actions remain excluded or unavailable.`

currentState: `Source checks verify retained Settings navigation panes, service-backed selected panel persistence, disabled save states for read-only workspace controls, and unavailable copy for future Integrations, Notifications delivery, and Security cloud-account scope.`

notParityStatement: `This source fixture does not claim rendered screenshot proof, cloud account parity, support/legal/status parity, email/mobile delivery parity, Paperclip parity, Mission Control host-control parity, or release readiness.`

activationRequirement: `Future panes must remain unavailable until the corresponding retained service, decision gate, migration, and visual/accessibility evidence exists.`

releaseImpact: `Unblocks ITC-0047 source-backed Settings navigation and preference evidence while keeping excluded web-only account, delivery, and host-control surfaces honest.`

determinism: `Static source tests scan fixed Swift anchors; service tests use isolated temporary stores and fixed panel raw values for account, appearance, workspace, team, integrations, notifications, security, and harnesses.`

noFakeProductSeed: `No product-visible chats, agents, notifications, provider connections, cloud sessions, support tickets, legal records, account lifecycle records, or Paperclip rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output, notification delivery output, provider callback, support/legal action, Mission Control action, or account lifecycle output is generated.`

noGeneratedWelcome: `No generated welcome messages are inserted.`

privateStateExclusions: `Raw tokens, API keys, bearer values, private local paths, account emails beyond redacted deterministic test values, cloud session metadata, notification delivery addresses, screenshots, prompts, runtime logs, source-host state, and workspace roots are excluded.`

redactionReview: `The fixture stores panel keys only; profile, workspace, credential, delivery, cloud-account, and session values remain outside this UI fixture.`

failureHandling: `If Settings loses a retained pane, accepts standalone Approvals as a Settings panel, persists private state in panel preferences, enables future cloud/delivery/support/legal/Paperclip/Mission Control controls, or claims screenshot/accessibility completion, ITC-0047 UI evidence fails.`
