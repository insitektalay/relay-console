# Service Fixture Manifest - Applications Provider Connections

id: `fix-service-applications-provider-connections-001`

layer: `service`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0033`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

fixtureKind: `applications-provider-service`

owner: `provider-connection-service`

status: `verified`

secretsPolicy: `secret-references-only`

artifactClass: `service-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `ProviderConnectionService.swift`, `LocalDataService.swift`, `SecretService.swift`, `ServiceTests.swift`

files:

- `services/applications/provider-connections-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/ProviderConnectionService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`
- `../../Sources/RelayConsoleCore/SecretService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0033`

validationCommandIds: `VC-0102`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-034-itc-0033-provider-connections.md`

surface: `ProviderConnectionService snapshots, owner/admin mutation, member read-only state, viewer denial, OAuth/deep-link/manual flows, Keychain reference validation, catalog sync, and redacted persistence`

stateKind: `verified-service`

reasonCode: `applications-provider-service-backed`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `SHARED-OAUTH-EXCLUDED-001`

missingPrerequisites: `Live OAuth execution, Marketplace install execution, runtime tool grants, local app/source-host/generated-pack flows, Paperclip, and release readiness remain later or excluded.`

currentState: `ProviderConnectionService requires owner/admin for mutation, allows owner/admin/member read snapshots, rejects viewers, rejects high-risk shared OAuth assumptions, validates Keychain references for connected states, blocks unavailable beta authorization, excludes local app and Paperclip state, redacts OAuth URLs and manual evidence, and survives relaunch.`

notParityStatement: `This fixture does not claim external provider OAuth completion, raw credential writes, shared Relay-owned OAuth accounts, Paperclip setup, local app support, or install execution.`

activationRequirement: `Native OAuth/deep-link activation requires a product decision and manual evidence before actions can become live.`

releaseImpact: `Closes service-backed provider connection read-model and secret-reference evidence for ITC-0033 without activating live OAuth.`

determinism: `The test uses isolated stores, fixed timestamps, fixed app records, and a memory Keychain store.`

noFakeProductSeed: `No product-visible provider rows are seeded outside isolated service tests.`

noSimulatedRuntimeOutput: `No runtime transcript or generated output is stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw tokens, API keys, client secrets, bearer values, private account details, local paths, source-host metadata, prompts, and raw workspace state are excluded.`

redactionReview: `Service assertions scan persisted provider JSON for raw secret material and require `[REDACTED]` in OAuth/manual flow evidence.`

failureHandling: `If member mutation succeeds, viewer reads succeed, raw secrets persist, high-risk shared credentials are allowed, beta authorization starts, local/Paperclip state appears, or relaunch loses provider records, this fixture fails.`
