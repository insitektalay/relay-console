# Service Fixture Manifest - Applications Marketplace Install Compatibility

id: `fix-service-applications-marketplace-install-compatibility-001`

layer: `service`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0034`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `LOCAL-APP-EXCLUDED-001`, `RUNTIME-WRITE-DEFERRED-001`

fixtureKind: `applications-marketplace-install-service`

owner: `marketplace-install-service`

status: `verified`

secretsPolicy: `secret-references-only`

artifactClass: `service-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `MarketplaceInstallService.swift`, `ProviderConnectionService.swift`, `LocalDataService.swift`, `ServiceTests.swift`

files:

- `services/applications/install-compatibility-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/MarketplaceInstallService.swift`
- `../../Sources/RelayConsoleCore/ProviderConnectionService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0034`

validationCommandIds: `VC-0102`

demoIds: `Demo 4`, `Demo 5`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-035-itc-0034-marketplace-installs.md`

surface: `MarketplaceInstallService snapshots, compatible-agent discovery, owner/admin mutation, member read-only state, viewer denial, provider connection requirement, risk acknowledgement, duplicate supersede, update drift, removal as unconfigured, catalog install sync, and redacted persistence`

stateKind: `verified-service`

reasonCode: `applications-marketplace-install-service-backed`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `LOCAL-APP-EXCLUDED-001`, `RUNTIME-WRITE-DEFERRED-001`

missingPrerequisites: `Runtime file writes, provider bridge writes, automatic tool grants, generated pack installs, source-host installs, local repo apps, Paperclip, and release readiness remain later or excluded.`

currentState: `MarketplaceInstallService targets real retained agents with runtime bindings, rejects viewers, denies member mutations, blocks missing agents and unsupported capabilities, requires connected provider records, requires high-risk acknowledgement, rejects non-installable manager role assignment, supersedes duplicate active targets, removes records as unconfigured, preserves credentials, and does not execute runtime actions.`

notParityStatement: `This fixture does not claim live provider install execution, runtime file cleanup, provider writes, fake compatible agents, automatic grants, Paperclip support, local app support, or visual release readiness.`

activationRequirement: `Runtime/provider write activation requires later safety-card authorization and manual evidence before install execution can become live.`

releaseImpact: `Closes service-backed compatible-agent install state for ITC-0034 while preserving deferred execution boundaries.`

determinism: `The test uses isolated stores, fixed timestamps, fixed app records, fixed harnesses, memory Keychain references, and no live provider data.`

noFakeProductSeed: `No product-visible install rows, compatible agents, provider credentials, or snapshots are seeded outside isolated service tests.`

noSimulatedRuntimeOutput: `No runtime transcript, generated output, or runtime action run is stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw tokens, API keys, client secrets, bearer values, local paths, source-host metadata, prompts, raw workspace state, and runtime file contents are excluded.`

redactionReview: `Service assertions scan persisted install JSON and snapshot JSON for raw sensitive values and require redacted evidence.`

failureHandling: `If fake/missing agents install, member mutation succeeds, viewer reads succeed, raw secrets persist, runtime actions execute, duplicate active targets remain, remove-as-unconfigured is lost, provider credentials are deleted, or Paperclip/local state appears, this fixture fails.`
