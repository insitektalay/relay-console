# Manual Evidence Manifest - Demo 5 Task Approval Foundation

id: `fix-manual-work-safety-demo-05-task-approval-foundation-001`

layer: `manual-evidence`

productArea: `work-safety`

requirementIds: `RCSPR-0005`, `RCSPR-0006`, `RCSPR-0095`, `RCSPR-0124`, `RCSPR-0175`, `RCSPR-0176`, `RCSPR-0177`, `ITC-0038`

sourceMapIds: `SM-0055`, `SM-0056`, `SM-0057`, `SM-0058`, `SM-0059`, `SM-0060`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0159`

featureIds: `FI-0041`, `FI-0042`, `FI-0043`, `FI-0044`, `FI-0045`, `FI-0046`, `FI-0165`, `FI-0166`, `FI-0167`

gapOrDecisionIds: `ITC-0038`, `ITC-0039`, `ITC-0040`, `ITC-0041`, `APPROVALS-NAV-EXCLUDED-001`

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

sourceBaseline: `implementation-task-cards.md`, `itc-0038-task-and-approval-migration-foundation-packet-dry-run.md`, `ServiceTests.swift`

files:

- `manual-evidence/work-safety/demo-05-task-approval-foundation-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../RelayConsoleMigrationTests/MigrationTests.swift`
- `../RelayConsoleModelContractTests/ModelContractTests.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0038`, `CODE-001-038`

validationCommandIds: `VC-0102`

demoIds: `Demo 5`, `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-038-itc-0038-task-approval-migration-foundation.md`

surface: `Demo 5 task approval safety foundation`

stateKind: `pending`

reasonCode: `manual-demo-05-task-approval-pending`

decisionIds: `APPROVALS-NAV-EXCLUDED-001`

disposition: `partial`

evidenceType: `manual-demo-review`

missingPrerequisites: `Manual reviewer notes, approval resolver UI, standalone Approvals navigation decision, policy enforcement, task dispatch, controlled writes, native file access, and release proof remain later evidence.`

currentState: `Automated tests verify durable redacted inert task and approval records. Demo 5 manual observations are not yet claimed.`

notParityStatement: `This planned manifest is not completed Demo 5 proof, approval execution proof, standalone Approvals proof, controlled-write proof, native file access proof, provider write proof, source-host/local app proof, or release readiness.`

activationRequirement: `Reviewer must update status and attach redacted notes before this manifest can be cited as completed Demo 5 evidence.`

releaseImpact: `Keeps the ITC-0038 manual safety residual explicit while allowing automated foundation evidence to close.`

determinism: `The placeholder uses fixed ids and contains no environment-specific values.`

noFakeProductSeed: `No product-visible task, approval, action-run, source-host, scheduled-message, or audit rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output, approval result, command output, provider result, or task execution output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, source-host records, raw command environments, auth/session data, runtime logs, screenshots, and local filesystem roots are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future manual observations must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified manual Demo 5 proof or executable work proof, ITC-0038 closeout must be downgraded to partial-proof or no-go.`
