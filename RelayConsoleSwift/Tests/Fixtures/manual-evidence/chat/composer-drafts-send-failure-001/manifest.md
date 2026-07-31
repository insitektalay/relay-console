# Manual Evidence Manifest - Chat Composer Drafts Send Failure

id: `fix-manual-chat-composer-drafts-send-failure-001`

layer: `manual-evidence`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `manual-review-placeholder`

owner: `QA evidence`

status: `planned`

secretsPolicy: `no-secrets`

artifactClass: `manual-evidence`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:20:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `ServiceTests.swift`

files:

- `manual-evidence/chat/composer-drafts-send-failure-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0015`

validationCommandIds: `VC-0108`

demoIds: `Demo 2`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-016-itc-0015-composer-drafts-send-failure-mentions.md`

surface: `Manual review record for composer draft, keyboard, failed local send, and mention-unavailable states`

stateKind: `pending`

reasonCode: `manual-review-pending`

decisionIds: `none`

missingPrerequisites: `Human/manual review with branch, commit, app version, window size, source data, screenshots or notes, accessibility observations, and redaction status remains required.`

currentState: `Automated source, migration, contract, and service evidence exists; this manifest records that manual Demo 2/Demo 8 observations are not yet claimed.`

notParityStatement: `This planned manifest is not proof of manual review, screenshot parity, accessibility traversal, release readiness, or real runtime transcript behavior.`

activationRequirement: `Reviewer must update status to reviewed and attach branch-local observations before manual evidence can be cited as proof.`

releaseImpact: `Manual closeout remains partial; automated ITC-0015 proof can proceed without claiming release readiness.`

determinism: `The placeholder uses fixed branch, task, and fixture ids and contains no environment-specific values.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, screenshots, and runtime snapshots are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future manual evidence must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified manual proof, ITC-0015 closeout must be downgraded to partial-proof.`
