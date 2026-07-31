# Contract Fixture Manifest - Applications Needed Tools

id: `fix-contract-applications-needed-tools-001`

layer: `contract`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0036`, `ITC-0043`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `TOOL-AUTO-GRANT-EXCLUDED-001`

fixtureKind: `codable-model-contract`

owner: `applications-models`

status: `verified`

secretsPolicy: `secret-references-only`

artifactClass: `model-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `model contract evidence`

sourceBaseline: `Models.swift`, `ToolRequestService.swift`, `ModelContractTests.swift`

files:

- `contracts/applications/needed-tools-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`
- `../../Sources/RelayConsoleCore/Models.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0036`, `ITC-0043`

validationCommandIds: `VC-0101`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-036-itc-0036-needed-tools.md`,
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-043-itc-0043-tool-requests-needed-tools-capability-resolution.md`

surface: `ToolRequestRecord, ToolRequestSuggestedApp, NeededToolsSummary, NeededToolsDiagnostics, NeededToolsSnapshot Codable contracts, and scheduled continuation metadata keys`

stateKind: `verified-contract`

reasonCode: `applications-needed-tools-contract`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `TOOL-AUTO-GRANT-EXCLUDED-001`

missingPrerequisites: `Paperclip integration, live grant execution, live install execution, and local file access remain excluded or later.`

currentState: `Contract examples encode durable tool request and Needed Tools snapshot records with no auto-grant, no auto-install, no local file access, scheduled continuation annotations, and redacted evidence.`

notParityStatement: `This fixture does not claim Paperclip parity, automatic grants, app install execution, local file access, screenshot parity, or release readiness.`

activationRequirement: `Grant/install activation requires later permission, audit, task approval, and service authority cards.`

releaseImpact: `Unblocks ITC-0036 and ITC-0043 model contract evidence.`

determinism: `Static JSON fixtures use fixed ids, fixed timestamps, and redacted metadata.`

noFakeProductSeed: `No product-visible records are seeded by this contract fixture.`

noSimulatedRuntimeOutput: `No runtime output is used as contract input.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw credentials, bearer values, local paths, prompts, source-host state, and workspace data are excluded.`

redactionReview: `ToolRequestRecord and NeededToolsSnapshot examples use [REDACTED] evidence, scheduled continuation metadata, and explicit false flags for auto-grant and local file access.`

failureHandling: `If contracts lose ToolRequestRecord, NeededToolsSnapshot, status enums, scheduled continuation metadata, redaction, Paperclip exclusion, or auto-grant exclusion, ITC-0036/ITC-0043 contract evidence fails.`
