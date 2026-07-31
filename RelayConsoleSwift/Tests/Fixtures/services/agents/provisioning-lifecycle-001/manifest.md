# Service Fixture Manifest - Agent Provisioning Lifecycle

id: `fix-services-agents-provisioning-lifecycle-001`

layer: `service`

productArea: `agents-provisioning`

requirementIds: `RCSPR-0030`, `RCSPR-0080`, `RCSPR-0094`, `RCSPR-0108`, `RCSPR-0148`, `RCSPR-0168`, `RCSPR-0171`

sourceMapIds: `SM-0045`, `SM-0054`, `SM-0076`, `SM-0077`, `SM-0136`, `SM-0137`, `SM-0148`, `SM-0158`

featureIds: `FI-0035`, `FI-0055`, `FI-0098`, `FI-0139`, `FI-0158`, `FI-0161`

gapOrDecisionIds: `AD-001`

fixtureKind: `agent-provisioning-lifecycle-service`

owner: `agents-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:55:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `AgentProvisioningService.swift`, `LocalDataService.swift`, `HarnessInstallManager.swift`, `AppViewModel.swift`, `ServiceTests.swift`, `ITC-0023`

files:

- `services/agents/provisioning-lifecycle-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0023`

validationCommandIds: `VC-0102`

demoIds: `Demo 3`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-024-itc-0023-real-provisioning-job-harness-identity.md`

surface: `AgentProvisioningService durable lifecycle and identity separation`

stateKind: `verified-service`

reasonCode: `agent-provisioning-lifecycle-service`

decisionIds: `AD-001`

missingPrerequisites: `Manual real Hermes/OpenClaw observations for installed tool versions, auth state, dispatch, cancel/restart, screenshots, accessibility traversal, and Demo 3 review remain environment-dependent evidence and are not replaced by this fixture.`

currentState: `Service tests prove two explicit Hermes creates and two explicit OpenClaw creates produce distinct Relay agent ids, runtime binding ids, Hermes profile slugs/homes/identity files, and OpenClaw slugs/workspaces through the production provisioning helpers with a scripted command runner; jobs persist completed state across relaunch; missing_harness, auth_required, and duplicate_id states persist without creating forbidden extra agents.`

notParityStatement: `This fixture does not claim manual real-harness success, real chat transcript output, Hermes cancellation, OpenClaw restart, screenshot parity, VoiceOver completion, org authority, AgentOps live state, or release readiness.`

activationRequirement: `Manual real-harness manifests must cite this service proof before claiming full ITC-0023 harness identity evidence.`

releaseImpact: `Provides ITC-0023 automated service proof while preserving real-harness/manual residuals for release aggregation.`

determinism: `The tests use temporary local stores, temporary harness marker folders, fixed synthetic names, a scripted process runner for health/provisioning commands only, and no network or runtime chat process.`

noFakeProductSeed: `The fixture creates only temporary test records and does not seed product-visible agents, provisioning jobs, org rows, sample workspaces, or default chats.`

noSimulatedRuntimeOutput: `No chat/runtime transcript output is included or simulated; scripted command output is limited to health and provisioning metadata needed by the production harness helpers.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, raw workspace roots, identity file paths, auth files, prompts, command logs, credentials, customer names, and personal account values are excluded from fixture manifests and job payload assertions.`

redactionReview: `Tests assert job payload metadata does not contain the temporary root path and stores path-presence booleans rather than raw profile home, identity file, workspace, or state-dir paths.`

failureHandling: `If explicit create reuses ids, completed jobs do not survive relaunch, missing/auth/duplicate states create unintended agents, or job payloads leak raw paths, ITC-0023 service evidence fails.`
