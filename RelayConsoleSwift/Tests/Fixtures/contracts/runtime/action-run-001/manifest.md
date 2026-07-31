# Contract Fixture Manifest - Runtime Action Run

id: `fix-contract-runtime-action-run-001`

layer: `contract`

productArea: `runtime`

requirementIds: `RCSPR-0006`, `RCSPR-0044`, `RCSPR-0045`, `RCSPR-0095`, `RCSPR-0109`, `RCSPR-0124`, `RCSPR-0133`, `RCSPR-0176`, `ITC-0046`

sourceMapIds: `SM-0071`, `SM-0072`, `SM-0075`, `SM-0076`, `SM-0078`, `SM-0145`, `SM-0148`, `SM-0151`, `SM-0159`

featureIds: `FI-0051`, `FI-0052`, `FI-0117`, `FI-0126`, `FI-0166`, `FI-0167`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

fixtureKind: `runtime-action-run-contract`

owner: `runtime-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `contract-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `contract evidence`

sourceBaseline: `Models.swift`, `RuntimeActionService.swift`, `ControlledActionService.swift`, `ModelContractTests.swift`

files:

- `contracts/runtime/action-run-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`
- `../../Sources/RelayConsoleCore/Models.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0030`

validationCommandIds: `VC-0101`

demoIds: `Demo 4`, `Demo 5`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-031-itc-0030-runtime-action-runs.md`

surface: `RuntimeActionCapability, RuntimeActionRun, and ControlledActionRequest retained contract`

stateKind: `verified-contract`

reasonCode: `runtime-action-run-contract`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

missingPrerequisites: `SAFETY-001 first-release write scope remains open, so controlled writes are retained dry-run evidence only and do not execute.`

currentState: `RuntimeActionCapability and RuntimeActionRun encode unsupported, destructive-blocked, missing-capability, dry-run, rejected, failed, running, succeeded, cancelled, and stale states with guard reason codes, actor/scope metadata, idempotency keys, retention timestamps, and redaction status. ControlledActionRequest covers controlled_file_write and controlled_provider_write payload shape, approval id, native file permission id, rawFileContentsPersisted false, and SAFETY-001 dry-run gating.`

notParityStatement: `This fixture does not claim host-control parity, local command execution, live controlled write execution, provider write side effects, file write side effects, or release readiness.`

activationRequirement: `Service evidence must prove idempotency reuse, approval/policy/native-permission gates, audit records, redaction, and non-execution before UI surfaces cite controlled action-run history.`

releaseImpact: `Provides stable model coverage for ITC-0030 action-run records.`

determinism: `The contract fixture uses fixed ids, fixed timestamps, redacted strings, and JSON round trips.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, raw command environments, and runtime logs are excluded.`

redactionReview: `Contract examples use redacted values and explicitly state host-control exclusion.`

failureHandling: `If RuntimeActionRun drops idempotency, actor/scope, status, guard reason, retention, or host-control exclusion fields, ITC-0030 evidence must be downgraded.`
