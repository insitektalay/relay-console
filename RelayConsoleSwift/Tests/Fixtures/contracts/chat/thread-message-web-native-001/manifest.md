# Contract Fixture Manifest - Thread Message Web Native Compatibility

id: `fix-contracts-chat-thread-message-web-native-001`

layer: `contract`

productArea: `chat`

requirementIds: `RCSPR-0100`, `RCSPR-0144`, `RCSPR-0162`

sourceMapIds: `SM-0116`, `SM-0145`, `SM-0154`, `SM-0157`, `SM-0228`

featureIds: `FI-0081`, `FI-0083`, `FI-0135`, `FI-0153`

gapOrDecisionIds: `SBD-0001`

fixtureKind: `evidence`

owner: `contracts`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `unavailable-evidence`

branch: `codex/itc-0013-0014-chat-state-service`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T21:04:03Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Models.swift`, `implementation-task-cards.md` `ITC-0013`,
`itc-0013-0014-chat-state-service-packet-dry-run.md`, `fixture-catalog.md`

files:

- `contracts/chat/thread-message-web-native-001/manifest.md`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0101`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0005`, `ITC-0013`

validationCommandIds: `VC-0101`

branchPacket:
`evidence/branches/codex-itc-0004-0005-migration-contract-scaffold/evidence-packet.md`
`evidence/branches/codex-itc-0013-0014-chat-state-service/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-006-itc-0005-model-contract-scaffold.md`
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-014-itc-0013-chat-session-thread-state-foundation.md`

surface: `Chat thread and message web compatibility`

stateKind: `active`

reasonCode: `verified-retained-contract`

decisionIds: `SBD-0001`

missingPrerequisites: `Attachment, reference, edit/reply, composer draft, renderer, real runtime transcript, and full visual chat fields remain later task-card scope.`

currentState: `Swift v007 chat models round-trip thread type, active session id, participants, chat sessions, read-state, message session id, and wrap-up report records while preserving metadata dictionaries and legacy defaults.`

notParityStatement: `This verified fixture covers retained v007 chat state contracts only; it is not parity for attachments, references, HTML-native rendering, Paperclip, composer drafts, runtime proof, or full Web thread DTO breadth.`

activationRequirement: `Later Slice 4 cards must add concrete contract fixtures for retained attachment/reference/rendering/runtime fields before those fields can be claimed supported.`

releaseImpact: `Unblocks ITC-0013 retained chat-state model evidence while preserving residuals for later chat cards.`

determinism: `The model contract tests use fixed JSON samples for v007 retained fields, legacy defaults, and ignored unsupported web-only fields.`

noFakeProductSeed: `This fixture does not seed product-visible data.`

noSimulatedRuntimeOutput: `This fixture contains no runtime output.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, and raw credentials are excluded.`

redactionReview: `Model contract tests plus branch evidence redaction scan.`

failureHandling: `If unknown fields stop decoding safely or unsupported fields are claimed as parity, contract scaffold closeout fails.`
