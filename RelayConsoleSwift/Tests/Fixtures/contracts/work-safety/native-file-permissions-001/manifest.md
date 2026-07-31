id: native-file-permissions-001
layer: contracts
productArea: work-safety
requirementIds: ITC-0045
sourceMapIds: VC-0101, CODE-001-044, Demo 5, Demo 8
fixtureKind: model-contract
owner: Relay Console Swift
status: active
secretsPolicy: `NativeFilePermissionRecord stores redacted display state and opaque references only; raw local paths, bookmark bytes, and file contents are excluded.`
files: `Sources/RelayConsoleCore/Models.swift`, `Tests/RelayConsoleModelContractTests/ModelContractTests.swift`
expectedChecks: `RelayConsoleModelContractTests round-trips NativeFilePermissionRecord and verifies target/access/status raw values.`
determinism: `All timestamps, ids, statuses, and opaque refs are deterministic contract values.`
noFakeProductSeed: `Contract JSON is test-only and does not seed product storage.`
noSimulatedRuntimeOutput: `No task execution output, file read result, or generated write artifact is represented.`
noGeneratedWelcome: `No generated chat rows are included.`
privateStateExclusions: `Paperclip, local source folders, documentation paths, generated-pack targets, source-host records, local app source records, and source-sync payloads remain excluded.`
redactionReview: `displayPath uses [REDACTED], pathHash/bookmarkRef are opaque, and metadata states rawPathPersisted=false.`
failureHandling: `Native file access must fail closed when permission is missing, denied by policy, approval pending, revoked, stale, unavailable, sync-failed, or read-only for write.`
models: `NativeFilePermissionRecord, NativeFilePermissionTargetKind, NativeFilePermissionAccessLevel, NativeFilePermissionStatus.`
