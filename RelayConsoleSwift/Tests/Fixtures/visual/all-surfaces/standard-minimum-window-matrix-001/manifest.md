# Visual Fixture Manifest - All Surfaces Standard Minimum Window Matrix

id: `fix-visual-all-surfaces-standard-minimum-window-matrix-001`

layer: `visual`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0005`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `manual-note`

owner: `visual`

status: `captured-app-window-png`

disposition: `partial-proof`

secretsPolicy: `no-secrets`

artifactClass: `visual-review`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`, `RelayConsoleAppUI`, `RelayConsoleAppVisualSnapshotHarness`, `RCAccessibilityEvidenceMatrix`, `RCVisualSystemAudit`, `RCAssetManifest`, `itc-0054-accessibility-keyboard-manual-visual-evidence-matrix-packet-dry-run.md`

files:

- `visual/all-surfaces/standard-minimum-window-matrix-001/manifest.md`
- `visual/all-surfaces/app-window-snapshots-001/manifest.md`
- `visual/all-surfaces/retained-surface-app-window-snapshots-001/manifest.md`
- `visual/all-surfaces/all-state-long-content-residual-matrix-001/manifest.md`
- `visual/all-surfaces/rendered-state-scenario-feasibility-001/manifest.md`
- `evidence/visual-app-window/run-005-code-005-001/app-window-visual-snapshots.json`
- `evidence/visual-app-window/run-006-code-006-001/retained-surface-visual-snapshots.json`
- `evidence/visual-all-state-residuals/run-007-code-007-002/all-state-long-content-residual-matrix.md`
- `evidence/visual-state-scenarios/run-008-code-008-001/state-scenario-capture-feasibility.md`
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
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-053-itc-0054-accessibility-manual-matrix.md`, `loop-runs/005-app-window-visual-capture-and-a11y-proof-attempt/reports/CODE-005-001-app-window-visual-capture.md`, `loop-runs/006-all-surface-visual-navigation-capture/reports/CODE-006-001-retained-surface-visual-capture.md`, `loop-runs/007-assistive-human-review-residuals/reports/CODE-007-002-all-state-long-content-residual-matrix.md`, `loop-runs/008-rendered-state-scenario-evidence-readiness/reports/CODE-008-001-state-scenario-capture-feasibility.md`, `loop-runs/008-rendered-state-scenario-evidence-readiness/reports/CODE-008-002-state-scenario-capture-harness-blocked.md`, `loop-runs/008-rendered-state-scenario-evidence-readiness/reports/CODE-008-003-state-scenario-evidence-integration.md`

run002FeasibilityTaskId: `CODE-002-003`

run002FeasibilityReport:
`loop-runs/002-release-blocker-remediation-and-screen-contract-revalidation/reports/CODE-002-003-demo-08-visual-accessibility-feasibility.md`

run002FeasibilityStatus: `blocked/manual`

run002CaptureResult: `No current-branch standardWindow or minimumWindow screenshot artifact was captured in this environment.`

run002BlockedReason: `The environment exposes host-level screencapture/osascript and packaged app artifacts, but no app-targeted screenshot/redaction harness or UI automation that can prove standard/minimum-window state coverage without risking private desktop or local app content.`

run002NoProofStatement: `This feasibility check does not upgrade planned/partial evidence to release proof.`

run002NextRequiredEvidence: `Capture redacted app-targeted standard and minimum-window artifacts with surface/state metadata, no-overlap/no-clipping/long-content review, reviewer, redaction, and release-impact disposition before visual verification.`

run003VisualHarnessTaskId: `CODE-003-001`

run003VisualHarnessManifest:
`visual/all-surfaces/redaction-safe-capture-harness-001/manifest.md`

run003VisualHarnessArtifact:
`evidence/visual-capture/run-003-code-003-001/visual-capture-metadata.json`

run003VisualHarnessStatus: `structured-metadata-not-screenshot`

run003VisualHarnessNoProofStatement: `The Run 003 harness does not capture rendered screenshots and does not upgrade planned/partial evidence to release proof.`

run003CaptureAttemptTaskId: `CODE-003-003`

run003CaptureAttemptReport:
`loop-runs/003-demo-8-redaction-safe-visual-accessibility-evidence/reports/CODE-003-003-demo-8-capture-attempt.md`

run003CaptureAttemptStatus: `blocked/manual`

run003CaptureAttemptResult: `The visual and accessibility harnesses were rerun and produced metadata-only artifacts; no redacted standardWindow screenshot, minimumWindow screenshot, full-surface screenshot, state matrix screenshot, no-overlap review, no-clipping review, or long-content rendered layout artifact was captured.`

run003CaptureAttemptNoProofStatement: `The CODE-003-003 capture attempt does not upgrade metadata-only artifacts, source anchors, planned rows, or blocked/manual rows to visual proof or release proof.`

run003CaptureAttemptNextRequiredEvidence: `Capture redacted app-targeted standard and minimum-window screenshots or reviewer-accepted structured visual notes with surface/state/window/redaction metadata before visual verification.`

run004CaptureReadinessTaskId: `CODE-004-001`

run004CaptureReadinessArtifact:
`evidence/capture-readiness/run-004-code-004-001/capture-readiness.json`

run004CaptureReadinessStatus: `temporary-user-data-path-supported-screenshot-not-captured`

run004CaptureReadinessResult: `Relay Console Swift now exposes a RELAY_CONSOLE_USER_DATA_PATH launch override for temporary no-private local state; no app-window screenshot artifact was captured by CODE-004-001.`

run004CaptureReadinessNoProofStatement: `The CODE-004-001 readiness audit proves only capture prerequisites; it does not upgrade readiness metadata, source anchors, planned rows, blocked/manual rows, or metadata-only artifacts to screenshot proof or release proof.`

run004CaptureReadinessNextRequiredEvidence: `Launch Relay Console with RELAY_CONSOLE_USER_DATA_PATH pointing at a temporary root, then capture reviewed app-targeted standard/minimum-window artifacts without host desktop content.`

run005AppWindowSnapshotTaskId: `CODE-005-001`

run005AppWindowSnapshotManifest:
`visual/all-surfaces/app-window-snapshots-001/manifest.md`

run005AppWindowSnapshotArtifact:
`evidence/visual-app-window/run-005-code-005-001/app-window-visual-snapshots.json`

run005AppWindowSnapshotStatus: `captured-standard-and-minimum`

run005AppWindowSnapshotResult: `CODE-005-001 captured standard and minimum app-window PNG artifacts for the default shell/chat empty state from temporary no-private local state without host desktop capture.`

run005AppWindowSnapshotNoProofStatement: `The CODE-005-001 screenshots prove only default shell app-window visual capture; they do not prove all-surface state coverage, keyboard traversal, VoiceOver/help, focus, contrast, long-content review, human review, or release proof.`

run005AppWindowSnapshotNextRequiredEvidence: `Capture or review remaining retained surfaces and states, complete assistive review, and add human reviewer disposition before visual verification can pass.`

run006RetainedSurfaceSnapshotTaskId: `CODE-006-001`

run006RetainedSurfaceSnapshotManifest:
`visual/all-surfaces/retained-surface-app-window-snapshots-001/manifest.md`

run006RetainedSurfaceSnapshotArtifact:
`evidence/visual-app-window/run-006-code-006-001/retained-surface-visual-snapshots.json`

run006RetainedSurfaceSnapshotStatus: `captured-retained-top-level-surfaces-standard-and-minimum`

run006RetainedSurfaceSnapshotResult: `CODE-006-001 captured standard and minimum app-window PNG artifacts for retained top-level surfaces Chats, Agents, AgentOps HQ, Applications, Insights, and Settings from temporary no-private local state without host desktop capture.`

run006RetainedSurfaceSnapshotNoProofStatement: `The CODE-006-001 screenshots prove only retained top-level surface app-window capture; they do not prove per-surface state coverage, keyboard traversal, VoiceOver/help, focus, contrast, long-content review, human review, or release proof.`

run006RetainedSurfaceSnapshotNextRequiredEvidence: `Complete remaining surface/state visual review, assistive review, long-content review, and human reviewer disposition before visual verification can pass.`

run007AllStateResidualMatrixTaskId: `CODE-007-002`

run007AllStateResidualMatrixArtifact:
`evidence/visual-all-state-residuals/run-007-code-007-002/all-state-long-content-residual-matrix.md`

run007AllStateResidualMatrixStatus: `source-backed-residual-matrix-not-rendered-proof`

run007AllStateResidualMatrixResult: `CODE-007-002 identifies retained all-state and long-content gaps for Chats, Agents, AgentOps HQ, Applications, Insights, Settings, and work-safety guarded states.`

run007AllStateResidualMatrixNoProofStatement: `The CODE-007-002 matrix is source-backed residual inventory only; it is not rendered all-state proof, long-content proof, assistive review, human review, or release proof.`

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

standardWindow: `1280x820`

minimumWindow: `980x640`

visualArtifactStatus: `standard-minimum-retained-top-level-screenshots-captured-partial-state`

surfaceMatrix: `Shell/sidebar/navigation; Chats/thread list/detail/messages/composer; Agents/org/work dashboard; Applications marketplace; Settings/Insights/reports/wrap-ups; AgentOps native visual scene; Retained local file and high-risk action states; Decision-gated support, cloud, assets, lifecycle.`

stateCoverage: `loading, empty, error, retry, no-match, selected, active, disabled, pending, blocked, read-only, permission-needed, decision-gated, unavailable, and long-content states are named in the source matrix.`

accessibilityEvidence: `This visual row depends on disabled-focus-copy-feedback-001 for keyboard traversal, VoiceOver/help labels, focus visibility, contrast, icon-only labels, and non-color status.`

assetFallbackEvidence: `D-0005 broader asset residuals consume RCAssetManifest; full broader avatar, brand/landing, and AgentOps floor/worker asset parity is not claimed.`

notParityStatement: `This manifest now links standard/minimum app-window PNG artifacts for retained top-level surfaces, a source-backed residual matrix, and a Run 008 feasibility audit only; it does not prove all-state visual parity, keyboard traversal, VoiceOver/help, focus, contrast, long-content review, human review, or final release proof.`

activationRequirement: `Capture or review redacted standard and minimum-window evidence for every retained active and guarded surface, then complete accessibility and human-review evidence before verification.`

determinism: `Window sizes, source matrix keys, ITC-0054 id, SM-0268 id, Demo 8 id, and validation command ids are stable.`

noFakeProductSeed: `The manifest does not seed chats, agents, applications, AgentOps rows, approvals, reports, screenshots, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime output, mock AgentOps event, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Future screenshots must exclude or redact private paths, account values, local files, credentials, raw runtime transcripts, and secret-bearing UI content.`

redactionReview: `RelayConsoleVisualEvidenceTests plus branch redaction scan; future screenshots require explicit redaction reviewer signoff.`

failureHandling: `Single-window, stale, clipped, overlapping, unredacted, missing-state, or D-0005-overclaim evidence keeps this row partial or no-go.`

releaseImpact: `Provides retained top-level standard/minimum app-window screenshot artifacts and clarifies remaining all-state/long-content residuals plus the blocked scenario-capture boundary for ITC-0054; release visual pass remains partial until all retained state, accessibility, long-content, and human-review residuals are resolved.`
