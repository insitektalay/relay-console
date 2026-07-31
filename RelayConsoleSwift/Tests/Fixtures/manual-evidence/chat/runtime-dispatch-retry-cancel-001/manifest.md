# Manual Evidence Manifest - Chat Runtime Dispatch Retry Cancel

id: `fix-manual-chat-runtime-dispatch-retry-cancel-001`

layer: `manual-evidence`

productArea: `chat-runtime`

requirementIds: `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0087`, `RCSPR-0093`

sourceMapIds: `SM-0042`, `SM-0077`, `SM-0133`

featureIds: `FI-0031`, `FI-0055`, `FI-0097`

gapOrDecisionIds: `G-0129`, `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`

fixtureKind: `manual-review-placeholder`

owner: `QA evidence`

status: `planned`

secretsPolicy: `no-secrets`

artifactClass: `manual-evidence`

branch: `codex/itc-0018-0020-runtime-dispatch-chat-evidence`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:35:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `DispatchService.swift`, `Views.swift`, `ServiceTests.swift`

files:

- `manual-evidence/chat/runtime-dispatch-retry-cancel-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0018`

validationCommandIds: `VC-0108`

demoIds: `Demo 2`, `Demo 7`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-019-itc-0018-runtime-dispatch-state-retry-cancel.md`

surface: `Manual review record for runtime retry and cancel behavior`

stateKind: `pending`

reasonCode: `manual-review-pending`

decisionIds: `RUNTIME-CHAT-001`, `RUNTIME-CHAT-002`

missingPrerequisites: `Human/manual review with real Hermes/OpenClaw install/auth/health/dispatch/cancel-or-unavailable observations, app version, branch, commit, window size, accessibility notes, duplicate-output check, and redaction status remains required.`

currentState: `Automated contract, service, and source-backed UI evidence exists; this manifest records that real-harness/manual observations are not yet claimed.`

notParityStatement: `This planned manifest is not proof of real runtime output, cancellation in a real Hermes process, OpenClaw restart behavior, screenshot parity, accessibility traversal, relaunch replay, release readiness, or Demo closeout.`

activationRequirement: `Reviewer must update status to reviewed and attach redacted real-harness/manual observations before manual evidence can be cited as proof.`

releaseImpact: `Manual and real-harness closeout remains partial; automated ITC-0018 proof can proceed without claiming release readiness.`

determinism: `The placeholder uses fixed ids and contains no environment-specific values.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, screenshots, prompts, and runtime snapshots are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future manual evidence must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified manual proof, ITC-0018 closeout must be downgraded to partial-proof.`
