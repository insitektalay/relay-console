# Event Replay Fixture Manifest - Work Safety Task Approval Foundation Relaunch

id: `fix-events-work-safety-task-approval-foundation-relaunch-001`

layer: `event-replay`

productArea: `work-safety`

requirementIds: `RCSPR-0005`, `RCSPR-0006`, `RCSPR-0095`, `RCSPR-0124`, `RCSPR-0175`, `RCSPR-0176`, `RCSPR-0177`, `ITC-0038`

sourceMapIds: `SM-0055`, `SM-0056`, `SM-0057`, `SM-0058`, `SM-0059`, `SM-0060`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0159`

featureIds: `FI-0041`, `FI-0042`, `FI-0043`, `FI-0044`, `FI-0045`, `FI-0046`, `FI-0165`, `FI-0166`, `FI-0167`

gapOrDecisionIds: `ITC-0038`, `ITC-0039`, `ITC-0040`, `APPROVALS-NAV-EXCLUDED-001`

fixtureKind: `work-safety-event-replay-plan`

owner: `work-safety-service`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `event-replay-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `event replay evidence`

sourceBaseline: `EventBus.swift`, `LocalDataService.swift`, `EventReplayTests.swift`

files:

- `events/work-safety/task-approval-foundation-relaunch-001/manifest.md`
- `../RelayConsoleEventReplayTests/EventReplayTests.swift`
- `../../Sources/RelayConsoleCore/EventBus.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0103`
- `swift run RelayConsoleEventReplayTests`

implementationTaskIds: `ITC-0038`, `CODE-001-038`

validationCommandIds: `VC-0103`

demoIds: `Demo 7`, `Demo 5`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-038-itc-0038-task-approval-migration-foundation.md`

surface: `Task and approval event publication plus relaunch survival boundary`

stateKind: `planned-event-replay`

reasonCode: `task-approval-relaunch-plan`

decisionIds: `APPROVALS-NAV-EXCLUDED-001`

missingPrerequisites: `Real relaunch capture, standalone Approvals review, approval resolver workflows, task dispatch, policy enforcement, controlled writes, and native file access remain later evidence.`

currentState: `Service tests publish workSafetyTaskUpdated and workSafetyApprovalUpdated events and reopen persisted records; this manifest tracks future Demo 7 relaunch aggregation without claiming completed relaunch capture.`

notParityStatement: `This planned manifest is not executable task dispatch proof, approval resolution proof, standalone Approvals proof, controlled-write proof, source-host/local app proof, or release readiness.`

activationRequirement: `A future reviewer must attach redacted replay or relaunch artifacts and update status before this manifest can be cited as completed Demo 7 evidence.`

releaseImpact: `Keeps ITC-0038 relaunch residuals visible while the verified foundation remains limited to durable inert records.`

determinism: `The placeholder uses fixed ids and references deterministic service and event tests; it does not add product-visible replay rows.`

noFakeProductSeed: `No product-visible task, approval, action-run, source-host, scheduled-message, or audit rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output, approval result, command output, provider result, or task execution output is generated or stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompts, source-host records, raw command environments, auth/session data, runtime logs, and local filesystem roots are excluded.`

redactionReview: `Placeholder text contains no secrets; future replay artifacts must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified relaunch evidence or executable work proof, ITC-0038 closeout must be downgraded to partial-proof or no-go.`
