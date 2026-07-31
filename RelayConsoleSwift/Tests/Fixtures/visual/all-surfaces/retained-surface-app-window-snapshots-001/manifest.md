# Visual Fixture Manifest - Retained Surface App Window Snapshots

id: `fix-visual-all-surfaces-retained-surface-app-window-snapshots-001`

layer: `visual`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`, `ITC-0055`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0005`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `visual-snapshot`

owner: `visual`

status: `captured-retained-top-level-surfaces-standard-and-minimum`

disposition: `partial-proof`

secretsPolicy: `no-secrets`

artifactClass: `visual-review`

branch: `current-working-tree`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `RelayConsoleAppUI`, `RelayConsoleAppController`, `ShellNavigationResolver`, `RelayConsoleAppVisualSnapshotHarness`, `RELAY_CONSOLE_USER_DATA_PATH`, `Run 005 app-window snapshot harness`

files:

- `visual/all-surfaces/retained-surface-app-window-snapshots-001/manifest.md`
- `evidence/visual-app-window/run-006-code-006-001/retained-surface-visual-snapshots.json`
- `evidence/visual-app-window/run-006-code-006-001/chat-standard-window.png`
- `evidence/visual-app-window/run-006-code-006-001/chat-minimum-window.png`
- `evidence/visual-app-window/run-006-code-006-001/agents-standard-window.png`
- `evidence/visual-app-window/run-006-code-006-001/agents-minimum-window.png`
- `evidence/visual-app-window/run-006-code-006-001/agentops-standard-window.png`
- `evidence/visual-app-window/run-006-code-006-001/agentops-minimum-window.png`
- `evidence/visual-app-window/run-006-code-006-001/applications-standard-window.png`
- `evidence/visual-app-window/run-006-code-006-001/applications-minimum-window.png`
- `evidence/visual-app-window/run-006-code-006-001/insights-standard-window.png`
- `evidence/visual-app-window/run-006-code-006-001/insights-minimum-window.png`
- `evidence/visual-app-window/run-006-code-006-001/settings-standard-window.png`
- `evidence/visual-app-window/run-006-code-006-001/settings-minimum-window.png`
- `../RelayConsoleAppVisualSnapshotHarness/AppVisualSnapshotHarness.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `swift run RelayConsoleAppVisualSnapshotHarness --all-surfaces --output-dir evidence/visual-app-window/run-006-code-006-001`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`, `ITC-0055`, `CODE-006-001`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`, `VC-0109`

demoIds: `Demo 8`

reportIds:
`loop-runs/006-all-surface-visual-navigation-capture/reports/CODE-006-001-retained-surface-visual-capture.md`

run006RetainedSurfaceSnapshotTaskId: `CODE-006-001`

run006RetainedSurfaceSnapshotArtifact:
`evidence/visual-app-window/run-006-code-006-001/retained-surface-visual-snapshots.json`

run006RetainedSurfaceSnapshotStatus: `captured-retained-top-level-surfaces-standard-and-minimum`

captureMode: `offscreen-app-window-render`

screenshotArtifactStatus: `captured-standard-and-minimum`

retainedSurfaceCount: `6`

capturedSnapshotCount: `12`

capturedSurfaceIds: `chat`, `agents`, `agentops`, `applications`, `insights`, `settings`

capturedShellSectionKeys: `chats`, `agents`, `agent_ops_hq`, `applications`, `insights`, `settings`

standardWindow: `1280x820`

minimumWindow: `980x640`

standardWindowStatus: `captured-app-window-png`

minimumWindowStatus: `captured-app-window-png`

navigationStatus: `allowed`

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

notParityStatement: `These branch-local app-window PNG artifacts capture retained top-level surfaces at standard and minimum sizes only; they do not prove all per-surface states, keyboard traversal, VoiceOver/help, focus, contrast, long-content behavior, human review, or final release readiness.`

activationRequirement: `Integrate these screenshots into Demo 8 manifests, complete per-surface accessibility inventory where possible, finish keyboard/VoiceOver/focus/contrast/long-content and human-review evidence, and rerun release aggregation before any release-proof claim.`

determinism: `Retained surface ids, shell section keys, window sizes, output file names, artifact id, CODE-006-001 id, and no-host-desktop status are stable.`

noFakeProductSeed: `The harness uses temporary local state and does not seed chats, agents, applications, AgentOps rows, approvals, reports, runtime output, or welcome messages.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime result, mock AgentOps event, fake harness output, fake agent, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `The JSON stores relative artifact paths only and does not record the temporary user-data root, private account values, local files, credentials, or default Application Support state.`

redactionReview: `RelayConsoleAppVisualSnapshotHarness, RelayConsoleVisualEvidenceTests, PNG dimension checks, and scoped redaction scans; final human release review remains required.`

failureHandling: `If these screenshots are counted as keyboard proof, VoiceOver proof, focus proof, contrast proof, long-content proof, all-state proof, human review, or final release proof, ITC-0054 and ITC-0055 closeout must remain blocked or partial.`

releaseImpact: `Provides branch-local retained top-level surface standard/minimum app-window visual artifacts; release remains blocked until accessibility, long-content, all-state, and human review residuals are resolved or explicitly scoped.`
