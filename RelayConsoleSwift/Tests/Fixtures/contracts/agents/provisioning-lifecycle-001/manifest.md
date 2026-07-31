# Contract Fixture Manifest - Agent Provisioning Lifecycle

id: `fix-contracts-agents-provisioning-lifecycle-001`

layer: `contract`

productArea: `agents-provisioning`

requirementIds: `RCSPR-0030`, `RCSPR-0080`, `RCSPR-0094`, `RCSPR-0108`, `RCSPR-0148`, `RCSPR-0168`, `RCSPR-0171`

sourceMapIds: `SM-0045`, `SM-0054`, `SM-0076`, `SM-0077`, `SM-0136`, `SM-0137`, `SM-0148`, `SM-0158`

featureIds: `FI-0035`, `FI-0055`, `FI-0098`, `FI-0139`, `FI-0158`, `FI-0161`

gapOrDecisionIds: `AD-001`

fixtureKind: `agent-provisioning-lifecycle-contract`

owner: `contracts`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `contract-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:55:00Z`

reviewer: `Codex`

reviewerRole: `contract evidence`

sourceBaseline: `Models.swift`, `ModelContractTests.swift`, `ITC-0023`

files:

- `contracts/agents/provisioning-lifecycle-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0023`

validationCommandIds: `VC-0101`

demoIds: `Demo 3`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-024-itc-0023-real-provisioning-job-harness-identity.md`

surface: `AgentProvisioningJob and AgentProvisioningStatus Codable contracts`

stateKind: `verified-contract`

reasonCode: `agent-provisioning-lifecycle-contract`

decisionIds: `AD-001`

missingPrerequisites: `Manual two-Hermes and two-OpenClaw real-harness observations, screenshots, VoiceOver traversal, dispatch cancel/restart proof, and release aggregation remain environment-dependent or later evidence.`

currentState: `Model contracts round-trip AgentProvisioningJob with queued, running, completed, failed, cancelled, auth_required, missing_harness, and duplicate_id statuses plus runtimeBindingId, createdAgentId, externalAgentId, redacted payload metadata, and filesMetadata.`

notParityStatement: `This fixture proves Codable shape only; it does not claim real provisioning success, real runtime output, Demo 3 completion, org authority, AgentOps live state, or release readiness.`

activationRequirement: `Service and real-harness evidence must consume this contract before claiming provisioning lifecycle parity.`

releaseImpact: `Provides ITC-0023 contract coverage for durable job shape while preserving real-harness and manual residuals.`

determinism: `The fixture uses fixed synthetic ids, sorted Codable round trips, redacted metadata, and explicit raw-value checks.`

noFakeProductSeed: `Contract samples do not seed product-visible agents, provisioning jobs, runtime bindings, org rows, or harness records.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, profile homes, workspace roots, identity file paths, auth files, command output, prompts, credentials, and real person or organization names are excluded.`

redactionReview: `Payload and files metadata use synthetic ids and redacted markers only; raw filesystem paths are excluded.`

failureHandling: `If AgentProvisioningJob drifts, missing_harness or duplicate_id statuses are removed, runtimeBindingId/filesMetadata are omitted, or this fixture is cited as real-harness proof, ITC-0023 contract evidence fails.`
