# Accessibility Fixture Manifest - Disabled Focus Copy Feedback

id: `fix-accessibility-core-disabled-focus-copy-feedback-001`

layer: `accessibility`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0005`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `accessibility-source-audit`

owner: `accessibility`

status: `planned`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-review`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`, `RelayConsoleAppUI`, `RelayConsoleAppAccessibilityInventoryHarness`, `RCAccessibilityEvidenceMatrix`, `ui-visual-a11y-manual-evidence-review-rubric.md`

files:

- `accessibility/core/disabled-focus-copy-feedback-001/manifest.md`
- `accessibility/core/app-accessibility-inventory-001/manifest.md`
- `accessibility/core/retained-surface-app-accessibility-inventory-001/manifest.md`
- `visual/all-surfaces/rendered-state-scenario-feasibility-001/manifest.md`
- `evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json`
- `evidence/accessibility-app-inventory/run-006-code-006-003/retained-surface-accessibility-inventory.json`
- `evidence/visual-state-scenarios/run-008-code-008-001/state-scenario-capture-feasibility.md`
- `../RelayConsoleAppAccessibilityInventoryHarness/AppAccessibilityInventoryHarness.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleAppAccessibilityInventoryHarness --output evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json`
- `swift run RelayConsoleAppAccessibilityInventoryHarness --all-surfaces --output evidence/accessibility-app-inventory/run-006-code-006-003/retained-surface-accessibility-inventory.json`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0053-0054-visual-accessibility-polish/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-053-itc-0054-accessibility-manual-matrix.md`, `loop-runs/005-app-window-visual-capture-and-a11y-proof-attempt/reports/CODE-005-003-accessibility-inventory.md`, `loop-runs/006-all-surface-visual-navigation-capture/reports/CODE-006-003-retained-surface-accessibility-inventory.md`, `loop-runs/007-assistive-human-review-residuals/reports/CODE-007-001-assistive-review-packet.md`, `loop-runs/008-rendered-state-scenario-evidence-readiness/reports/CODE-008-001-state-scenario-capture-feasibility.md`, `loop-runs/008-rendered-state-scenario-evidence-readiness/reports/CODE-008-003-state-scenario-evidence-integration.md`

run002FeasibilityTaskId: `CODE-002-003`

run002FeasibilityReport:
`loop-runs/002-release-blocker-remediation-and-screen-contract-revalidation/reports/CODE-002-003-demo-08-visual-accessibility-feasibility.md`

run002FeasibilityStatus: `blocked/manual`

run002AccessibilityCaptureResult: `No current-branch keyboard traversal, VoiceOver/help-label review, focus-order review, focus-visibility capture, contrast result, disabled/submitting exposure review, copy-feedback review, icon-only label review, or long-content accessibility result was captured in this environment.`

run002BlockedReason: `The source exposes accessibility anchors, but the environment does not provide an app-targeted assistive review harness with reviewer setup, redaction, keyboard traversal logging, VoiceOver output, focus visibility capture, or contrast measurement.`

run002NoProofStatement: `This feasibility check does not upgrade planned/partial evidence to release proof.`

run003AccessibilityHarnessTaskId: `CODE-003-002`

run003AccessibilityHarnessManifest:
`accessibility/core/redaction-safe-accessibility-harness-001/manifest.md`

run003AccessibilityHarnessArtifact:
`evidence/accessibility-capture/run-003-code-003-002/accessibility-metadata.json`

run003AccessibilityHarnessStatus: `structured-accessibility-metadata-not-assistive-session`

run003AccessibilityHarnessNoProofStatement: `The Run 003 accessibility harness emits source-backed metadata only; it does not prove keyboard traversal, VoiceOver/help, focus order, focus visibility, contrast, copy feedback announcements, long-content assistive review, release-human-review, or release readiness.`

run003CaptureAttemptTaskId: `CODE-003-003`

run003CaptureAttemptReport:
`loop-runs/003-demo-8-redaction-safe-visual-accessibility-evidence/reports/CODE-003-003-demo-8-capture-attempt.md`

run003CaptureAttemptStatus: `blocked/manual`

run003CaptureAttemptResult: `The visual and accessibility harnesses were rerun and produced metadata-only artifacts; no keyboard traversal log, VoiceOver/help-label transcript, focus-order result, focus-visibility capture, contrast measurement, copy-feedback announcement review, icon-only assistive review, or long-content accessibility result was captured.`

run003CaptureAttemptNoProofStatement: `The CODE-003-003 capture attempt does not upgrade source anchors, metadata-only artifacts, planned rows, or blocked/manual rows to accessibility proof or release proof.`

run003CaptureAttemptNextRequiredEvidence: `Run current-branch keyboard traversal, VoiceOver/help, focus, contrast, disabled/submitting, copy feedback, icon-only label, and long-content review with redaction before verification.`

run004AssistiveReviewTaskId: `CODE-004-002`

run004AssistiveReviewRunbook:
`evidence/accessibility-review/run-004-code-004-002/assistive-review-runbook.md`

run004AssistiveReviewStatus: `readiness-only-not-captured`

run004AssistiveReviewResult: `CODE-004-002 produced an executable assistive-review runbook for temporary no-private local state; no keyboard traversal, VoiceOver/help, focus, contrast, copy-feedback, long-content, human-review, or release-proof artifact was captured.`

run004AssistiveReviewNoProofStatement: `The CODE-004-002 runbook does not upgrade source anchors, readiness metadata, planned rows, blocked/manual rows, or metadata-only artifacts to accessibility proof or release proof.`

run004AssistiveReviewNextRequiredEvidence: `Launch Relay Console with RELAY_CONSOLE_USER_DATA_PATH set to a temporary root and capture reviewed keyboard, VoiceOver/help, focus, contrast, copy-feedback, and long-content artifacts with redaction and reviewer metadata.`

run007AssistiveReviewPacketTaskId: `CODE-007-001`

run007AssistiveReviewPacketStatus: `per-surface-review-fields-ready-not-captured`

run007AssistiveReviewPacketResult: `CODE-007-001 updates the assistive-review runbook with retained per-surface reviewer fields; no keyboard traversal, VoiceOver/help, focus, contrast, copy-feedback, long-content, human-review, or release-proof artifact was captured.`

run007AssistiveReviewPacketNoProofStatement: `The CODE-007-001 runbook update does not upgrade source anchors, readiness metadata, captured screenshots, source/view-hierarchy inventory, planned rows, blocked/manual rows, or metadata-only artifacts to accessibility proof or release proof.`

run005AccessibilityInventoryTaskId: `CODE-005-003`

run005AccessibilityInventoryManifest:
`accessibility/core/app-accessibility-inventory-001/manifest.md`

run005AccessibilityInventoryArtifact:
`evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json`

run005AccessibilityInventoryStatus: `source-and-view-hierarchy-inventory-captured`

run005AccessibilityInventoryMode: `source-anchor-and-rendered-view-hierarchy-inventory-not-voiceover-session`

run005AccessibilityInventoryResult: `CODE-005-003 captured a source-anchor and rendered view-hierarchy inventory from temporary no-private local state; named AppKit accessibility nodes were not captured and no keyboard traversal, VoiceOver/help output, focus order, focus visibility, contrast, copy feedback, long-content, human-review, or release-proof artifact was produced.`

run005AccessibilityInventoryNoProofStatement: `The CODE-005-003 accessibility inventory does not upgrade source anchors, rendered view roles, readiness metadata, planned rows, blocked/manual rows, or metadata-only artifacts to accessibility proof or release proof.`

run005AccessibilityInventoryNextRequiredEvidence: `Run current-branch keyboard traversal, VoiceOver/help, focus, contrast, copy feedback, and long-content assistive review with redaction and reviewer metadata before verification.`

run006AccessibilityInventoryTaskId: `CODE-006-003`

run006AccessibilityInventoryManifest:
`accessibility/core/retained-surface-app-accessibility-inventory-001/manifest.md`

run006AccessibilityInventoryArtifact:
`evidence/accessibility-app-inventory/run-006-code-006-003/retained-surface-accessibility-inventory.json`

run006AccessibilityInventoryStatus: `retained-surface-source-and-view-hierarchy-inventory-captured`

run006AccessibilityInventoryMode: `source-anchor-and-rendered-view-hierarchy-inventory-not-voiceover-session`

run006AccessibilityInventoryResult: `CODE-006-003 captured a source-anchor and rendered view-hierarchy inventory for retained top-level surfaces from temporary no-private local state; named AppKit accessibility nodes were not captured and no keyboard traversal, VoiceOver/help output, focus order, focus visibility, contrast, copy feedback, long-content, human-review, or release-proof artifact was produced.`

run006AccessibilityInventoryNoProofStatement: `The CODE-006-003 retained-surface accessibility inventory does not upgrade source anchors, rendered view roles, readiness metadata, planned rows, blocked/manual rows, or metadata-only artifacts to accessibility proof or release proof.`

run006AccessibilityInventoryNextRequiredEvidence: `Run current-branch keyboard traversal, VoiceOver/help, focus, contrast, copy feedback, and long-content assistive review with redaction and reviewer metadata before verification.`

run008StateScenarioFeasibilityTaskId: `CODE-008-001`

run008StateScenarioFeasibilityStatus: `feasibility-captured-state-scenarios-not-rendered-proof`

run008StateScenarioCaptureHarnessStatus: `blocked-scenario-data-boundary-required`

renderedStateScenarioHarnessStatus: `not-yet-safe-to-implement-as-proof`

scenarioDataBoundaryStatus: `required-before-capture-harness`

reviewMatrix: `keyboard traversal, VoiceOver/help labels, focus visibility, disabled/submitting exposure, copy feedback, icon-only labels, contrast, non-color status, selected rows, guarded nav, avatar/app icon fallbacks, and long-content controls.`

keyboardEvidence: `Command-N New Chat, composer submit, attach/remove, copy, retry/cancel, archive, refresh, search, guarded nav, AgentOps layout toggles, and Settings/Insights controls are source-visible.`

accessibilityEvidence: `Avatar labels, deterministic app icon labels, status badges, role badges, copy labels, disabled hints, guarded reason labels, and source-backed unavailable copy are source-visible.`

focusEvidence: `focus visibility and focus order remain planned manual review rows; source uses native SwiftUI controls where possible.`

contrastEvidence: `non-color status text exists through StatusBadge and visible copy; final contrast measurement remains planned.`

stateCoverage: `disabled, submitting, pending, retry, error, copy success, copy unavailable, selected, blocked, permission-needed, approval-required, read-only, decision-gated, and unavailable states.`

notParityStatement: `This accessibility source audit does not claim completed keyboard traversal, VoiceOver session, focus-order pass, contrast pass, state-scenario screenshot proof, or release readiness.`

activationRequirement: `Run current-branch keyboard, VoiceOver/help, focus, contrast, disabled/submitting, copy feedback, and long-content review before verification.`

determinism: `Stable labels, source anchors, validation ids, ITC-0054 id, SM-0268 id, and Demo 8 id make the accessibility fixture deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, applications, AgentOps rows, approvals, reports, screenshots, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime output, mock AgentOps event, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Private paths, account values, local files, credentials, raw runtime transcripts, and screenshot artifacts are excluded.`

redactionReview: `RelayConsoleVisualEvidenceTests validates source anchors; future assistive review notes require explicit redaction review.`

failureHandling: `Unlabeled icon-only control, color-only status, unreachable keyboard path, missing disabled reason, missing copy feedback, missing D-0005 residual, or stale source blocks verification.`

releaseImpact: `Provides ITC-0054 accessibility matrix anchors, retained-surface source/view-hierarchy inventory, and blocked state-scenario feasibility only; release accessibility remains partial until manual assistive review is captured.`
