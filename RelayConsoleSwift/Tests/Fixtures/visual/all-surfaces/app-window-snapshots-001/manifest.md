# Visual Fixture Manifest - App Window Snapshots

id: `fix-visual-all-surfaces-app-window-snapshots-001`

layer: `visual`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`, `ITC-0055`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0005`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `visual-snapshot`

owner: `visual`

status: `captured-app-window-png`

disposition: `partial-proof`

secretsPolicy: `no-secrets`

artifactClass: `visual-review`

branch: `current-working-tree`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `RelayConsoleAppUI`, `RelayConsoleAppLauncher`, `RelayConsoleAppVisualSnapshotHarness`, `RELAY_CONSOLE_USER_DATA_PATH`, `Run 004 capture readiness`

files:

- `visual/all-surfaces/app-window-snapshots-001/manifest.md`
- `evidence/visual-app-window/run-005-code-005-001/app-window-visual-snapshots.json`
- `evidence/visual-app-window/run-005-code-005-001/standard-window.png`
- `evidence/visual-app-window/run-005-code-005-001/minimum-window.png`
- `../RelayConsoleAppVisualSnapshotHarness/AppVisualSnapshotHarness.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `swift run RelayConsoleAppVisualSnapshotHarness --output-dir evidence/visual-app-window/run-005-code-005-001`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`, `ITC-0055`, `CODE-005-001`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`, `VC-0109`

demoIds: `Demo 8`

reportIds:
`loop-runs/005-app-window-visual-capture-and-a11y-proof-attempt/reports/CODE-005-001-app-window-visual-capture.md`

run005AppWindowSnapshotTaskId: `CODE-005-001`

run005AppWindowSnapshotArtifact:
`evidence/visual-app-window/run-005-code-005-001/app-window-visual-snapshots.json`

captureMode: `offscreen-app-window-render`

screenshotArtifactStatus: `captured-standard-and-minimum`

standardWindowArtifact:
`evidence/visual-app-window/run-005-code-005-001/standard-window.png`

standardWindowStatus: `captured-app-window-png`

minimumWindowArtifact:
`evidence/visual-app-window/run-005-code-005-001/minimum-window.png`

minimumWindowStatus: `captured-app-window-png`

standardWindow: `1280x820`

minimumWindow: `980x640`

hostDesktopCaptureUsed: `false`

privacyMode: `temporary-no-private-local-state`

defaultApplicationSupportStateRead: `false`

keyboardTraversalStatus: `not-captured`

voiceOverHelpStatus: `not-captured`

focusOrderStatus: `not-captured`

contrastStatus: `not-measured`

longContentReviewStatus: `not-reviewed`

humanReviewerStatus: `not-reviewed`

releaseProof: `false`

notParityStatement: `These branch-local app-window PNG artifacts provide visual screenshot evidence only; they do not prove keyboard traversal, VoiceOver/help, focus, contrast, long-content, human review, or final release readiness.`

activationRequirement: `Integrate the screenshots into Demo 8 manifests, complete keyboard/VoiceOver/focus/contrast/long-content review, add redaction/human reviewer signoff, and rerun release aggregation before any release-proof claim.`

determinism: `Window sizes, output file names, artifact id, CODE-005-001 id, and no-host-desktop status are stable.`

noFakeProductSeed: `The harness uses temporary local state and does not seed chats, agents, applications, AgentOps rows, approvals, reports, runtime output, or welcome messages.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime result, mock AgentOps event, fake harness output, fake agent, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `The JSON stores relative artifact paths only and does not record the temporary user-data root, private account values, local files, credentials, or default Application Support state.`

redactionReview: `RelayConsoleAppVisualSnapshotHarness, RelayConsoleVisualEvidenceTests, and scoped redaction scans; final human release review remains required.`

failureHandling: `If these screenshots are counted as keyboard proof, VoiceOver proof, focus proof, contrast proof, long-content proof, human review, or final release proof, ITC-0054 and ITC-0055 closeout must remain blocked or partial.`

releaseImpact: `Provides branch-local standard/minimum app-window visual artifacts; release remains blocked until accessibility, long-content, and human review residuals are resolved or explicitly scoped.`
