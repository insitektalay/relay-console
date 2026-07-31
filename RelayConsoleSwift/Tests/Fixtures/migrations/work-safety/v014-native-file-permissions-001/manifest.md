id: v014-native-file-permissions-001
layer: migrations
productArea: work-safety
requirementIds: ITC-0045
sourceMapIds: VC-0100, CODE-001-044
fixtureKind: schema-contract
owner: Relay Console Swift
status: active
secretsPolicy: `No native bookmark bytes, raw local file paths, raw file contents, credentials, or source-host payloads are seeded.`
files: `Sources/RelayConsoleCore/Migrations.swift`, `Tests/RelayConsoleMigrationTests/MigrationTests.swift`
expectedChecks: `RelayConsoleMigrationTests verifies schema version 24, native_file_permissions columns, workspace/status and retained-record indexes, and no seeded product rows.`
determinism: `Migration creates schema only and does not depend on host file handles or native permission prompts.`
noFakeProductSeed: `No native_file_permissions rows are seeded by migration.`
noSimulatedRuntimeOutput: `The migration stores no task execution output and performs no file read/write side effects.`
noGeneratedWelcome: `No generated chat messages or welcome rows are inserted.`
privateStateExclusions: `Raw local paths, bookmark bytes, Paperclip links, local source folder records, documentation paths, generated-pack targets, and source-sync records remain excluded.`
redactionReview: `Persisted display_path is a redacted/summarized label, path_hash and bookmark_ref are opaque, and permission_json is sanitized by LocalDataService.`
failureHandling: `File access remains fail-closed until NativeFilePermissionService records an authorized retained permission state.`
tableCoverage: `native_file_permissions with workspace/status, target hash, task, tool request, and action run indexes.`
