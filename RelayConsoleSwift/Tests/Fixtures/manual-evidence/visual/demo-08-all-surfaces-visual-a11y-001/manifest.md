# Manual Evidence Manifest - Demo 8 All Surfaces Visual A11y

id: `fix-manual-evidence-visual-demo-08-all-surfaces-visual-a11y-001`

layer: `manual-evidence`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0004`, `D-0005`, `D-0006`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `manual-note`

owner: `QA evidence`

status: `planned`

disposition: `partial`

evidenceType: `screenshot-review`

secretsPolicy: `no-secrets`

artifactClass: `manual-evidence`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewedAt: `planned`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`, `RelayConsoleAppUI`, `RelayConsoleAppVisualSnapshotHarness`, `RelayConsoleAppAccessibilityInventoryHarness`, `RCAccessibilityEvidenceMatrix`, `visual/all-surfaces/standard-minimum-window-matrix-001`, `accessibility/core/disabled-focus-copy-feedback-001`, `accessibility/core/app-accessibility-inventory-001`, `ui-visual-a11y-manual-evidence-review-rubric.md`

files:

- `manual-evidence/visual/demo-08-all-surfaces-visual-a11y-001/manifest.md`
- `visual/all-surfaces/app-window-snapshots-001/manifest.md`
- `visual/all-surfaces/retained-surface-app-window-snapshots-001/manifest.md`
- `visual/all-surfaces/all-state-long-content-residual-matrix-001/manifest.md`
- `visual/all-surfaces/rendered-state-scenario-feasibility-001/manifest.md`
- `accessibility/core/app-accessibility-inventory-001/manifest.md`
- `accessibility/core/retained-surface-app-accessibility-inventory-001/manifest.md`
- `evidence/visual-app-window/run-005-code-005-001/app-window-visual-snapshots.json`
- `evidence/visual-app-window/run-006-code-006-001/retained-surface-visual-snapshots.json`
- `evidence/visual-all-state-residuals/run-007-code-007-002/all-state-long-content-residual-matrix.md`
- `evidence/visual-state-scenarios/run-008-code-008-001/state-scenario-capture-feasibility.md`
- `evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json`
- `evidence/accessibility-app-inventory/run-006-code-006-003/retained-surface-accessibility-inventory.json`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0053-0054-visual-accessibility-polish/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-053-itc-0054-accessibility-manual-matrix.md`, `loop-runs/005-app-window-visual-capture-and-a11y-proof-attempt/reports/CODE-005-001-app-window-visual-capture.md`, `loop-runs/005-app-window-visual-capture-and-a11y-proof-attempt/reports/CODE-005-003-accessibility-inventory.md`, `loop-runs/006-all-surface-visual-navigation-capture/reports/CODE-006-001-retained-surface-visual-capture.md`, `loop-runs/006-all-surface-visual-navigation-capture/reports/CODE-006-003-retained-surface-accessibility-inventory.md`, `loop-runs/007-assistive-human-review-residuals/reports/CODE-007-001-assistive-review-packet.md`, `loop-runs/007-assistive-human-review-residuals/reports/CODE-007-002-all-state-long-content-residual-matrix.md`, `loop-runs/008-rendered-state-scenario-evidence-readiness/reports/CODE-008-001-state-scenario-capture-feasibility.md`, `loop-runs/008-rendered-state-scenario-evidence-readiness/reports/CODE-008-002-state-scenario-capture-harness-blocked.md`, `loop-runs/008-rendered-state-scenario-evidence-readiness/reports/CODE-008-003-state-scenario-evidence-integration.md`

run002FeasibilityTaskId: `CODE-002-003`

run002FeasibilityReport:
`loop-runs/002-release-blocker-remediation-and-screen-contract-revalidation/reports/CODE-002-003-demo-08-visual-accessibility-feasibility.md`

run002FeasibilityStatus: `blocked/manual`

run002CaptureResult: `No current-branch standard-window screenshot, minimum-window screenshot, keyboard traversal result, VoiceOver/help-label result, focus-order result, focus-visibility result, contrast result, or long-content visual result was captured in this environment.`

run002BlockedReason: `Only host-level screencapture/osascript tooling and packaged macOS app artifacts were available; the package does not include an app-targeted UI automation, window-capture, redaction, keyboard traversal, VoiceOver, focus, contrast, or long-content capture harness, and host-screen capture could expose private desktop or local app state.`

run002NoProofStatement: `This feasibility check does not upgrade planned/partial evidence to release proof.`

run002NextRequiredEvidence: `Manual reviewer must capture redacted app-targeted standard/minimum-window evidence, keyboard traversal, VoiceOver/help labels, focus, contrast, long-content, and release-human-review signoff before verification.`

run003VisualHarnessTaskId: `CODE-003-001`

run003VisualHarnessManifest:
`visual/all-surfaces/redaction-safe-capture-harness-001/manifest.md`

run003VisualHarnessArtifact:
`evidence/visual-capture/run-003-code-003-001/visual-capture-metadata.json`

run003VisualHarnessStatus: `structured-metadata-not-screenshot`

run003VisualHarnessNoProofStatement: `The Run 003 harness emits redaction-safe app-targeted metadata only; it does not prove screenshots, keyboard traversal, VoiceOver/help, focus, contrast, long-content layout, release-human-review, or release readiness.`

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

run003CaptureAttemptResult: `The visual and accessibility harnesses were rerun and produced metadata-only artifacts; no screenshots, keyboard traversal, VoiceOver/help, focus order, focus visibility, contrast, copy feedback announcement, long-content review, redaction-reviewed visual artifact, release-human-review artifact, or release proof was captured.`

run003CaptureAttemptNoProofStatement: `The CODE-003-003 capture attempt does not upgrade metadata-only artifacts, source anchors, planned rows, captured-only rows, blocked/manual rows, unreviewed rows, or partial rows to Demo 8 proof or release proof.`

run003CaptureAttemptNextRequiredEvidence: `Manual reviewer must capture current-branch redacted standard/minimum-window visual evidence, keyboard traversal, VoiceOver/help review, focus and contrast notes, long-content review, redaction review, and release-human-review signoff before verification.`

run004CaptureReadinessTaskId: `CODE-004-001`

run004CaptureReadinessArtifact:
`evidence/capture-readiness/run-004-code-004-001/capture-readiness.json`

run004CaptureReadinessStatus: `temporary-user-data-path-supported-screenshot-not-captured`

run004CaptureReadinessResult: `Relay Console Swift now supports a RELAY_CONSOLE_USER_DATA_PATH launch override for temporary no-private local state; CODE-004-001 did not launch the GUI app, capture app-window screenshots, or run keyboard/VoiceOver/focus/contrast review.`

run004CaptureReadinessNoProofStatement: `The CODE-004-001 readiness audit does not upgrade source anchors, readiness metadata, metadata-only artifacts, planned rows, or blocked/manual rows to Demo 8 proof or release proof.`

run004CaptureReadinessNextRequiredEvidence: `Run the app with RELAY_CONSOLE_USER_DATA_PATH set to a temporary root, capture redacted app-targeted standard/minimum-window artifacts, and record keyboard traversal, VoiceOver/help, focus, contrast, long-content, redaction, and reviewer disposition.`

run004AssistiveReviewTaskId: `CODE-004-002`

run004AssistiveReviewRunbook:
`evidence/accessibility-review/run-004-code-004-002/assistive-review-runbook.md`

run004AssistiveReviewStatus: `readiness-only-not-captured`

run004AssistiveReviewResult: `CODE-004-002 produced the keyboard/VoiceOver/focus/contrast/copy-feedback/long-content review checklist for temporary no-private local state; no assistive-review artifact or reviewer signoff was captured.`

run004AssistiveReviewNoProofStatement: `The CODE-004-002 runbook does not upgrade readiness metadata, source anchors, metadata-only artifacts, planned rows, or blocked/manual rows to Demo 8 proof or release proof.`

run007AssistiveReviewPacketTaskId: `CODE-007-001`

run007AssistiveReviewPacketStatus: `per-surface-review-fields-ready-not-captured`

run007AssistiveReviewPacketResult: `CODE-007-001 updates the assistive-review runbook with retained per-surface reviewer fields for Run 006 surfaces; no keyboard traversal, VoiceOver/help, focus, contrast, copy-feedback, long-content, redaction/human reviewer disposition, or release-readiness artifact was captured.`

run007AssistiveReviewPacketNoProofStatement: `The CODE-007-001 runbook update does not complete all-surfaces Demo 8 accessibility review and does not upgrade planned, partial, captured-only, inventory-only, metadata-only, readiness-only, or blocked/manual rows to release proof.`

run007AllStateResidualMatrixTaskId: `CODE-007-002`

run007AllStateResidualMatrixArtifact:
`evidence/visual-all-state-residuals/run-007-code-007-002/all-state-long-content-residual-matrix.md`

run007AllStateResidualMatrixStatus: `source-backed-residual-matrix-not-rendered-proof`

run007AllStateResidualMatrixResult: `CODE-007-002 identifies missing all-state and long-content evidence for retained surfaces and guarded states; it did not capture rendered screenshots, assistive output, or human review.`

run007AllStateResidualMatrixNoProofStatement: `The CODE-007-002 matrix does not complete all-surfaces Demo 8 visual or accessibility review and does not upgrade planned, partial, captured-only, inventory-only, metadata-only, readiness-only, or blocked/manual rows to release proof.`

allStateVisualStatus: `not-captured`

longContentVisualStatus: `not-reviewed`

minimumWindowStateMatrixStatus: `partial-top-level-only`

assistiveReviewStatus: `not-captured`

humanReviewerStatus: `not-reviewed`

releaseProof: `false`

run008StateScenarioFeasibilityTaskId: `CODE-008-001`

run008StateScenarioFeasibilityArtifact:
`evidence/visual-state-scenarios/run-008-code-008-001/state-scenario-capture-feasibility.md`

run008StateScenarioFeasibilityStatus: `feasibility-captured-state-scenarios-not-rendered-proof`

run008StateScenarioCaptureHarnessTaskId: `CODE-008-002`

run008StateScenarioCaptureHarnessStatus: `blocked-scenario-data-boundary-required`

run008StateScenarioIntegrationTaskId: `CODE-008-003`

run008StateScenarioIntegrationStatus: `blocked-feasibility-integrated-not-rendered-proof`

renderedStateScenarioHarnessStatus: `not-yet-safe-to-implement-as-proof`

scenarioDataBoundaryStatus: `required-before-capture-harness`

run005AppWindowSnapshotTaskId: `CODE-005-001`

run005AppWindowSnapshotManifest:
`visual/all-surfaces/app-window-snapshots-001/manifest.md`

run005AppWindowSnapshotArtifact:
`evidence/visual-app-window/run-005-code-005-001/app-window-visual-snapshots.json`

run005AppWindowSnapshotStatus: `captured-standard-and-minimum`

run005AppWindowSnapshotResult: `CODE-005-001 captured default shell/chat empty-state standard and minimum app-window PNG artifacts from temporary no-private local state without host desktop capture.`

run005AppWindowSnapshotNoProofStatement: `The CODE-005-001 screenshots do not complete all-surfaces Demo 8 review; keyboard traversal, VoiceOver/help, focus, contrast, long-content, redaction/human reviewer disposition, and remaining surface/state coverage are still missing.`

run006RetainedSurfaceSnapshotTaskId: `CODE-006-001`

run006RetainedSurfaceSnapshotManifest:
`visual/all-surfaces/retained-surface-app-window-snapshots-001/manifest.md`

run006RetainedSurfaceSnapshotArtifact:
`evidence/visual-app-window/run-006-code-006-001/retained-surface-visual-snapshots.json`

run006RetainedSurfaceSnapshotStatus: `captured-retained-top-level-surfaces-standard-and-minimum`

run006RetainedSurfaceSnapshotResult: `CODE-006-001 captured retained top-level surface standard/minimum app-window PNG artifacts for Chats, Agents, AgentOps HQ, Applications, Insights, and Settings from temporary no-private local state without host desktop capture.`

run006RetainedSurfaceSnapshotNoProofStatement: `The CODE-006-001 screenshots do not complete all-surfaces Demo 8 review; per-surface state coverage, keyboard traversal, VoiceOver/help, focus, contrast, copy-feedback review, long-content review, redaction/human reviewer disposition, and release readiness are still missing.`

run005AccessibilityInventoryTaskId: `CODE-005-003`

run005AccessibilityInventoryManifest:
`accessibility/core/app-accessibility-inventory-001/manifest.md`

run005AccessibilityInventoryArtifact:
`evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json`

run005AccessibilityInventoryStatus: `source-and-view-hierarchy-inventory-captured`

run005AccessibilityInventoryResult: `CODE-005-003 captured source-anchor counts and a rendered view-hierarchy inventory for the default shell/chat empty state from temporary no-private local state; it did not capture keyboard traversal, VoiceOver/help output, focus order, focus visibility, contrast, copy feedback, long-content assistive review, redaction/human reviewer disposition, or remaining surface/state accessibility review.`

run005AccessibilityInventoryNoProofStatement: `The CODE-005-003 inventory does not complete all-surfaces Demo 8 accessibility review and does not upgrade planned, partial, metadata-only, readiness-only, or blocked/manual rows to release proof.`

run006AccessibilityInventoryTaskId: `CODE-006-003`

run006AccessibilityInventoryManifest:
`accessibility/core/retained-surface-app-accessibility-inventory-001/manifest.md`

run006AccessibilityInventoryArtifact:
`evidence/accessibility-app-inventory/run-006-code-006-003/retained-surface-accessibility-inventory.json`

run006AccessibilityInventoryStatus: `retained-surface-source-and-view-hierarchy-inventory-captured`

run006AccessibilityInventoryResult: `CODE-006-003 captured source-anchor counts and rendered view-hierarchy inventories for retained top-level surfaces from temporary no-private local state; it did not capture keyboard traversal, VoiceOver/help output, focus order, focus visibility, contrast, copy feedback, long-content assistive review, redaction/human reviewer disposition, or remaining state accessibility review.`

run006AccessibilityInventoryNoProofStatement: `The CODE-006-003 retained-surface inventory does not complete all-surfaces Demo 8 accessibility review and does not upgrade planned, partial, metadata-only, readiness-only, or blocked/manual rows to release proof.`

scenario: `Demo 8 all-surfaces visual, accessibility, keyboard, focus, copy feedback, contrast, wrapping, long-content, active/guarded, and unavailable evidence matrix.`

windowMetadataFields: `standardWindow 1280x820; minimumWindow 980x640; display scale; theme; surface; state list; screenshot path; overlap/clipping/wrapping result; reviewer; redaction.`

accessibilityMetadataFields: `keyboard traversal, VoiceOver/help labels, focus order, focus visibility, disabled/submitting exposure, copy feedback, icon-only labels, contrast, non-color status, and reviewer assistive setup.`

decisionGateFields: `D-0001, D-0004, D-0005, D-0006 state kind, reason code, missing prerequisites, activation requirements, not-parity statement, and release impact.`

notParityStatement: `This all-surfaces Demo 8 manifest links retained top-level app-window screenshots, retained-surface source/view-hierarchy accessibility inventory, a source-backed residual matrix, and a Run 008 feasibility audit only; it does not contain completed all-state screenshot coverage, keyboard results, VoiceOver results, contrast results, copy-feedback review, broader asset approval, human reviewer disposition, or release pass proof.`

activationRequirement: `Capture or review remaining current-branch standard/minimum-window surface/state artifacts, keyboard traversal, VoiceOver/help review, focus and contrast notes, redaction review, and reviewer disposition before verification.`

determinism: `Fixture id, branch, app version, surface keys, window sizes, validation ids, ITC-0054 id, SM-0268 id, and Demo 8 id make the manual scaffold deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, applications, AgentOps rows, approvals, reports, screenshots, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime result, mock AgentOps event, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Future artifacts must exclude private paths, uploaded private file paths, account values, credentials, raw runtime transcripts, local files, and secret-bearing UI content.`

redactionReview: `RelayConsoleVisualEvidenceTests plus branch redaction scan; future screenshot and assistive-review artifacts require explicit redaction reviewer signoff.`

failureHandling: `Captured-only, stale, unredacted, single-window, clipped, unlabeled, color-only, keyboard-incomplete, D-0005-overclaim, or partial artifacts cannot verify Demo 8 and must remain partial or blocked.`

releaseImpact: `Retained top-level screenshot, retained-surface accessibility inventory, source-backed residual matrix, and blocked scenario-capture feasibility artifacts are now linked; release Demo 8 rows stay partial until remaining state, assistive-review, long-content, and human-review artifacts are linked.`
