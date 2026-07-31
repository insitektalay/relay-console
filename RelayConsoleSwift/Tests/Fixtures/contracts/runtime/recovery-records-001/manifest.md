# Contract Fixture Manifest - Runtime Recovery Records

id: `fix-contract-runtime-recovery-records-001`

layer: `contract`

productArea: `runtime`

requirementIds: `RCSPR-0006`, `RCSPR-0046`, `RCSPR-0047`, `RCSPR-0124`, `RCSPR-0133`, `RCSPR-0176`, `RCSPR-0177`

sourceMapIds: `SM-0073`, `SM-0074`, `SM-0075`, `SM-0076`, `SM-0078`, `SM-0145`, `SM-0146`, `SM-0148`, `SM-0151`, `SM-0159`

featureIds: `FI-0053`, `FI-0054`, `FI-0117`, `FI-0126`, `FI-0167`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

fixtureKind: `runtime-recovery-contract`

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

sourceBaseline: `Models.swift`, `RuntimeRecoveryService.swift`, `ModelContractTests.swift`

files:

- `contracts/runtime/recovery-records-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`
- `../../Sources/RelayConsoleCore/Models.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0031`

validationCommandIds: `VC-0101`

demoIds: `Demo 4`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-032-itc-0031-runtime-recovery-records.md`

surface: `RuntimeStructuredJob, RuntimeMissingToolEvent, and RuntimeRecoveryRecord contracts`

stateKind: `verified-contract`

reasonCode: `runtime-recovery-contract`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`, `MISSION-CONTROL-EXCLUDED-001`

missingPrerequisites: `Needed Tools UI, Marketplace installs, and controlled writes remain later evidence.`

currentState: `RuntimeStructuredJob, RuntimeMissingToolEvent, RuntimeRecoveryRecord, context usage, and participant health records encode queued/running/completed/failed jobs, missing tool requests, retryable and terminal recovery, source-host exclusion, and redaction status.`

notParityStatement: `This fixture does not claim source-host/local app support, auto-install, fake tool grants, or release readiness.`

activationRequirement: `Service evidence must prove records are persisted, evented, redacted, and non-executing before UI surfaces cite them.`

releaseImpact: `Provides stable model coverage for ITC-0031 recovery records.`

determinism: `The contract fixture uses fixed ids, fixed timestamps, redacted strings, and JSON round trips.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, auth values, prompts, source-host records, raw command environments, and runtime logs are excluded.`

redactionReview: `Contract examples use redacted values and explicitly state source-host exclusion.`

failureHandling: `If recovery models drop job state, missing-tool state, retryability, health/context, source-host exclusion, or redaction fields, ITC-0031 evidence must be downgraded.`
