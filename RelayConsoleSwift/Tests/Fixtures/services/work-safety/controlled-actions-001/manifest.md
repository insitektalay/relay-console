id: controlled-actions-001
layer: services
productArea: work-safety
requirementIds: ITC-0039, ITC-0046
sourceMapIds: VC-0102, CODE-001-039, CODE-001-045, Demo 5, Demo 8
fixtureKind: service-contract
owner: Relay Console Swift
status: active
secretsPolicy: `Raw local paths, credentials, provider payloads, native bookmark bytes, and raw file contents must not be persisted or copied into audit records.`
files: `Sources/RelayConsoleCore/ControlledActionService.swift`, `Sources/RelayConsoleCore/RuntimeActionService.swift`, `Sources/RelayConsoleCore/NativeFilePermissionService.swift`, `Tests/RelayConsoleServiceTests/ServiceTests.swift`
expectedChecks: `RelayConsoleServiceTests covers controlled_file_write and controlled_provider_write capabilities, pending approval rejection, approved dry-run, native file permission required, stale permission retryable failure, unsupported action recording, viewer authority denial, policy block, controlled_action.blocked, controlled_action.dry_run_succeeded, controlled_action.unsupported audit rows, idempotency, redaction, and relaunch recovery.`
determinism: `The test uses deterministic timestamps, fixed idempotency keys, fixed task-scoped approvals, retained native file permission records, and isolated temporary stores.`
noFakeProductSeed: `Records are created only by ControlledActionService, WorkSafetyTaskService, NativeFilePermissionService, RuntimeActionService, and PermissionPolicyService during the service test.`
noSimulatedRuntimeOutput: `The fixture records retained gate decisions only; task execution output, runtime transcript output, provider writes, local app writes, and file contents are excluded.`
noGeneratedWelcome: `No generated welcome messages are inserted.`
privateStateExclusions: `Local source folder, documentation path, provider credentials, Paperclip-linked file, generated-pack write target, source-host record, local app source record, native bookmark bytes, and source-sync behavior remain excluded.`
redactionReview: `Runtime action requests/results/failures, permission policy metadata, native file permission metadata, audit contexts, and event log details are sanitized; raw path and credential sentinels are absent from persisted rows.`
failureHandling: `Controlled actions fail closed when approval is missing, approval is pending, native permission is missing, native permission is stale, policy denies execute, the actor lacks authority, the action kind is unsupported, or SAFETY-001 has not approved first-release write scope.`
states: `dry_run, rejected, stale, unsupported, approval_required, permission_needed, blocked_action, decision_gated.`
approval-required: `Approval-required controlled writes do not execute before task-scoped approval; after approval they remain dry-run because SAFETY-001 is still open.`
standalone Approvals: `Standalone Approvals remain excluded; the fixture uses retained task-scoped approvals only.`
task execution output: `No task output is generated or stored.`
writeSideEffect: `false`
