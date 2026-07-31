# UI Fixture Manifest - Applications Marketplace Catalog

id: `fix-ui-applications-marketplace-catalog-001`

layer: `ui`

productArea: `applications`

requirementIds: `RCSPR-0035`, `RCSPR-0036`, `RCSPR-0178`, `ITC-0008`, `ITC-0032`

sourceMapIds: `SM-0019`, `SM-0141`, `SM-0155`, `SM-0160`

featureIds: `FI-0041`, `FI-0141`

gapOrDecisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

fixtureKind: `source-backed-ui-contract`

owner: `applications-ui`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `source-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `UI source evidence`

sourceBaseline: `Views.swift`, `AppViewModel.swift`, `ApplicationsService.swift`, `ShellNavigation.swift`

files:

- `ui/applications/marketplace-catalog-001/manifest.md`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0032`

validationCommandIds: `VC-0105`, `ITC-0008`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-033-itc-0032-applications-marketplace-catalog.md`

surface: `ApplicationsSidebarPanel, ApplicationsScreen, search/category filters, Apps list, X/LinkedIn detail panel, and provider setup CTA`

stateKind: `verified-source`

reasonCode: `applications-marketplace-ui-service-backed`

decisionIds: `APPLICATIONS-LOCAL-EXCLUDED-001`, `PAPERCLIP-EXCLUDED-001`

missingPrerequisites: `Rendered screenshot parity, keyboard traversal, VoiceOver traversal, provider install execution, OAuth, local apps, generated pack review, and Paperclip remain later or excluded work.`

currentState: `Source checks verify Applications Marketplace, simplified subtitle, search marketplace apps, category filter, Apps list with retained X/LinkedIn providers, no-match/loading/empty/retry states, user-facing detail copy, connection requirements, required credentials/scopes, configure connection CTA, and deterministic icon fallback anchors.`

notParityStatement: `This source fixture does not claim screenshot parity, live provider install parity, local app management, generated pack review, source-host parity, Paperclip, or manual accessibility completion.`

activationRequirement: `Provider setup actions must remain Keychain/secret-reference-backed and avoid fake connected records until OAuth services pass authority and evidence requirements.`

releaseImpact: `Unblocks ITC-0032 source-backed UI evidence for the Applications Marketplace route.`

determinism: `Static source tests scan deterministic Swift anchors and do not rely on live provider data.`

noFakeProductSeed: `Only retained X/LinkedIn provider metadata is product-visible; no fake installs, connections, screenshots, credentials, or local app records are seeded.`

noSimulatedRuntimeOutput: `No runtime output is used as UI input.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Provider tokens, account data, local paths, source-host metadata, screenshots, prompts, and raw workspace state are excluded.`

redactionReview: `UI copy names required credentials and scopes without exposing raw tokens, client secrets, API keys, OAuth codes, account values, or local paths.`

failureHandling: `If Applications UI loses service-backed state, exposes local/Paperclip controls, makes provider writes active, or claims screenshot/accessibility completion, ITC-0032 UI evidence fails.`
