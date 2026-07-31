# Contract Fixture Manifest - Chat Attachments References

id: `fix-contracts-chat-attachments-references-001`

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

capturedAt: `2026-06-22T23:05:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Models.swift`, `screen-contracts/chat/composer-attachments-references.md`, `ITC-0016`

files:

- `contracts/chat/attachments-references-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0016`

validationCommandIds: `VC-0101`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-017-itc-0016-attachments-references.md`

surface: `Attachment and document reference model contracts`

stateKind: `active`

reasonCode: `verified-retained-contract`

decisionIds: `none`

missingPrerequisites: `Message renderer parity, Paperclip link payloads, and screenshot evidence remain later or excluded scope.`

currentState: `Model contract tests round-trip ChatAttachment, ChatDocumentReference, ChatAttachmentKind, ChatAttachmentStatus, and ChatDocumentReferenceKind with redacted provenance/reference metadata.`

notParityStatement: `This fixture does not claim Paperclip, browser upload transport, markdown/HTML rendering, or full web DTO breadth.`

activationRequirement: `Service and UI evidence must prove how these fields are populated and displayed before product usability is claimed.`

releaseImpact: `Provides retained local contract coverage for ITC-0016 attachment and reference behavior.`

determinism: `The contract samples use fixed ids, timestamps, hashes, status names, and redacted metadata.`

noFakeProductSeed: `This fixture does not seed product-visible data.`

noSimulatedRuntimeOutput: `This fixture contains no agent output or runtime transcript.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, raw credentials, local file bytes, and runtime snapshots are excluded.`

redactionReview: `Contract samples include only fixed non-secret values, hashes, filenames, and redacted metadata.`

failureHandling: `If attachment/reference raw values change or Codable round-trip fails, ITC-0016 contract evidence fails.`
