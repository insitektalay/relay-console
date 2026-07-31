# Service Fixture Manifest - AgentOps Live State Runtime Overview

id: `fix-services-agentops-live-state-runtime-overview-001`

layer: `service`

productArea: `agentops-live-state-runtime-overview`

requirementIds: `RCSPR-0018`, `RCSPR-0131`, `RCSPR-0134`, `ITC-0027`

sourceMapIds: `SM-0018`, `SM-0150`, `SM-0151`, `SM-0158`

featureIds: `FI-0018`, `FI-0124`, `FI-0143`

gapOrDecisionIds: `ITC-0045`, `ITC-0053`

fixtureKind: `agentops-service-read-model`

owner: `agentops-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `AgentOpsService.swift`, `Models.swift`, `RelayConsoleServices.swift`, `ServiceTests.swift`, `ITC-0027`

files:

- `services/agentops/live-state-runtime-overview-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0027`

validationCommandIds: `VC-0102`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-028-itc-0027-agentops-live-state-runtime-overview.md`

surface: `AgentOpsService live-state snapshot, runtime overview summary, and redacted event feed`

stateKind: `verified-service`

reasonCode: `agentops-live-state-service-backed`

decisionIds: `ITC-0045`

missingPrerequisites: `Full AgentOps visualization, layout editor polish, task-scoped approval actions, rendered screenshots, and manual Demo 8 signoff remain later gated work.`

currentState: `Service tests prove owner/admin-only runtime overview access, mapping from retained dispatch, task, approval, message, agent-status, and no-signal rows, explicit weak visual fallback state, retained record links, and redaction of seeded operator text.`

notParityStatement: `This fixture does not claim full AgentOps visualization parity, standalone approval controls, host-control actions, screenshot parity, or manual release signoff.`

activationRequirement: `Any AgentOps mutation, host-control action, or approval decision control must add explicit authority, audit, redaction, and fixture evidence before activation.`

releaseImpact: `Provides ITC-0027 automated service proof for AgentOps entry live state and runtime overview without mock product events.`

determinism: `The test uses temporary local stores, stable service contexts, retained local records, and no product-visible seed data.`

noFakeProductSeed: `The fixture creates only temporary service-test agents, dispatches, tasks, and messages. It does not seed product-visible AgentOps rows.`

noSimulatedRuntimeOutput: `No mock AgentOps event stream is used; state is derived from retained local dispatch, task, message, and agent records.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, raw credentials, tokens, prompts, customer data, and runtime logs are excluded.`

redactionReview: `Synthetic sensitive operator text is inserted into temporary records and the encoded AgentOps snapshot is asserted not to contain it.`

failureHandling: `Any mock product event dependency, leaked operator text, missing owner/admin guard, missing retained record link, or incorrect live-state mapping blocks ITC-0027 service evidence.`
