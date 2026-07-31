id: v025-alerts-notifications-001
layer: migrations
productArea: settings
requirementIds: ITC-0049
sourceMapIds: VC-0100, CODE-001-048
fixtureKind: schema-contract
owner: Relay Console Swift
status: active
secretsPolicy: `No raw credentials, notification addresses, device tokens, cloud account payloads, or local private state are seeded.`
files: `Sources/RelayConsoleCore/Migrations.swift`, `Tests/RelayConsoleMigrationTests/MigrationTests.swift`
expectedChecks: `RelayConsoleMigrationTests verifies schema version 25, settings_alerts columns/indexes, settings_notification_preferences columns/indexes, and empty product tables after migration.`
determinism: `Migration creates schema only and uses no host state, no notification provider, no backend call, and no runtime output.`
noFakeProductSeed: `No settings_alerts or settings_notification_preferences rows are seeded by migration.`
noSimulatedRuntimeOutput: `The migration stores no notification delivery output, runtime transcript output, support/legal action output, provider callback output, or harness output.`
noGeneratedWelcome: `No generated welcome messages are inserted.`
privateStateExclusions: `Raw credentials, Keychain material, email/mobile destinations, cloud sessions, Paperclip records, host-control state, source-host payloads, and local paths remain excluded.`
redactionReview: `Alert and preference JSON columns are populated only by LocalDataService sanitizers; migration itself stores no private rows.`
failureHandling: `If schema version 25 does not create the two settings tables and indexes, or if migration seeds product-visible rows, ITC-0049 schema evidence fails.`
tableCoverage: `settings_alerts with workspace/read/expiry/source indexes; settings_notification_preferences with workspace/profile scope and workspace indexes.`

