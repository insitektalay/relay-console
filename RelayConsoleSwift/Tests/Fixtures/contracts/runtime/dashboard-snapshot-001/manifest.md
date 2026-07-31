# Contract Fixture Manifest - Runtime Dashboard Snapshot

id: `fix-contract-runtime-dashboard-snapshot-001`

layer: `contract`

productArea: `runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0087`, `RCSPR-0093`

sourceMapIds: `SM-0042`, `SM-0077`, `SM-0133`

featureIds: `FI-0031`, `FI-0055`, `FI-0097`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

fixtureKind: `runtime-dashboard-contract`

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

sourceBaseline: `Models.swift`, `RuntimeDashboardService.swift`, `ModelContractTests.swift`

files:

- `contracts/runtime/dashboard-snapshot-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`
- `../../Sources/RelayConsoleCore/Models.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0029`

validationCommandIds: `VC-0101`

demoIds: `Demo 4`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-030-itc-0029-runtime-dashboard-snapshots.md`

surface: `RuntimeDashboardSnapshot read-only contract`

stateKind: `verified-contract`

reasonCode: `runtime-dashboard-read-model-contract`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

missingPrerequisites: `Applications UI rendering and real-harness evidence remain separate acceptance rows.`

currentState: `RuntimeDashboardSnapshot, RuntimeDashboardRow, and RuntimeDashboardAssignedAgentIndicator encode loading, empty, populated, offline, disabled, stale, error, and retry states; rows are read-only and derived from retained harness, binding, dispatch, and event records.`

notParityStatement: `This fixture does not claim Mission Control host-control parity, local process status, connected-app fabrication, local runtime actions, or release readiness.`

activationRequirement: `Service and visual evidence must prove the contract is persisted and presented without fabricating connected apps.`

releaseImpact: `Provides stable model coverage for ITC-0029 runtime dashboard snapshots.`

determinism: `The contract fixture uses fixed ids, fixed timestamps, redacted strings, and JSON round trips.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, raw command environments, and runtime logs are excluded.`

redactionReview: `Contract examples use redacted values and assert host-control exclusion through the local status disabled fields.`

failureHandling: `If RuntimeDashboardSnapshot drops read-only, redaction, stale, retry, or host-control exclusion fields, ITC-0029 evidence must be downgraded.`
