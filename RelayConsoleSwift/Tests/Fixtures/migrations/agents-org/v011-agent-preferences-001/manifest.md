# Migration Fixture Manifest - Agent Preferences v011

id: `fix-migrations-agents-org-v011-agent-preferences-001`

layer: `migration`

productArea: `agents-preferences`

requirementIds: `RCSPR-0029`, `RCSPR-0030`, `RCSPR-0079`, `RCSPR-0108`, `RCSPR-0151`, `RCSPR-0169`, `RCSPR-0170`

sourceMapIds: `SM-0045`, `SM-0046`, `SM-0123`, `SM-0143`, `SM-0155`, `SM-0158`

featureIds: `FI-0033`, `FI-0034`, `FI-0088`, `FI-0090`, `FI-0142`, `FI-0159`, `FI-0160`

gapOrDecisionIds: `AD-001`

fixtureKind: `schema-agent-preferences-evidence`

owner: `persistence`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:34:39Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Migrations.swift`, `LocalDataService.swift`, `Models.swift`, `screen-contracts/agents/agent-detail.md`, `screen-contracts/agents/create-agent.md`, `ITC-0022`

files:

- `migrations/agents-org/v011-agent-preferences-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0022`

validationCommandIds: `VC-0100`

demoIds: `Demo 3`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-023-itc-0022-agent-identity-preferences-response-presentation.md`

surface: `Durable local agent preference schema`

stateKind: `active`

reasonCode: `verified-local-migration`

decisionIds: `AD-001`

missingPrerequisites: `Real provisioning jobs, manager authority services, Agents screenshots, VoiceOver review, and AgentOps live-state evidence remain later ITC work.`

currentState: `Schema version 11 adds agent_preferences for cosmetic display names, avatar references, no-avatar state, and markdown/plain response presentation without changing runtime identity fields.`

notParityStatement: `This fixture proves local preference persistence only; it does not claim full Agents UI parity, provisioning success, or html_native response presentation support.`

activationRequirement: `Service and UI evidence must cite this fixture before claiming durable agent identity preferences.`

releaseImpact: `Unblocks ITC-0022 persistence proof while preserving later provisioning, authority, visual, accessibility, and manual residuals.`

determinism: `Migration tests assert fixed table, column, and index names and verify migrations do not seed product-visible preference rows.`

noFakeProductSeed: `The migration creates no fake agents, fake display names, fake avatars, fake provisioning jobs, fake runtime identities, or sample org rows.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, raw uploaded image bytes, credentials, customer names, and personal org data are excluded.`

redactionReview: `The fixture contains deterministic schema references only and no raw avatar payloads.`

failureHandling: `If v011 misses preference schema, seeds preference rows, or allows html_native support claims, ITC-0022 migration evidence fails.`
