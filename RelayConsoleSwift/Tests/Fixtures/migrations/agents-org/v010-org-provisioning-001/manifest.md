# Migration Fixture Manifest - Agents Org Provisioning v010

id: `fix-migrations-agents-org-v010-org-provisioning-001`

layer: `migration`

productArea: `agents-org`

requirementIds: `RCSPR-0004`, `RCSPR-0029`, `RCSPR-0031`, `RCSPR-0108`, `RCSPR-0125`, `RCSPR-0168`, `RCSPR-0169`

sourceMapIds: `SM-0045`, `SM-0047`, `SM-0048`, `SM-0145`, `SM-0146`, `SM-0147`, `SM-0158`

featureIds: `FI-0033`, `FI-0036`, `FI-0037`, `FI-0118`, `FI-0158`, `FI-0159`

gapOrDecisionIds: `none`

fixtureKind: `schema-org-provisioning-evidence`

owner: `persistence`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:19:10Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Migrations.swift`, `LocalDataService.swift`, `Models.swift`, `screen-contracts/agents/agent-structure.md`, `screen-contracts/agents/create-agent.md`, `ITC-0021`

files:

- `migrations/agents-org/v010-org-provisioning-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0021`

validationCommandIds: `VC-0100`

demoIds: `Demo 3`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-022-itc-0021-agent-org-migration-foundation.md`

surface: `Agent organization and provisioning persistence foundation`

stateKind: `active`

reasonCode: `verified-local-migration`

decisionIds: `none`

missingPrerequisites: `Real Hermes/OpenClaw provisioning observations, manager authority service rules, AgentOps live state, and Agents UI evidence remain later ITC work.`

currentState: `Schema version 10 adds nullable agent org/classification/provisioning fields plus companies, departments, teams, manager relationships, and provisioning job tables. Existing agents and runtime bindings remain intact, and no org rows are seeded.`

notParityStatement: `The PRD evidence matrix names migrations/agents-org/v009-org-agentops-001, but this Swift store already used v009 for chat attachments. This fixture intentionally proves the same retained ITC-0021 scope at local migration version 10 and does not claim AgentOps live-state parity.`

activationRequirement: `Service, provisioning, authority, UI, visual, and manual evidence must cite this migration before claiming user-facing org or provisioning behavior.`

releaseImpact: `Unblocks ITC-0021 schema/model closeout while preserving later real-harness and UI residuals.`

determinism: `The migration test asserts fixed table, column, and index names; verifies old agents survive; and verifies new org/provisioning tables start empty.`

noFakeProductSeed: `The migration creates no companies, departments, teams, manager relationships, provisioning jobs, fake agents, fake AgentOps rooms, transcript rows, or generated greetings.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, raw runtime payloads, company data, and personal org data are excluded.`

redactionReview: `The fixture uses deterministic synthetic ids and redacted metadata only; migration tests and scoped scans reject secrets and private paths.`

failureHandling: `If v010 misses org/provisioning schema, seeds product-visible org records, breaks existing agent bindings, or leaks private data, ITC-0021 migration evidence fails.`
