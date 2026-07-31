# Contract Fixture Manifest - Chat Message Rendering

id: `fix-contracts-chat-message-rendering-001`

layer: `contract`

productArea: `chat`

requirementIds: `RCSPR-0025`, `RCSPR-0079`, `RCSPR-0114`, `RCSPR-0116`, `RCSPR-0152`, `RCSPR-0163`

sourceMapIds: `SM-0035`, `SM-0122`, `SM-0123`, `SM-0130`, `SM-0155`, `SM-0157`

featureIds: `FI-0030`, `FI-0088`, `FI-0114`, `FI-0143`, `FI-0154`

gapOrDecisionIds: `CHAT-MSR-001`

fixtureKind: `renderer-contract-evidence`

owner: `contracts`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:45:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `MessageRendering.swift`, `ModelContractTests.swift`, `screen-contracts/chat/message-stream-and-rendering.md`, `ITC-0017`

files:

- `contracts/chat/message-rendering-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0017`

validationCommandIds: `VC-0101`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-018-itc-0017-markdown-plain-text-rendering.md`

surface: `Markdown/plain-text renderer plan`

stateKind: `active`

reasonCode: `verified-retained-contract`

decisionIds: `CHAT-MSR-001`

missingPrerequisites: `Manual screenshots and VoiceOver review remain pending; HTML-native rendering remains excluded.`

currentState: `Model contract tests verify retained markdown/plain render plans, block-aware markdown paragraph and list planning, plain text plans, long-message detection, copy text normalization, and html_native fallback-to-plain exclusion warnings.`

notParityStatement: `This fixture does not claim html_native rendering, sanitizer/scoped renderer work, CSS allowlists, constrained web renderers, or HTML fallback pipelines.`

activationRequirement: `UI, visual, and accessibility evidence must cite this renderer contract before claiming rendering closeout.`

releaseImpact: `Provides retained local rendering contract coverage for ITC-0017.`

determinism: `The renderer plan tests use fixed strings, thresholds, metadata, and warnings.`

noFakeProductSeed: `This fixture does not seed product-visible data.`

noSimulatedRuntimeOutput: `This fixture contains no agent output or runtime transcript.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, raw credentials, and runtime snapshots are excluded.`

redactionReview: `Contract samples include only fixed non-secret text and excluded HTML-native source evidence strings.`

failureHandling: `If markdown/plain render plans regress or html_native is no longer excluded, ITC-0017 contract evidence fails.`
