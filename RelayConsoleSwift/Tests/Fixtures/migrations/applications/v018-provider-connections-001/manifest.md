# Migration Fixture Manifest - Applications Provider Connections

id: `fix-migration-applications-v018-provider-connections-001`

layer: `migration`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0033`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

fixtureKind: `schema-fixture`

owner: `provider-connection-service`

status: `verified`

secretsPolicy: `secret-references-only`

artifactClass: `migration-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `migration evidence`

sourceBaseline: `Migrations.swift`, `MigrationTests.swift`, `LocalDataService.swift`

files:

- `migrations/applications/v018-provider-connections-001/manifest.md`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../../Sources/RelayConsoleCore/Migrations.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0100`
- `swift run RelayConsoleMigrationTests`

implementationTaskIds: `ITC-0033`

validationCommandIds: `VC-0100`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-034-itc-0033-provider-connections.md`

surface: `applications_provider_connections, applications_provider_authorization_flows, applications_provider_connection_snapshots`

stateKind: `verified-schema`

reasonCode: `applications-provider-connections`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

missingPrerequisites: `Live OAuth execution, Marketplace installs, runtime tool grants, local app/source-host/generated-pack flows, and Paperclip remain later or excluded scope.`

currentState: `Version 18 adds retained provider connection metadata, OAuth/deep-link/manual flow records, and provider snapshot tables with Keychain secret-reference columns and no product-visible seed rows.`

notParityStatement: `This fixture does not claim live provider authorization, raw credential storage, shared Relay-owned OAuth accounts, Paperclip, local app support, or release readiness.`

activationRequirement: `Service, model, UI, visual, accessibility, and redaction evidence must remain aligned before provider connections can be counted as usable.`

releaseImpact: `Adds durable local schema for provider connection state while preserving secret-reference-only storage.`

determinism: `Migration checks use an isolated empty database and static schema introspection.`

noFakeProductSeed: `The migration creates no provider connection, OAuth flow, install, local app, or Paperclip rows.`

noSimulatedRuntimeOutput: `No runtime output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw tokens, API keys, client secrets, bearer values, private account details, local paths, source-host metadata, prompts, and raw workspace state are excluded.`

redactionReview: `Schema metadata stores secret-reference ids and redaction status only.`

failureHandling: `If v18 tables or indexes disappear, seed rows appear, raw secret columns are added, or Paperclip/local-app state is introduced, this fixture fails.`
