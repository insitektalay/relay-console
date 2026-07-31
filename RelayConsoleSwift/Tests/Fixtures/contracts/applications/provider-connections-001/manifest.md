# Contract Fixture Manifest - Applications Provider Connections

id: `fix-contract-applications-provider-connections-001`

layer: `contract`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0033`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

fixtureKind: `applications-provider-contract`

owner: `provider-connection-service`

status: `verified`

secretsPolicy: `secret-references-only`

artifactClass: `contract-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `contract evidence`

sourceBaseline: `Models.swift`, `ModelContractTests.swift`

files:

- `contracts/applications/provider-connections-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`
- `../../Sources/RelayConsoleCore/Models.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0033`

validationCommandIds: `VC-0101`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-034-itc-0033-provider-connections.md`

surface: `MarketplaceProviderConnection, ProviderAuthorizationFlow, ProviderConnectionSnapshot, credential requirements, connector health, sender identities, and Keychain reference summaries`

stateKind: `verified-contract`

reasonCode: `applications-provider-connection-contract`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

missingPrerequisites: `Live OAuth execution, Marketplace installs, runtime tool grants, local repo apps, source-host records, generated pack review, and Paperclip remain later or excluded.`

currentState: `Provider connection models encode connected, disconnected, expired, auth-required, health-error, validating, sender-invalid, disconnecting, reauthorize, OAuth/deep-link/manual evidence, Keychain references, user-owned credentials, health, sender identity, and redacted diagnostics.`

notParityStatement: `This fixture does not claim live provider authorization, raw credential storage, shared Relay-owned OAuth accounts, Paperclip support, local app support, or release readiness.`

activationRequirement: `Provider service and UI evidence must prove authority, Keychain reference validation, redaction, and unavailable native OAuth boundaries before live activation.`

releaseImpact: `Provides stable Codable coverage for retained provider connection and OAuth/deep-link state.`

determinism: `The JSON fixtures use fixed ids, timestamps, example domains, and secret-reference ids only.`

noFakeProductSeed: `No product-visible provider rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript or generated output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw tokens, API keys, client secrets, bearer values, private account values, local paths, source-host data, prompts, and raw workspace state are excluded.`

redactionReview: `Contract examples use `SecretReference` ids, inert example domains, and redaction status fields.`

failureHandling: `If model contracts drop Keychain references, OAuth/deep-link/manual state, user-owned credential ownership, health, sender identity, Paperclip exclusion, or redaction fields, ITC-0033 evidence must be downgraded.`
