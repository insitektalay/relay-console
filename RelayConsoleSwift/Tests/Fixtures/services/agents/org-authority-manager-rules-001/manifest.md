# Service Fixture Manifest - Agent Org Authority Manager Rules

id: `fix-services-agents-org-authority-manager-rules-001`

layer: `service`

productArea: `agents-org-authority`

requirementIds: `RCSPR-0031`, `RCSPR-0032`, `RCSPR-0131`, `RCSPR-0134`, `RCSPR-0152`, `RCSPR-0169`, `RCSPR-0172`

sourceMapIds: `SM-0047`, `SM-0048`, `SM-0150`, `SM-0151`, `SM-0155`, `SM-0158`

featureIds: `FI-0036`, `FI-0037`, `FI-0124`, `FI-0125`, `FI-0143`, `FI-0159`, `FI-0162`

gapOrDecisionIds: `SBD-0001`

fixtureKind: `agent-org-authority-manager-rules-service`

owner: `agents-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:59:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `AgentOrganizationService.swift`, `LocalDataService.swift`, `ServiceGuards.swift`, `EventBus.swift`, `ServiceTests.swift`, `ITC-0024`

files:

- `services/agents/org-authority-manager-rules-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0024`

validationCommandIds: `VC-0102`

demoIds: `Demo 3`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-025-itc-0024-org-service-authority-manager-rules.md`

surface: `AgentOrganizationService owner/admin authority, hierarchy consistency, manager replacement, delete guards, and audit redaction`

stateKind: `verified-service`

reasonCode: `authority.role_required`, `input.invalid`, `decision.required`, `policy.blocked`

decisionIds: `agent.department.manager.replace`

missingPrerequisites: `Visual, accessibility, and manual create/classification evidence remain assigned to later Agents UI/evidence items.`

currentState: `Service tests prove member org mutations are denied without persistence changes, owner/admin org mutations persist and emit local events, teams inherit department heads only when explicitly requested and record provenance, AgentOps room assignments persist for departments and teams, dashboard counts come from local persisted records, mismatched team/department placement is rejected, department manager replacement requires confirmation, manager relationships persist, guarded deletes do not mutate state, and authority audit details are redacted.`

notParityStatement: `This fixture does not claim final Agents UI parity, AgentOps visual state, team memory dashboards, calendar/task parity, or manual Demo 3 signoff.`

activationRequirement: `Agents UI controls that mutate organization, placement, manager, head, or lead state must call this service or an equivalent service-backed authority path.`

releaseImpact: `Provides ITC-0024 automated service proof and enables later UI evidence to be backed by local authority instead of UI-only guards.`

determinism: `The test uses temporary local stores, stable synthetic role contexts, stable correlation ids, and local-only records.`

noFakeProductSeed: `The fixture creates only temporary service-test companies, departments, teams, and agents. It does not seed product-visible org rows.`

noSimulatedRuntimeOutput: `No runtime chat transcript or harness output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, raw credentials, tokens, customer names, and command logs are excluded.`

redactionReview: `Denied authority audit detail uses a synthetic credential-shaped value and the service test asserts it is redacted.`

failureHandling: `Any authority bypass, persistence mutation on denial, hierarchy mismatch acceptance, unconfirmed manager replacement, missing provenance, missing event, delete guard bypass, or audit redaction failure blocks ITC-0024 service evidence.`
