id: runtime-workspace-manager-001
layer: services
productArea: agents
requirementIds: ITC-0025, ITC-0045, ITC-0053
sourceMapIds: VC-0102, RCSPR-0029, RCSPR-0030, CODE-001-044, Demo 7, Demo 8
fixtureKind: service-contract
owner: Relay Console Swift
status: active
secretsPolicy: `Raw local paths, security-scoped bookmark bytes, .env values, and private workspace roots must not be persisted in fixture evidence.`
files: `Sources/RelayConsoleCore/RuntimeWorkspaceService.swift`, `Sources/RelayConsoleApp/RuntimeWorkspaceViews.swift`, `Tests/RelayConsoleServiceTests/ServiceTests.swift`
expectedChecks: `RelayConsoleServiceTests covers OpenClaw roots, Hermes profile/workspace/session/shared/project/global-session roots, user-facing Agent Instructions/Agent Memory/Agent Skills classification for Hermes and OpenClaw, hidden config/log/database runtime internals in the classified views, editable Hermes SOUL.md/profile.yaml/config.yaml visibility in the advanced tree, read-only Hermes logs/state/session handling, empty tree loading, Markdown save/read/delete, PNG import/export, create subfolder, read-only Sessions denial, linked local permission summary, guarded sync-failed state, baseline create/update/delete, and unknown-root error handling.`
determinism: `The service test uses temporary app support paths, deterministic timestamps, fixed runtime identities, and local fixture files; no backend, web loopback, host desktop prompt, or real harness process is required.`
noFakeProductSeed: `The fixture creates retained local agents and real temporary workspace files only for the service test.`
noSimulatedRuntimeOutput: `No runtime transcript, generated model output, fake dispatch output, or simulated sync result is inserted.`
noGeneratedWelcome: `No generated welcome messages are inserted.`
privateStateExclusions: `Local link paths are summarized through NativeFilePermissionService, raw bookmark data is not stored, .env contents are not expanded, and evidence excludes private absolute paths.`
redactionReview: `Linked local storage is checked for the private path sentinel; retained permission display paths use [REDACTED].`
failureHandling: `Read-only Sessions writes are rejected, unknown roots return an error state, sync from/to local reports sync_failed until persisted security-scoped bookmark resolution is enabled, and roots do not fabricate file rows.`
states: `loading, empty, populated, selected, error, read_only, not_linked, read_write_granted, sync_failed.`
notParityStatement: `Native file/folder picker links retained permission metadata, but linked local sync execution remains guarded; this fixture does not claim full bidirectional local sync parity.`
