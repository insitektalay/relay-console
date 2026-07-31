# Contract Fixture Manifest - Agents Org Provisioning

id: `fix-contracts-agents-org-provisioning-001`

layer: `contract`

productArea: `agents-org`

requirementIds: `RCSPR-0004`, `RCSPR-0029`, `RCSPR-0031`, `RCSPR-0108`, `RCSPR-0125`, `RCSPR-0168`, `RCSPR-0169`

sourceMapIds: `SM-0045`, `SM-0047`, `SM-0048`, `SM-0145`, `SM-0146`, `SM-0147`, `SM-0158`

featureIds: `FI-0033`, `FI-0036`, `FI-0037`, `FI-0118`, `FI-0158`, `FI-0159`

gapOrDecisionIds: `none`

fixtureKind: `agent-org-provisioning-contract`

owner: `contracts`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `contract-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:19:10Z`

reviewer: `Codex`

reviewerRole: `contract evidence`

sourceBaseline: `Models.swift`, `ModelContractTests.swift`, `screen-contracts/agents/agent-structure.md`, `screen-contracts/agents/create-agent.md`, `ITC-0021`

files:

- `contracts/agents/org-provisioning-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0021`

validationCommandIds: `VC-0101`

demoIds: `Demo 3`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-022-itc-0021-agent-org-migration-foundation.md`

surface: `Agent, AgentOrgCompany, AgentOrgDepartment, AgentOrgTeam, AgentManagerRelationship, and AgentProvisioningJob Codable contracts`

stateKind: `verified-contract`

reasonCode: `agent-org-provisioning-contract`

decisionIds: `none`

missingPrerequisites: `Agent identity editing, real provisioning service transitions, manager authority, AgentOps live-state rooms, visual evidence, and manual demo observations remain later ITC work.`

currentState: `Model contracts round-trip nullable org placement, family label, manager id, classification, model, markdown/plain-text response presentation, provisioning status, metrics, budgets, organization records, manager relationships, and provisioning jobs. Legacy agent JSON defaults new fields without inventing org state.`

notParityStatement: `This fixture proves local model shape only. It does not claim real runtime provisioning success, AgentOps live-state parity, Agents UI parity, or HTML-native response presentation support.`

activationRequirement: `Service and UI work must consume this contract before claiming editable org placement, provisioning progress, or response presentation behavior.`

releaseImpact: `Provides ITC-0021 contract coverage while preserving later service, harness, UI, visual, accessibility, and manual evidence residuals.`

determinism: `The fixture uses fixed synthetic ids, sorted Codable round trips, legacy decode defaults, and redacted metadata.`

noFakeProductSeed: `Samples are deterministic contract records only and do not seed product-visible companies, departments, teams, agents, manager links, or provisioning jobs.`

noSimulatedRuntimeOutput: `No runtime transcript output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, runtime logs, customer company data, and personal organization data are excluded.`

redactionReview: `All payload and metadata examples use synthetic ids or [REDACTED] markers.`

failureHandling: `If Codable fields drift, html_native starts decoding as supported, legacy agents invent org state, or redacted metadata leaks, ITC-0021 contract evidence fails.`
