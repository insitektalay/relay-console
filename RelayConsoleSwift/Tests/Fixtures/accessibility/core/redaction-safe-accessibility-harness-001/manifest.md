# Accessibility Fixture Manifest - Redaction Safe Accessibility Harness

id: `fix-accessibility-core-redaction-safe-accessibility-harness-001`

layer: `accessibility`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`, `ITC-0055`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0005`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `accessibility-capture-harness`

owner: `accessibility`

status: `source-backed`

disposition: `partial`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-review`

branch: `current-working-tree`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `RelayConsoleAccessibilityCaptureHarness`, `RelayConsoleVisualCaptureHarness`, `RCAccessibilityEvidenceMatrix`, `disabled-focus-copy-feedback-001`, `icon-keyboard-voiceover-001`, `ui-visual-a11y-manual-evidence-review-rubric.md`, `visual-a11y-unavailable-negative-drill-matrix.md`, `release-human-review-evidence-acceptance-rubric.md`

files:

- `accessibility/core/redaction-safe-accessibility-harness-001/manifest.md`
- `evidence/accessibility-capture/run-003-code-003-002/accessibility-metadata.json`
- `../RelayConsoleAccessibilityCaptureHarness/AccessibilityCaptureHarness.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `swift run RelayConsoleAccessibilityCaptureHarness --output evidence/accessibility-capture/run-003-code-003-002/accessibility-metadata.json`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`, `ITC-0055`, `CODE-003-002`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`, `VC-0109`

demoIds: `Demo 8`

reportIds:
`loop-runs/003-demo-8-redaction-safe-visual-accessibility-evidence/reports/CODE-003-002-accessibility-evidence-harness.md`

captureMode: `structured-accessibility-metadata-not-assistive-session`

sourceOnlyAnchorStatus: `source-anchored-review-scaffold`

keyboardTraversalStatus: `not-captured`

voiceOverHelpStatus: `not-captured`

focusOrderStatus: `not-captured`

focusVisibilityStatus: `not-captured`

contrastStatus: `not-measured`

hostDesktopCaptureUsed: `false`

privacyMode: `temporary-no-private-local-state`

releaseProof: `false`

rubricRowsReviewed: `UVAM-010`, `UVAM-011`, `UVAM-012`, `VAU-007`, `VAU-008`, `VAU-009`, `VAU-013`, `RHRV-004`, `RHRV-012`

sourceAnchorEvidence: `.help`, `.accessibilityLabel`, `.accessibilityHint`, `.keyboardShortcut`, `.disabled`, and `StatusBadge` anchors are counted from source only and are not treated as assistive-session proof.

blockedCapabilityMatrix: `keyboard traversal; VoiceOver spoken output; focus order; focus visibility; contrast ratios; copy feedback announcements; long-content assistive review.`

notParityStatement: `This harness manifest records a redaction-safe source-backed accessibility metadata path only; it does not prove keyboard traversal, VoiceOver/help output, focus order, focus visibility, contrast, copy feedback announcements, long-content assistive review, human review, or release readiness.`

activationRequirement: `Run current-branch keyboard-only traversal, VoiceOver/help review, focus-order/focus-visibility review, contrast measurement, copy feedback review, long-content review, redaction review, and release-human-review signoff before verification.`

determinism: `Stable source files, source-anchor counts, rubric row ids, retained surface ids, output path, ITC-0054 id, CODE-003-002 id, and Demo 8 id make the accessibility harness metadata deterministic.`

noFakeProductSeed: `The harness does not seed product-visible chats, agents, applications, AgentOps rows, approvals, reports, screenshots, assistive transcripts, runtime data, or local files.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime output, mock AgentOps event, fake assistive transcript, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `The harness reads source, fixture, rubric, and prior metadata files only; it does not read host desktop pixels, private local app data, account values, local file content, credentials, raw runtime transcripts, or secret-bearing UI content.`

redactionReview: `RelayConsoleVisualEvidenceTests validates source anchors and no-host-desktop metadata; future keyboard, VoiceOver, focus, contrast, and copy-feedback artifacts require explicit redaction reviewer signoff.`

failureHandling: `If source-anchor metadata is counted as keyboard proof, VoiceOver proof, focus proof, contrast proof, copy feedback proof, human review, or release proof, ITC-0054 and ITC-0055 closeout must remain blocked or partial.`

releaseImpact: `Creates a redaction-safe accessibility metadata harness for later Demo 8 review; release remains blocked until required assistive artifacts are captured and reviewed.`
