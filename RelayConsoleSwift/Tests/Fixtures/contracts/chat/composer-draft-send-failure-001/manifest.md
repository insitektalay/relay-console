# Contract Fixture Manifest - Composer Draft Send Failure

id: `fix-contracts-chat-composer-draft-send-failure-001`

layer: `contract`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `model-contract-evidence`

owner: `contracts`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:14:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Models.swift`, `screen-contracts/chat/composer-attachments-references.md`, `itc-0015-composer-drafts-send-failure-mentions-packet-dry-run.md`

files:

- `contracts/chat/composer-draft-send-failure-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0015`

validationCommandIds: `VC-0101`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-016-itc-0015-composer-drafts-send-failure-mentions.md`

surface: `Composer draft and local send-state contracts`

stateKind: `active`

reasonCode: `verified-retained-contract`

decisionIds: `none`

missingPrerequisites: `Attachment records, mention suggestion payloads, renderer payloads, runtime retry payloads, and full web DTO breadth remain later cards.`

currentState: `Model contract tests round-trip ChatComposerDraft, ChatMentionAvailability, and LocalSendState values while preserving redacted metadata dictionaries.`

notParityStatement: `This fixture does not claim attachment, reference, Paperclip, markdown/HTML rendering, runtime transcript, or full retry parity.`

activationRequirement: `Service and UI evidence must prove how these fields are populated and displayed before product usability is claimed.`

releaseImpact: `Provides retained local contract coverage for ITC-0015 composer behavior.`

determinism: `The contract samples use fixed ids, timestamps, state names, and redacted metadata.`

noFakeProductSeed: `This fixture does not seed product-visible data.`

noSimulatedRuntimeOutput: `This fixture contains no agent output or runtime transcript.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, raw credentials, and runtime snapshots are excluded.`

redactionReview: `Contract samples include only fixed non-secret values and redacted metadata.`

failureHandling: `If local send-state raw values change or draft/mention contracts fail Codable round-trip, ITC-0015 contract evidence fails.`
