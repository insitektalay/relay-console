id: approvals-permissions-states-001
layer: visual
productArea: work-safety
requirementIds: ITC-0008, ITC-0045, ITC-0046
sourceMapIds: VC-0106, CODE-001-044, CODE-001-045, Demo 5, Demo 8
fixtureKind: source-backed-visual-state-plan
owner: Relay Console Swift
status: planned
secretsPolicy: `Screens must show redacted/summarized native file permission labels and controlled action summaries only; raw paths, bookmark bytes, provider credentials, and file contents are excluded.`
files: `Sources/RelayConsoleApp/Views.swift`, `Sources/RelayConsoleCore/NativeFilePermissionService.swift`, `Sources/RelayConsoleCore/ControlledActionService.swift`, `Sources/RelayConsoleCore/RuntimeActionService.swift`, `Tests/RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`
expectedChecks: `Source checks verify retained native permission service anchors, controlled_action.blocked and controlled_action.dry_run_succeeded audit anchors, SAFETY-001 dry-run gating, fail-closed states, and source-sync/local-app exclusions.`
determinism: `No screenshot parity is claimed; future captures must use deterministic fixture records and stable window sizes.`
noFakeProductSeed: `No product seed rows are required for this visual fixture.`
noSimulatedRuntimeOutput: `No file read/write output, provider write output, local app write output, or task execution output appears in visual evidence.`
noGeneratedWelcome: `No generated welcome content is represented.`
privateStateExclusions: `Paperclip, local source folder, documentation path, provider credentials, generated-pack target, source-host record, local app source record, native bookmark bytes, and linked-source sync controls remain excluded.`
redactionReview: `All visible path labels must contain [REDACTED] or a summarized target label; controlled action rows must show no rawFileContentsPersisted, executionAttempted false, and writeSideEffect false.`
failureHandling: `States must present fail closed: permission_needed, approval_required, blocked_action, decision_gated, rejected, expired, revoked, unavailable, stale, sync_failed, unsupported, not_linked, and read_only-for-write remain blocked or dry-run only.`
notParityStatement: `This fixture is source-backed planning evidence only and does not claim final screenshot, keyboard, or VoiceOver parity.`
activationRequirement: `Controlled writes remain disabled/dry-run-only until native permission, approval, policy, audit, manual evidence gates, and SAFETY-001 first-release write scope pass.`
