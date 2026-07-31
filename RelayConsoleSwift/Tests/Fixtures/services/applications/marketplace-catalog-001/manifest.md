# Service Fixture Manifest - Applications Marketplace Catalog

id: `fix-service-applications-marketplace-catalog-001`

layer: `service`

productArea: `applications`

requirementIds: `RCSPR-0035`, `RCSPR-0036`, `RCSPR-0178`, `ITC-0032`

sourceMapIds: `SM-0019`, `SM-0141`, `SM-0155`, `SM-0160`

featureIds: `FI-0041`, `FI-0141`

gapOrDecisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

fixtureKind: `applications-marketplace-service`

owner: `applications-service`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `service-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `ApplicationsService.swift`, `LocalDataService.swift`, `ServiceTests.swift`

files:

- `services/applications/marketplace-catalog-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/ApplicationsService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0032`

validationCommandIds: `VC-0102`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-033-itc-0032-applications-marketplace-catalog.md`

surface: `ApplicationsService catalog snapshots, role-aware tabs, filters, detail state, and local navigation records`

stateKind: `verified-service`

reasonCode: `applications-marketplace-service-backed`

decisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

missingPrerequisites: `Provider OAuth, install execution, local repo apps, source-host records, generated pack review, Paperclip, and controlled writes remain unavailable or excluded.`

currentState: `ApplicationsService persists retained catalog records, returns empty/no_match/unavailable/ready states, exposes admin-only disabled Local Apps and Review / Updates tabs, hides excluded local/review rows from members, blocks unavailable beta apps, and emits Applications catalog events without a Demo fallback catalogue.`

notParityStatement: `This fixture does not claim provider install execution, live Marketplace fetch parity, local app creation, source-host parity, generated pack review, Paperclip, or release readiness.`

activationRequirement: `Provider actions must remain inert until authority, install execution, OAuth, and external provider evidence are explicitly added.`

releaseImpact: `Closes service-backed Applications Marketplace read-model evidence while preserving excluded flows.`

determinism: `The test uses isolated stores, fixed timestamps, fixed app records, and deterministic icon fallback.`

noFakeProductSeed: `No product-visible catalogue rows are seeded outside isolated service tests.`

noSimulatedRuntimeOutput: `No runtime transcript or generated output is stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Provider secrets, account values, private paths, source-host data, prompts, and raw workspace state are excluded.`

redactionReview: `Service state uses inert provider fixture values and redaction status fields; demo fallback remains false.`

failureHandling: `If viewer access is allowed, local/review rows leak, beta unavailable apps become actionable, demo fallback turns true, or catalog events stop publishing, this fixture fails.`
