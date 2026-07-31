# Service Fixture Manifest - Chat Attachments References

id: `fix-services-chat-attachments-references-001`

layer: `service`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `attachment-reference-service-evidence`

owner: `chat-service`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `automated-test-fixture`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:05:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `ChatService.swift`, `LocalDataService.swift`, `DispatchService.swift`, `screen-contracts/chat/composer-attachments-references.md`

files:

- `services/chat/attachments-references-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0016`

validationCommandIds: `VC-0102`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-017-itc-0016-attachments-references.md`

surface: `Attachment staging, cancel/remove, assignment, limits, and redacted references`

stateKind: `active`

reasonCode: `verified-service-guard`

decisionIds: `none`

missingPrerequisites: `Manual screenshot and VoiceOver review remain pending; Paperclip behavior is excluded.`

currentState: `Service tests stage attachments with progress and redacted provenance, cancel/remove unavailable attachments, enforce the 10 attachment limit, assign staged rows to a message without partial mutation, and create redacted document references.`

notParityStatement: `This fixture does not claim real upload transport, Paperclip link state, or full renderer parity.`

activationRequirement: `UI and visual evidence must link this service proof before claiming user-facing attachment closeout.`

releaseImpact: `Unblocks service-level ITC-0016 evidence while preserving visual and renderer residuals.`

determinism: `Tests use temporary stores, fixed filenames, fixed hashes, fixed status values, and count-based no-side-effect assertions.`

noFakeProductSeed: `The fixture creates only test-owned rows in temporary stores and no product seed data.`

noSimulatedRuntimeOutput: `No runtime output or fake agent reply is produced.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, raw credentials, raw attachment bytes, and runtime snapshots are excluded.`

redactionReview: `Service assertions verify provenance, summaries, and reference metadata do not contain private path strings.`

failureHandling: `If staging, cancel/remove, assignment, limit, or redaction behavior regresses, ITC-0016 service evidence fails.`
