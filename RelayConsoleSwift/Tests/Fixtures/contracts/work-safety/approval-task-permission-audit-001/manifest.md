# Contract Fixture Manifest - Work Safety Approval Task Permission Audit

id: `fix-contract-work-safety-approval-task-permission-audit-001`

layer: `contract`

productArea: `work-safety`

requirementIds: `RCSPR-0005`, `RCSPR-0006`, `RCSPR-0095`, `RCSPR-0124`, `RCSPR-0175`, `RCSPR-0176`, `RCSPR-0177`, `RCSPR-0188`, `ITC-0038`, `ITC-0042`

sourceMapIds: `SM-0055`, `SM-0056`, `SM-0057`, `SM-0058`, `SM-0059`, `SM-0060`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0159`

featureIds: `FI-0041`, `FI-0042`, `FI-0043`, `FI-0044`, `FI-0045`, `FI-0046`, `FI-0165`, `FI-0166`, `FI-0167`

gapOrDecisionIds: `ITC-0038`, `ITC-0039`, `ITC-0040`, `ITC-0041`, `ITC-0042`, `APPROVALS-NAV-EXCLUDED-001`

fixtureKind: `work-safety-codable-model-contract`

owner: `work-safety-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `contract-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `contract evidence`

sourceBaseline: `Models.swift`, `LocalDataService.swift`, `ModelContractTests.swift`

files:

- `contracts/work-safety/approval-task-permission-audit-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`
- `../../Sources/RelayConsoleCore/Models.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0038`, `ITC-0041`, `ITC-0042`, `CODE-001-038`, `CODE-001-041`, `CODE-001-042`

validationCommandIds: `VC-0101`

demoIds: `Demo 5`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-038-itc-0038-task-approval-migration-foundation.md`,
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-041-itc-0041-permission-policy-local-authority.md`

surface: `WorkSafetyTaskRecord, WorkSafetyTaskRunRecord, WorkSafetyTaskEventRecord, WorkSafetyApprovalRecord, WorkSafetyApprovalStepRecord, WorkSafetyApprovalNoteRecord, PermissionPolicyRecord, PermissionPolicyEvaluation, AuditLogRecord, AuditLogPage, and SecurityMetricSnapshot`

stateKind: `verified-contract`

reasonCode: `task-approval-contract`

decisionIds: `APPROVALS-NAV-EXCLUDED-001`

missingPrerequisites: `Standalone Approvals navigation, audit/security UI proof, executable task dispatch, controlled writes, native file access, and release aggregation remain later evidence.`

currentState: `Contracts cover pending, approved, rejected, expired, cancelled, failed, queued, dispatched, blocked-by-approval, linked task/action/run/source-host/scheduled-message references, permission policy allow/deny/evaluation records, audit log records, security metric snapshots, redaction status, and no-executable-work boundaries.`

notParityStatement: `This fixture does not claim standalone Approvals UI, executable task dispatch, provider write execution, source-host/local app parity, controlled writes, native file access, or release readiness.`

activationRequirement: `Service evidence must prove WorkSafetyTaskRecord and WorkSafetyApprovalRecord are durable, redacted, evented, and inert before downstream UI or safety cards consume them.`

releaseImpact: `Provides stable Codable surfaces for ITC-0038 migration, ITC-0041 authority, and ITC-0042 audit/security foundations.`

determinism: `Contract tests use fixed ids, timestamps, statuses, linked references, and redacted JSON round trips.`

noFakeProductSeed: `No product-visible task, approval, action-run, source-host, scheduled-message, or audit rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output, approval result, command output, provider result, or task execution output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, source-host records, raw command environments, auth/session data, runtime logs, and local filesystem roots are excluded.`

redactionReview: `Contract examples use redacted values and require private-state-excluded status on persisted records.`

failureHandling: `If WorkSafety task, approval, permission, audit, or security metric models lose linked references, status vocabulary, redaction fields, standalone Approvals exclusion, admin-only audit-read boundary, or no-executable-work scope, ITC-0038/ITC-0042 evidence must be downgraded.`
