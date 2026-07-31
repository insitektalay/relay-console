# Contract Fixture Manifest - Applications Marketplace Installs

id: `fix-contract-applications-marketplace-installs-001`

layer: `contract`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0034`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `LOCAL-APP-EXCLUDED-001`, `RUNTIME-WRITE-DEFERRED-001`

fixtureKind: `applications-marketplace-install-contract`

owner: `marketplace-install-service`

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

- `contracts/applications/marketplace-installs-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`
- `../../Sources/RelayConsoleCore/Models.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0034`

validationCommandIds: `VC-0101`

demoIds: `Demo 4`, `Demo 5`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-035-itc-0034-marketplace-installs.md`

surface: `MarketplaceInstallRoleDefinition, MarketplaceCompatibleAgentTarget, MarketplaceInstallRequest, MarketplaceInstallRecord, MarketplaceInstallDiagnostics, MarketplaceInstallSnapshot, lifecycle/drift/status enums, and roleDefinitions on MarketplaceRoleManifest`

stateKind: `verified-contract`

reasonCode: `applications-marketplace-install-contract`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `LOCAL-APP-EXCLUDED-001`, `RUNTIME-WRITE-DEFERRED-001`

missingPrerequisites: `Runtime file writes, provider bridge writes, automatic tool grants, generated pack installs, source-host installs, local repo apps, Paperclip, and release readiness remain later or excluded.`

currentState: `Model contracts encode compatible agents, existing-agent target mode, operator/auditor/manager role manifest details, approval profile, runtime format, risk acknowledgement, install lifecycle, drift, selected capabilities, redacted metadata, and remove-as-unconfigured state.`

notParityStatement: `This fixture does not claim live provider install execution, runtime file writes, provider writes, fake compatible agents, automatic grants, Paperclip support, local app support, or visual release readiness.`

activationRequirement: `Install execution requires service, UI, migration, and later runtime/provider write evidence before becoming live.`

releaseImpact: `Provides stable Codable coverage for retained Marketplace install state and compatible-agent snapshots.`

determinism: `The JSON fixtures use fixed ids, timestamps, example domains, retained agent ids, and redacted metadata.`

noFakeProductSeed: `No product-visible install rows or compatible agents are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript or generated output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw tokens, API keys, client secrets, bearer values, private account details, local paths, source-host data, prompts, and raw workspace state are excluded.`

redactionReview: `Contract examples use redacted metadata, Keychain reference ids from provider contracts, and private-state redaction status fields.`

failureHandling: `If contracts drop MarketplaceInstallRecord, MarketplaceCompatibleAgentTarget, role manifest definitions, drift state, risk acknowledgement, approval profile, remove-as-unconfigured status, Paperclip exclusion, or redaction fields, ITC-0034 evidence must be downgraded.`
