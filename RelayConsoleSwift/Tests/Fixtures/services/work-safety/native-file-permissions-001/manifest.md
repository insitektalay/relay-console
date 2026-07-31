id: native-file-permissions-001
layer: services
productArea: work-safety
requirementIds: ITC-0039, ITC-0045
sourceMapIds: VC-0102, CODE-001-039, CODE-001-044, Demo 5, Demo 8
fixtureKind: service-contract
owner: Relay Console Swift
status: active
secretsPolicy: `Raw local paths, native bookmark bytes, and raw file contents must not be persisted or copied into audit records.`
files: `Sources/RelayConsoleCore/NativeFilePermissionService.swift`, `Sources/RelayConsoleCore/LocalDataService.swift`, `Tests/RelayConsoleServiceTests/ServiceTests.swift`
expectedChecks: `RelayConsoleServiceTests covers first link, permission request, denied permission, revoked access, read-only file, read/write granted folder, stale source, sync failure, retry/restored access, unlink, and relaunch recovery.`
determinism: `The test uses deterministic timestamps and opaque bookmark references; no native file prompt, source sync, or file IO is performed.`
noFakeProductSeed: `Records are created only by NativeFilePermissionService during the service test.`
noSimulatedRuntimeOutput: `The fixture records retained permission state only; task execution output and file contents are excluded.`
noGeneratedWelcome: `No generated welcome messages are inserted.`
privateStateExclusions: `Local source folder, documentation path, Paperclip-linked file, generated-pack write target, source-host record, local app source record, and source-sync behavior remain excluded.`
redactionReview: `display_path is summarized with [REDACTED], bookmark_ref/path_hash are opaque, metadata and audit contexts are sanitized, and raw path sentinels are absent from persisted rows.`
failureHandling: `File reads/writes fail closed when authorization is missing, policy denied, approval pending, revoked, stale, unavailable, sync-failed, or read-only for write access.`
states: `not_linked, permission_needed, linked, read_only, read_write_granted, revoked, unavailable, synced, stale, sync_failed.`
approval-required: `High-risk controlled writes remain blocked until approval and policy gates authorize them; this fixture does not execute writes.`
standalone Approvals: `Standalone Approvals remain excluded; this fixture uses task/action references only as retained metadata.`
task execution output: `No task output is generated or stored.`
