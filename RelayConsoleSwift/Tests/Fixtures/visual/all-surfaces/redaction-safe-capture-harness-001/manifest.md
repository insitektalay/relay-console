# Visual Fixture Manifest - Redaction Safe Capture Harness

id: `fix-visual-all-surfaces-redaction-safe-capture-harness-001`

layer: `visual`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`, `ITC-0055`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0005`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `visual-capture-harness`

owner: `visual`

status: `source-backed`

disposition: `partial`

secretsPolicy: `no-secrets`

artifactClass: `visual-review`

branch: `current-working-tree`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `RelayConsoleVisualCaptureHarness`, `RCComponentBaseline.standardWindowSize`, `RCComponentBaseline.minimumWindowSize`, `Views.swift`, `UIComponents.swift`, `demo-08-all-surfaces-visual-a11y-001`, `standard-minimum-window-matrix-001`

files:

- `visual/all-surfaces/redaction-safe-capture-harness-001/manifest.md`
- `evidence/visual-capture/run-003-code-003-001/visual-capture-metadata.json`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `swift run RelayConsoleVisualCaptureHarness --output evidence/visual-capture/run-003-code-003-001/visual-capture-metadata.json`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`, `ITC-0055`, `CODE-003-001`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`, `VC-0109`

demoIds: `Demo 8`

reportIds:
`loop-runs/003-demo-8-redaction-safe-visual-accessibility-evidence/reports/CODE-003-001-redaction-safe-visual-evidence-harness.md`

captureMode: `structured-metadata-not-screenshot`

screenshotArtifactStatus: `not-captured`

hostDesktopCaptureUsed: `false`

privacyMode: `temporary-no-private-local-state`

releaseProof: `false`

notParityStatement: `This harness manifest records a redaction-safe app-targeted metadata path only; it does not prove rendered screenshot parity, keyboard traversal, VoiceOver/help review, focus, contrast, long-content layout, human review, or release readiness.`

activationRequirement: `Add app-targeted screenshot rendering or reviewed structured visual notes, keyboard/focus review, VoiceOver/help review, contrast review, long-content review, redaction reviewer, and release-human-review signoff before verification.`

determinism: `Stable window sizes, retained surface ids, source file anchors, output path, ITC-0054 id, CODE-003-001 id, and Demo 8 id make the harness metadata deterministic.`

noFakeProductSeed: `The harness does not seed product-visible chats, agents, applications, AgentOps rows, approvals, reports, screenshots, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime output, mock AgentOps event, fake harness output, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `The harness reads source and fixture files only; it does not read host desktop pixels, private local app data, account values, local file content, credentials, raw runtime transcripts, or secret-bearing UI content.`

redactionReview: `RelayConsoleVisualEvidenceTests validates source anchors and no-host-desktop metadata; future rendered artifacts require explicit redaction reviewer signoff.`

failureHandling: `If structured metadata is counted as rendered screenshot proof, keyboard proof, VoiceOver proof, focus proof, contrast proof, long-content proof, human review, or release proof, ITC-0054 and ITC-0055 closeout must remain blocked or partial.`

releaseImpact: `Creates a redaction-safe app-targeted metadata harness for later Demo 8 evidence capture; release remains blocked until required artifacts are captured and reviewed.`
