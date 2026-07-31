# Manual Evidence Manifest - Demo 7 Audit Relaunch

id: `fix-manual-recovery-demo-07-audit-relaunch-001`

layer: `manual-evidence`

productArea: `recovery`

requirementIds: `RCSPR-0007`, `RCSPR-0052`, `RCSPR-0096`, `RCSPR-0110`, `RCSPR-0127`, `RCSPR-0131`, `RCSPR-0136`, `RCSPR-0137`, `RCSPR-0188`, `ITC-0042`

sourceMapIds: `SM-0081`, `SM-0084`, `SM-0085`, `SM-0086`, `SM-0111`, `SM-0145`, `SM-0146`, `SM-0148`, `SM-0150`, `SM-0151`, `SM-0155`, `SM-0160`

featureIds: `FI-0061`, `FI-0065`, `FI-0120`, `FI-0124`, `FI-0128`, `FI-0178`

gapOrDecisionIds: `ITC-0042`

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

sourceBaseline: `implementation-task-cards.md`, `itc-0042-audit-log-security-metrics-redaction-packet-dry-run.md`, `ServiceTests.swift`

files:

- `manual-evidence/recovery/demo-07-audit-relaunch-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/AuditSecurityService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0042`, `CODE-001-042`

validationCommandIds: `VC-0102`

demoIds: `Demo 7`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-042-itc-0042-audit-log-security-metrics-redaction.md`

surface: `Demo 7 audit relaunch and redacted metric recovery`

stateKind: `pending`

reasonCode: `manual-demo-07-audit-relaunch-pending`

decisionIds: `none`

disposition: `partial`

evidenceType: `manual-demo-review`

missingPrerequisites: `Manual reviewer notes, redacted export review, audit/security UI proof, controlled-write evidence, native file access evidence, and release aggregation remain later evidence.`

currentState: `Automated service tests verify audit rows survive relaunch and security metrics recompute from durable audit source records. Demo 7 manual observations are not yet claimed.`

notParityStatement: `This planned manifest is not completed Demo 7 proof, export proof, release proof, audit/security UI proof, or controlled-write recovery proof.`

activationRequirement: `Reviewer must update status and attach redacted relaunch/export notes before this manifest can be cited as completed Demo 7 evidence.`

releaseImpact: `Keeps ITC-0042 relaunch and redacted-export manual residuals explicit while allowing automated persistence evidence to close.`

determinism: `The placeholder uses fixed ids and contains no environment-specific values.`

noFakeProductSeed: `No product-visible audit rows, metric rows, task runs, command results, export results, reset results, or recovery rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output, command output, provider result, export result, reset result, file access result, or task execution output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Credentials, tokens, command arguments, environment values, runtime payloads, screenshots, exports, and local filesystem roots are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future manual observations and export notes must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified manual Demo 7 proof, export proof, UI proof, or release proof, ITC-0042 closeout must be downgraded to partial-proof or no-go.`
