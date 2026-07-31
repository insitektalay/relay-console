# Accessibility Fixture Manifest - Applications Marketplace Catalog

id: `fix-accessibility-applications-marketplace-catalog-001`

layer: `accessibility`

productArea: `applications`

requirementIds: `RCSPR-0035`, `RCSPR-0036`, `RCSPR-0178`, `ITC-0008`, `ITC-0032`

sourceMapIds: `SM-0019`, `SM-0141`, `SM-0155`, `SM-0160`

featureIds: `FI-0041`, `FI-0141`

gapOrDecisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

fixtureKind: `accessibility-source-scaffold`

owner: `applications-ui`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `accessibility-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `AppViewModel.swift`

files:

- `accessibility/applications/marketplace-catalog-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0032`

validationCommandIds: `VC-0107`, `ITC-0008`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-033-itc-0032-applications-marketplace-catalog.md`

surface: `Applications Marketplace search, category filter, Apps list, X/LinkedIn detail, and provider setup action`

stateKind: `planned-accessibility-review`

reasonCode: `applications-accessibility-scaffold`

decisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

missingPrerequisites: `Manual keyboard traversal, VoiceOver/help-label review, rendered focus review, provider install execution, OAuth, local apps, source-host records, generated pack review, and Paperclip remain later or excluded.`

currentState: `Source anchors include help and accessibility labels for refresh, app selection, retry, configure connection, and deterministic app icon fallback; manual observations are not yet claimed.`

notParityStatement: `This accessibility scaffold does not claim completed keyboard traversal, VoiceOver traversal, live provider install parity, local app management, generated pack review, source-host parity, Paperclip, or release readiness.`

activationRequirement: `Complete manual keyboard and VoiceOver review after fixed Applications fixture data is available.`

releaseImpact: `Tracks pending accessibility signoff for ITC-0032 without overstating source-backed UI evidence.`

determinism: `Future review must use fixed fixture records and redacted data.`

noFakeProductSeed: `Only retained X/LinkedIn provider metadata may be product-visible; no fake connection, install, credential, or local app rows are seeded by this scaffold.`

noSimulatedRuntimeOutput: `No runtime output is used.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Manual review must exclude provider tokens, account values, local paths, source-host data, prompts, and raw workspace state.`

redactionReview: `Accessibility copy must not expose private provider or workspace state.`

failureHandling: `If controls lack labels, disabled states are color-only, local app/Paperclip controls appear active, or private state is exposed, accessibility evidence remains blocked.`
