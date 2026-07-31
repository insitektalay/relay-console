# Service Fixture Manifest - Runtime Dashboard Snapshot

id: `fix-service-runtime-dashboard-snapshot-001`

layer: `service`

productArea: `runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0087`, `RCSPR-0093`

sourceMapIds: `SM-0042`, `SM-0077`, `SM-0133`

featureIds: `FI-0031`, `FI-0055`, `FI-0097`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

fixtureKind: `runtime-dashboard-service`

owner: `runtime-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `service-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `RuntimeDashboardService.swift`, `LocalDataService.swift`, `ServiceTests.swift`

files:

- `services/runtime/dashboard-snapshot-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/RuntimeDashboardService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0029`

validationCommandIds: `VC-0102`

demoIds: `Demo 4`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-030-itc-0029-runtime-dashboard-snapshots.md`

surface: `Runtime dashboard retained read-only service`

stateKind: `verified-service`

reasonCode: `runtime-dashboard-durable-read-model`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

missingPrerequisites: `Manual Applications dashboard screenshots, real-harness observations, and UI release evidence remain planned separately.`

currentState: `RuntimeDashboardService persists loading, empty, disabled, retry, stale, and populated-compatible snapshots; derives runtime rows only from retained harness, runtime binding, dispatch, and event records; marks local status disabled for Mission Control host-control exclusion; and keeps connected-app count at zero unless backed by rows.`

notParityStatement: `This fixture does not claim Mission Control host-control parity, local app process status, local app actions, connected-app fabrication, real-harness transcript proof, or release readiness.`

activationRequirement: `UI and manual evidence must render these snapshots before dashboard usability is claimed.`

releaseImpact: `Automated service coverage closes the durable read-model foundation for ITC-0029 while preserving Applications UI and manual residuals.`

determinism: `The test uses isolated temporary stores, fixed timestamps, fixed ids from created records, and retained runtime dispatch state.`

noFakeProductSeed: `No product-visible seed data is added outside isolated temporary test stores.`

noSimulatedRuntimeOutput: `No simulated runtime output is stored as product evidence; dispatch records are deterministic service state.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, raw command environments, and runtime logs are excluded.`

redactionReview: `Stored snapshot JSON and row JSON are checked for excluded private path and sensitive runtime text.`

failureHandling: `If the service fabricates connected apps, loses retained snapshots across relaunch, permits viewer reads, or persists private state, this fixture fails.`
