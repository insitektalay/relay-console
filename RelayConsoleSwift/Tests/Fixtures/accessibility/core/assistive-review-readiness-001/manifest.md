# Accessibility Fixture Manifest - Assistive Review Readiness

id: `fix-accessibility-core-assistive-review-readiness-001`

layer: `accessibility`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0005`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `manual-note`

owner: `accessibility`

status: `source-backed`

disposition: `partial`

secretsPolicy: `no-secrets`

artifactClass: `assistive-review-readiness`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `RelayConsoleServices.swift`, `RelayConsoleApp.swift`, `Views.swift`, `UIComponents.swift`, `Run 003 accessibility metadata`, `Run 004 capture readiness artifact`, `Run 006 retained-surface visual artifacts`, `Run 006 retained-surface accessibility inventory`

files:

- `accessibility/core/assistive-review-readiness-001/manifest.md`
- `evidence/accessibility-review/run-004-code-004-002/assistive-review-runbook.md`
- `evidence/visual-app-window/run-006-code-006-001/retained-surface-visual-snapshots.json`
- `evidence/accessibility-app-inventory/run-006-code-006-003/retained-surface-accessibility-inventory.json`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`

validationCommandIds: `VC-0107`, `VC-0108`

demoIds: `Demo 8`

reportIds:
`loop-runs/004-demo-8-app-capture-readiness-and-human-review/reports/CODE-004-002-assistive-review-readiness.md`, `loop-runs/007-assistive-human-review-residuals/reports/CODE-007-001-assistive-review-packet.md`

run004AssistiveReviewTaskId: `CODE-004-002`

run004AssistiveReviewRunbook:
`evidence/accessibility-review/run-004-code-004-002/assistive-review-runbook.md`

run004AssistiveReviewStatus: `readiness-only-not-captured`

run007AssistiveReviewPacketTaskId: `CODE-007-001`

run007AssistiveReviewPacketStatus: `per-surface-review-fields-ready-not-captured`

run007AssistiveReviewPacketResult: `CODE-007-001 updates the assistive-review runbook with per-surface retained review fields for Chats, Agents, AgentOps HQ, Applications, Insights, and Settings, but does not capture keyboard traversal, VoiceOver/help output, focus, contrast, copy-feedback, long-content, human-review, or release-proof artifacts.`

run007AssistiveReviewPacketNoProofStatement: `Per-surface reviewer fields are readiness evidence only; they do not upgrade Run 006 screenshots, source/view-hierarchy inventory, planned rows, or blocked/manual rows to assistive or release proof.`

temporaryUserDataEnvironmentKey: `RELAY_CONSOLE_USER_DATA_PATH`

privacyMode: `temporary-no-private-local-state`

keyboardTraversalStatus: `not-captured`

voiceOverHelpStatus: `not-captured`

focusOrderStatus: `not-captured`

focusVisibilityStatus: `not-captured`

contrastStatus: `not-measured`

copyFeedbackStatus: `not-captured`

longContentAssistiveStatus: `not-captured`

humanReviewerStatus: `not-reviewed`

perSurfaceAssistiveReviewStatus: `not-captured`

releaseProof: `false`

reviewMatrix: `per-surface retained review fields for Chats, Agents, AgentOps HQ, Applications, Insights, Settings; keyboard traversal, VoiceOver/help labels, focus order, focus visibility, disabled/submitting exposure, copy feedback, icon-only labels, contrast, non-color status, selected rows, guarded nav, avatar/app icon fallbacks, and long-content controls.`

notParityStatement: `This readiness fixture does not contain keyboard traversal, VoiceOver/help output, focus review, contrast measurement, copy-feedback review, long-content assistive review, human reviewer signoff, or release proof.`

activationRequirement: `Launch Relay Console with RELAY_CONSOLE_USER_DATA_PATH set to a temporary root and capture reviewed assistive artifacts with branch, app-version, window, state, redaction, reviewer, and residual metadata.`

determinism: `Environment key, runbook path, fixture id, validation ids, ITC-0054 id, SM-0268 id, and Demo 8 id make the readiness fixture deterministic.`

noFakeProductSeed: `The readiness fixture does not seed chats, agents, applications, AgentOps rows, approvals, reports, screenshots, accessibility transcripts, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime output, mock AgentOps event, fabricated VoiceOver transcript, or simulated keyboard traversal is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Assistive review must use a temporary local state root and redact any private path, account value, local file detail, credential, or raw runtime transcript.`

redactionReview: `RelayConsoleVisualEvidenceTests and scoped redaction scans; future reviewer notes require explicit redaction reviewer signoff.`

failureHandling: `Missing keyboard traversal, VoiceOver/help, focus, contrast, copy feedback, long-content review, reviewer metadata, or redaction keeps this row partial or residual-blocker.`

releaseImpact: `Provides an executable per-surface assistive-review checklist for ITC-0054; release accessibility/manual rows remain blocked until reviewed artifacts exist.`
