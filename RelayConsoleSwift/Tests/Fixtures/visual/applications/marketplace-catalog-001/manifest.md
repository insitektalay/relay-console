# Visual Fixture Manifest - Applications Marketplace Catalog

id: `fix-visual-applications-marketplace-catalog-001`

layer: `visual`

productArea: `applications`

requirementIds: `RCSPR-0035`, `RCSPR-0036`, `RCSPR-0178`, `ITC-0008`, `ITC-0032`

sourceMapIds: `SM-0019`, `SM-0141`, `SM-0155`, `SM-0160`

featureIds: `FI-0041`, `FI-0141`

gapOrDecisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

fixtureKind: `visual-source-scaffold`

owner: `applications-ui`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `visual-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `ApplicationsService.swift`

files:

- `visual/applications/marketplace-catalog-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0032`

validationCommandIds: `VC-0106`, `ITC-0008`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-033-itc-0032-applications-marketplace-catalog.md`

surface: `Applications Marketplace search/category filters, Apps list, X/LinkedIn detail panel, empty states, and provider setup CTA`

stateKind: `planned-visual-review`

reasonCode: `applications-visual-scaffold`

decisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

missingPrerequisites: `Rendered screenshot capture, keyboard traversal, VoiceOver traversal, provider install execution, OAuth, local apps, source-host records, generated pack review, and Paperclip remain later or excluded.`

currentState: `Source anchors are verified; manual screenshot observations are not yet claimed.`

notParityStatement: `This visual scaffold does not claim screenshot parity, live provider install parity, local app management, generated pack review, source-host parity, Paperclip, or release readiness.`

activationRequirement: `Capture standard and minimum window screenshots after fixed retained social provider data exists, then review Apps list selection, empty states, detail copy, scopes, and setup affordances.`

releaseImpact: `Tracks pending visual signoff for ITC-0032 without overstating source-backed UI evidence.`

determinism: `Planned screenshots must use fixed fixture records, fixed window sizes, and redacted data.`

noFakeProductSeed: `Only retained X/LinkedIn provider metadata may be product-visible; no fake connection, install, credential, or local app rows are seeded by this scaffold.`

noSimulatedRuntimeOutput: `No runtime output is used.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Screenshots must exclude private account values, provider tokens, local paths, source-host data, prompts, and raw workspace state.`

redactionReview: `Future screenshot review must confirm provider setup copy contains no raw tokens, client secrets, API keys, OAuth codes, account values, or local paths.`

failureHandling: `If screenshots show active provider writes, local app/Paperclip controls, private state, or layout overlap, visual evidence remains blocked.`
