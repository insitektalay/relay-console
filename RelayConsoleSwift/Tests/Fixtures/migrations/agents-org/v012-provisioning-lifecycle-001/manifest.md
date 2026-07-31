# Migration Fixture Manifest - Agent Provisioning Lifecycle v012

id: `fix-migrations-agents-org-v012-provisioning-lifecycle-001`

layer: `migration`

productArea: `agents-provisioning`

requirementIds: `RCSPR-0030`, `RCSPR-0080`, `RCSPR-0094`, `RCSPR-0108`, `RCSPR-0148`, `RCSPR-0168`, `RCSPR-0171`

sourceMapIds: `SM-0045`, `SM-0054`, `SM-0076`, `SM-0077`, `SM-0136`, `SM-0137`, `SM-0148`, `SM-0158`

featureIds: `FI-0035`, `FI-0055`, `FI-0098`, `FI-0139`, `FI-0158`, `FI-0161`

gapOrDecisionIds: `AD-001`

fixtureKind: `schema-agent-provisioning-lifecycle-evidence`

owner: `persistence`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:55:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Migrations.swift`, `LocalDataService.swift`, `Models.swift`, `ITC-0023`

files:

- `migrations/agents-org/v012-provisioning-lifecycle-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0023`

validationCommandIds: `VC-0100`

demoIds: `Demo 3`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-024-itc-0023-real-provisioning-job-harness-identity.md`

surface: `Durable local agent provisioning job lifecycle schema`

stateKind: `active`

reasonCode: `verified-local-migration`

decisionIds: `AD-001`

missingPrerequisites: `Manual real Hermes/OpenClaw observations, screenshots, VoiceOver review, manager authority, AgentOps live-state evidence, and release aggregation remain later or environment-dependent work.`

currentState: `Schema version 12 adds runtime binding linkage and redacted files metadata to agent_provisioning_jobs so queued, running, completed, failed, auth-required, missing-harness, and duplicate-id job states can be persisted without storing raw file paths in job payload metadata.`

notParityStatement: `This fixture proves local schema shape only; it does not claim real harness provisioning success, dispatch parity, Demo 3 completion, or release readiness.`

activationRequirement: `Service tests and real-harness/manual observations must cite this fixture before claiming provisioning lifecycle behavior.`

releaseImpact: `Unblocks ITC-0023 local persistence proof while preserving real-harness, UI visual, accessibility, authority, AgentOps, and release residuals.`

determinism: `Migration tests assert fixed table, column, and index names and verify migrations do not seed product-visible provisioning jobs.`

noFakeProductSeed: `The migration creates no fake agents, fake provisioning jobs, fake runtime identities, fake org rows, sample workspaces, or simulated harness rows.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, raw workspace roots, auth files, command output, prompt content, credentials, customer names, and personal account values are excluded from this fixture.`

redactionReview: `The fixture contains deterministic schema references only and no raw harness paths, workspace paths, identity file paths, or secrets.`

failureHandling: `If v012 misses runtime binding linkage, omits files metadata, seeds provisioning records, or is cited as real-harness proof, ITC-0023 migration evidence fails.`
