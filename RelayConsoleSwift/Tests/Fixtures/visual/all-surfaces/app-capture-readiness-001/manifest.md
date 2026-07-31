# Visual Fixture Manifest - App Capture Readiness

id: `fix-visual-all-surfaces-app-capture-readiness-001`

layer: `visual`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0005`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `manual-note`

owner: `visual`

status: `source-backed`

disposition: `partial`

secretsPolicy: `no-secrets`

artifactClass: `capture-readiness`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `RelayConsoleServices.swift`, `AppPathsService.swift`, `RelayConsoleApp.swift`, `AppViewModel.swift`, `SmokeTests.swift`, `Run 003 metadata harness artifacts`

files:

- `visual/all-surfaces/app-capture-readiness-001/manifest.md`
- `evidence/capture-readiness/run-004-code-004-001/capture-readiness.json`
- `../RelayConsoleCaptureReadinessAudit/CaptureReadinessAudit.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleCaptureReadinessAudit`
- `swift run RelayConsoleCoreSmokeTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 8`

reportIds:
`loop-runs/004-demo-8-app-capture-readiness-and-human-review/reports/CODE-004-001-app-capture-readiness.md`

run004CaptureReadinessTaskId: `CODE-004-001`

run004CaptureReadinessArtifact:
`evidence/capture-readiness/run-004-code-004-001/capture-readiness.json`

run004CaptureReadinessStatus: `temporary-user-data-path-supported-screenshot-not-captured`

temporaryUserDataEnvironmentKey: `RELAY_CONSOLE_USER_DATA_PATH`

temporaryUserDataOverrideStatus: `implemented-and-smoke-tested`

privacyMode: `temporary-no-private-local-state`

defaultApplicationSupportStateRead: `false`

hostDesktopCaptureUsed: `false`

screenshotArtifactStatus: `not-captured`

captureAttemptStatus: `not-attempted-by-this-audit`

keyboardTraversalStatus: `not-captured`

voiceOverHelpStatus: `not-captured`

focusOrderStatus: `not-captured`

contrastStatus: `not-measured`

releaseProof: `false`

notParityStatement: `This manifest proves only app capture readiness prerequisites; it does not contain screenshots, keyboard traversal, VoiceOver/help, focus, contrast, long-content review, release-human-review, or release proof.`

activationRequirement: `Launch Relay Console with RELAY_CONSOLE_USER_DATA_PATH set to a temporary root, capture reviewed app-targeted standard/minimum-window artifacts without host desktop content, and complete assistive and human review metadata.`

determinism: `Environment key, fixture id, artifact id, window sizes, ITC-0054 id, SM-0268 id, Demo 8 id, and validation command ids are stable.`

noFakeProductSeed: `The readiness audit does not seed chats, agents, applications, AgentOps rows, approvals, reports, screenshots, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime result, mock AgentOps event, fake harness output, fake agent, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `The temporary user-data override is required before GUI capture so future artifacts do not read the user's default Application Support state.`

redactionReview: `RelayConsoleCaptureReadinessAudit, RelayConsoleCoreSmokeTests, RelayConsoleVisualEvidenceTests, and scoped redaction scans; future screenshot artifacts require explicit redaction reviewer signoff.`

failureHandling: `If capture readiness metadata is counted as screenshot, assistive review, human review, or release proof, ITC-0054 and ITC-0055 closeout must remain blocked or no-go.`

releaseImpact: `Provides a temporary no-private-state launch prerequisite for future Demo 8 capture; release visual/accessibility/manual rows remain blocked until reviewed artifacts are captured.`
