# Service Fixture Manifest - No Fake Bootstrap

id: `fix-services-baseline-no-fake-bootstrap-001`

layer: `service`

productArea: `baseline`

requirementIds: `RCSPR-0130`, `RCSPR-0131`, `RCSPR-0145`, `RCSPR-0152`

sourceMapIds: `SM-0148`, `SM-0150`, `SM-0151`, `SM-0154`, `SM-0155`

featureIds: `FI-0123`, `FI-0124`, `FI-0136`, `FI-0143`

gapOrDecisionIds: `SBD-0001`

fixtureKind: `evidence`

owner: `services`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `deterministic-fixture`

branch: `codex/itc-0006-0008-service-replay-visual-scaffold`

commit: `69b6e30`

appVersion: `0.1.0`

capturedAt: `2026-06-22T19:31:46Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `ServiceGuards.swift`, `LocalDataService.swift`,
`RelayConsoleServices.swift`, `guarded-state-standard.md`

files:

- `services/baseline/no-fake-bootstrap-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../RelayConsoleCoreSmokeTests/SmokeTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`
- `swift run RelayConsoleCoreSmokeTests`

implementationTaskIds: `ITC-0006`

validationCommandIds: `VC-0102`, `VC-0002`, `VC-0003`

branchPacket:
`evidence/branches/codex-itc-0006-0008-service-replay-visual-scaffold/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-007-itc-0006-service-guard-scaffold.md`

determinism: `The consuming service test uses temporary local data roots, stable guard roles, stable reason codes, and no product-visible fixture seed data.`

noFakeProductSeed: `The fixture does not seed product-visible sample conversations, agents, harnesses, or runtime output.`

noSimulatedRuntimeOutput: `The fixture contains no runtime output.`

noGeneratedWelcome: `The smoke preflight remains the no-generated-welcome guard.`

privateStateExclusions: `Temporary roots are not recorded; private paths, personal account values, and raw credentials are excluded.`

redactionReview: `RelayConsoleServiceTests redaction check plus branch evidence redaction scan.`

failureHandling: `Any service, smoke, build, or diff-hygiene failure blocks service scaffold closeout.`
