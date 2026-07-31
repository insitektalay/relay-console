# Manual Evidence Manifest - Demo 5 Task Scoped Approval Authority

id: `fix-manual-work-safety-demo-05-task-scoped-approval-authority-001`

layer: `manual-evidence`

productArea: `work-safety`

requirementIds: `RCSPR-0007`, `RCSPR-0049`, `RCSPR-0050`, `RCSPR-0096`, `RCSPR-0110`, `RCSPR-0127`, `RCSPR-0131`, `RCSPR-0136`, `RCSPR-0187`, `ITC-0040`

sourceMapIds: `SM-0079`, `SM-0080`, `SM-0081`, `SM-0082`, `SM-0086`, `SM-0128`, `SM-0141`, `SM-0145`, `SM-0146`, `SM-0150`, `SM-0151`, `SM-0155`, `SM-0160`

featureIds: `FI-0057`, `FI-0058`, `FI-0059`, `FI-0065`, `FI-0120`, `FI-0124`, `FI-0128`, `FI-0177`

gapOrDecisionIds: `APPROVALS-NAV-EXCLUDED-001`, `TASK-SCOPED-APPROVAL-UI-RESIDUAL-001`

fixtureKind: `manual-review-placeholder`

owner: `QA evidence`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `manual-evidence`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `itc-0040-approval-queue-resolver-authority-linked-transitions-packet-dry-run.md`, `approvals/queue-and-detail.md`, `ServiceTests.swift`, `WorkSafetyTaskService.swift`

files:

- `manual-evidence/work-safety/demo-05-task-scoped-approval-authority-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/WorkSafetyTaskService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0040`, `CODE-001-040`

validationCommandIds: `VC-0102`

demoIds: `Demo 5`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-040-itc-0040-task-scoped-approval-authority-linked-transitions.md`

surface: `Demo 5 retained task-scoped approval authority placeholder`

stateKind: `pending`

reasonCode: `manual-demo-05-task-scoped-approval-authority-pending`

decisionIds: `APPROVALS-NAV-EXCLUDED-001`

disposition: `partial`

evidenceType: `manual-demo-review`

missingPrerequisites: `Manual reviewer notes, active task-scoped approval UI, visual review, accessibility review, complete audit log parity, permission policy parity, controlled writes, native file access, and release proof remain later evidence.`

currentState: `Automated tests verify retained task-scoped approval authority and linked task transitions. Demo 5 manual observations and active UI evidence are not yet claimed.`

notParityStatement: `This planned manifest is not completed Demo 5 proof, standalone Approvals proof, approval queue/detail proof, controlled-write proof, native file access proof, provider write proof, source-host/local app proof, task execution output proof, or release readiness.`

activationRequirement: `Reviewer must update status and attach redacted notes before this manifest can be cited as completed Demo 5 evidence.`

releaseImpact: `Keeps ITC-0040 manual and UI residuals explicit while allowing retained service authority evidence to close.`

determinism: `The placeholder uses fixed ids and contains no environment-specific values.`

noFakeProductSeed: `No product-visible approval queue, task execution output, runtime action row, source-host row, audit release row, or controlled-write row is seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output, approval result screenshot, command output, provider result, or task execution output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, source-host records, raw command environments, auth/session data, runtime logs, screenshots, and local filesystem roots are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future manual observations must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified manual Demo 5 proof, active UI proof, standalone Approvals proof, controlled-write proof, or executable work proof, ITC-0040 closeout must be downgraded to partial-proof or no-go.`
