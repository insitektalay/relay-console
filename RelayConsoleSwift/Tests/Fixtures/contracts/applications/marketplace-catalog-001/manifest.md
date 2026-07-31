# Contract Fixture Manifest - Applications Marketplace Catalog

id: `fix-contract-applications-marketplace-catalog-001`

layer: `contract`

productArea: `applications`

requirementIds: `RCSPR-0035`, `RCSPR-0036`, `RCSPR-0178`, `ITC-0032`

sourceMapIds: `SM-0019`, `SM-0141`, `SM-0155`, `SM-0160`

featureIds: `FI-0041`, `FI-0141`

gapOrDecisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

fixtureKind: `applications-marketplace-contract`

owner: `applications-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `contract-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `contract evidence`

sourceBaseline: `Models.swift`, `ModelContractTests.swift`

files:

- `contracts/applications/marketplace-catalog-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`
- `../../Sources/RelayConsoleCore/Models.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0032`

validationCommandIds: `VC-0101`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-033-itc-0032-applications-marketplace-catalog.md`

surface: `MarketplaceCatalogApp, ApplicationsCatalogSnapshot, retained social app list, search/category filters, and deterministic icon fallback`

stateKind: `verified-contract`

reasonCode: `applications-marketplace-contract`

decisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

missingPrerequisites: `Provider OAuth execution, Marketplace installs, local repo app management, source-host records, generated pack review, and Paperclip remain out of this contract.`

currentState: `MarketplaceCatalogApp and ApplicationsCatalogSnapshot encode retained social provider source, category, role manifest, runtime support, connection state, user-facing empty/no-match copy, and no demo fallback catalogue.`

notParityStatement: `This fixture does not claim live Marketplace provider parity, install execution, local app creation, generated pack review, source-host parity, or Paperclip support.`

activationRequirement: `Service and UI evidence must prove X/LinkedIn retained social visibility, role-aware access, excluded local/Paperclip scope, and no demo fallback before this contract can be cited as product usable.`

releaseImpact: `Provides stable Codable coverage for Applications Marketplace catalog state.`

determinism: `The JSON fixtures use fixed ids, fixed timestamps, fixed redaction status, and deterministic app icon fallback values.`

noFakeProductSeed: `Only retained social provider metadata for X and LinkedIn is created; no fake local app, connection, install, or credential records are created.`

noSimulatedRuntimeOutput: `No runtime transcript or generated output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Provider tokens, private account values, local paths, source-host data, prompts, and raw workspace state are excluded.`

redactionReview: `Contract examples use inert example domains, no credentials, and redaction status fields.`

failureHandling: `If model contracts drop role manifests, retained social catalogue scope, user-facing empty states, icon fallback, no-demo-fallback evidence, or local/Paperclip exclusions, ITC-0032 evidence must be downgraded.`
