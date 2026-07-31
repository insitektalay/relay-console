# Service Fixture Manifest - Runtime Recovery Records

id: `fix-service-runtime-recovery-records-001`

layer: `service`

productArea: `runtime`

requirementIds: `RCSPR-0006`, `RCSPR-0046`, `RCSPR-0047`, `RCSPR-0124`, `RCSPR-0133`, `RCSPR-0176`, `RCSPR-0177`

sourceMapIds: `SM-0073`, `SM-0074`, `SM-0075`, `SM-0076`, `SM-0078`, `SM-0145`, `SM-0146`, `SM-0148`, `SM-0151`, `SM-0159`

featureIds: `FI-0053`, `FI-0054`, `FI-0117`, `FI-0126`, `FI-0167`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

fixtureKind: `runtime-recovery-service`

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

sourceBaseline: `RuntimeRecoveryService.swift`, `LocalDataService.swift`, `ServiceTests.swift`

files:

- `services/runtime/recovery-records-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/RuntimeRecoveryService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0031`

validationCommandIds: `VC-0102`

demoIds: `Demo 4`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-032-itc-0031-runtime-recovery-records.md`

surface: `Runtime structured job, missing-tool, and recovery service`

stateKind: `verified-service`

reasonCode: `runtime-recovery-service`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

missingPrerequisites: `Needed Tools UI, Marketplace installs, and controlled writes remain later evidence.`

currentState: `RuntimeRecoveryService persists queued/running/completed/failed jobs, missing-tool requests, retryable and terminal recovery records, participant health, context usage, and typed local events without auto-installing tools, fake grants, source-host records, or local app commands.`

notParityStatement: `This fixture does not claim source-host/local app support, auto-install, fake tool grants, controlled writes, or release readiness.`

activationRequirement: `UI evidence must present these rows as read-only until Needed Tools, Marketplace, and controlled-write cards pass.`

releaseImpact: `Automated service coverage closes the durable recovery foundation for ITC-0031 while preserving source-host and local app exclusions.`

determinism: `The test uses isolated temporary stores, fixed timestamps, and retained runtime dispatch state.`

noFakeProductSeed: `No product-visible seed data is added outside isolated temporary test stores.`

noSimulatedRuntimeOutput: `No simulated runtime output is stored as product evidence; recovery records are deterministic service state.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, source-host records, raw command environments, and runtime logs are excluded.`

redactionReview: `Stored structured-job, missing-tool, and recovery JSON are checked for excluded private path and sensitive text.`

failureHandling: `If source-host state is copied, tools are auto-installed, fake grants are created, typed events do not publish, or private state persists, this fixture fails.`
