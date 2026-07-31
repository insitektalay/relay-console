id: harness-alert-report-001
layer: services
productArea: settings
requirementIds: ITC-0049
sourceMapIds: VC-0102, CODE-001-048, Demo 6, Demo 7
fixtureKind: service-contract
owner: Relay Console Swift
status: active
secretsPolicy: `SettingsStatusService must expose counts and secret-reference-only metadata, never raw credentials, Keychain values, cloud session payloads, notification destinations, or device tokens.`
files: `Sources/RelayConsoleCore/SettingsStatusService.swift`, `Sources/RelayConsoleCore/LocalDataService.swift`, `Tests/RelayConsoleProfileSettingsTests/ProfileSettingsTests.swift`
expectedChecks: `RelayConsoleProfileSettingsTests verifies SettingsStatusService alert list/count/read/read-all, unread-only filtering, expired alert behavior, notification preference persistence, relaunch recovery, admin/non-admin integration setup state, settingsAlertUpdated, settingsNotificationPreferencesUpdated, settingsIntegrationSummaryUpdated, and provider secret-reference-only summary redaction.`
determinism: `The service test uses isolated temporary stores, fixed ISO timestamps, deterministic Harness/provider/Marketplace/Needed Tools snapshots, and relaunch reads.`
noFakeProductSeed: `No product-visible chats, account lifecycle records, cloud sessions, support/legal records, Paperclip rows, fake connected services, or notification delivery destinations are seeded.`
noSimulatedRuntimeOutput: `No runtime transcript output, notification delivery output, provider callback, support/legal action, Mission Control action, or account lifecycle output is generated.`
noGeneratedWelcome: `No generated welcome messages are inserted.`
privateStateExclusions: `Paperclip, raw credentials, bearer/API keys, OAuth tokens, raw Keychain values, email/mobile delivery controls, cloud account linking, support/legal/status actions, Mission Control host-control, and destructive local lifecycle actions remain excluded or unavailable.`
redactionReview: `Fixture metadata includes a secret-like value that must be redacted; provider secrets remain secret-reference-only and summary output reports counts without raw ids.`
failureHandling: `If alerts do not persist read state, expired alerts are included by default, notification preferences expose email/mobile delivery unavailable controls as editable, raw secret values appear, or read-only integration setup is not enforced, ITC-0049 service evidence fails.`
notes: `email/mobile delivery unavailable; Paperclip excluded; secret-reference-only provider metadata.`

