# Accessibility Fixture Manifest - App Accessibility Inventory

id: `fix-accessibility-core-app-accessibility-inventory-001`

layer: `accessibility`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`, `ITC-0055`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0005`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `accessibility-inventory`

owner: `accessibility`

status: `source-and-view-hierarchy-inventory`

disposition: `partial-proof`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-review`

branch: `current-working-tree`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `accessibility evidence`

sourceBaseline: `RelayConsoleAppUI`, `RelayConsoleAppLauncher`, `RelayConsoleAppAccessibilityInventoryHarness`, `RCAccessibilityEvidenceMatrix`, `disabled-focus-copy-feedback-001`, `assistive-review-readiness-001`, `ui-visual-a11y-manual-evidence-review-rubric.md`

files:

- `accessibility/core/app-accessibility-inventory-001/manifest.md`
- `evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json`
- `../RelayConsoleAppAccessibilityInventoryHarness/AppAccessibilityInventoryHarness.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `swift run RelayConsoleAppAccessibilityInventoryHarness --output evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`, `ITC-0055`, `CODE-005-003`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`, `VC-0109`

demoIds: `Demo 8`

reportIds:
`loop-runs/005-app-window-visual-capture-and-a11y-proof-attempt/reports/CODE-005-003-accessibility-inventory.md`

run005AccessibilityInventoryTaskId: `CODE-005-003`

run005AccessibilityInventoryArtifact:
`evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json`

inventoryMode: `source-anchor-and-rendered-view-hierarchy-inventory-not-voiceover-session`

privacyMode: `temporary-no-private-local-state`

temporaryUserDataEnvironmentKey: `RELAY_CONSOLE_USER_DATA_PATH`

defaultApplicationSupportStateRead: `false`

hostDesktopCaptureUsed: `false`

accessibilityInventoryStatus: `source-and-view-hierarchy-inventory-captured`

appTreeNodeCount: `37`

namedAppTreeNodeCount: `0`

sourceHelpModifierCount: `154`

sourceAccessibilityLabelCount: `179`

sourceKeyboardShortcutCount: `1`

keyboardTraversalStatus: `not-captured`

voiceOverHelpStatus: `not-captured`

focusOrderStatus: `not-captured`

focusVisibilityStatus: `not-captured`

contrastStatus: `not-measured`

copyFeedbackStatus: `not-captured`

longContentAssistiveStatus: `not-captured`

humanReviewerStatus: `not-reviewed`

releaseProof: `false`

sourceFilesReviewed: `Sources/RelayConsoleApp/AppEntryPoint.swift`, `Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift`, `Sources/RelayConsoleApp/Views.swift`, `Sources/RelayConsoleApp/RuntimeWorkspaceViews.swift`, `Sources/RelayConsoleApp/UIComponents.swift`

blockedCapabilityMatrix: `keyboard traversal; VoiceOver spoken output; focus order; focus visibility; contrast ratios; copy feedback announcements; long-content assistive review; human release review.`

noProofStatement: `This CODE-005-003 artifact is a source-anchor and rendered AppKit/SwiftUI view-hierarchy inventory only. It is not VoiceOver output, keyboard traversal, focus-order proof, focus-visibility proof, contrast measurement, copy-feedback proof, long-content assistive review, human review, or final release proof.`

notParityStatement: `This manifest records branch-local accessibility inventory only; it does not prove keyboard traversal, VoiceOver/help output, focus order, focus visibility, contrast, copy feedback announcements, long-content assistive review, human review, or release readiness.`

activationRequirement: `Run current-branch keyboard traversal, VoiceOver/help review, focus-order/focus-visibility review, contrast measurement, copy feedback review, long-content review, redaction review, and release-human-review signoff before accessibility verification can pass.`

determinism: `Stable source files, output path, inventory mode, no-host-desktop status, CODE-005-003 id, ITC-0054 id, ITC-0055 id, and Demo 8 id make the accessibility inventory deterministic.`

noFakeProductSeed: `The harness uses temporary local state and does not seed product-visible chats, agents, applications, AgentOps rows, approvals, reports, screenshots, assistive transcripts, runtime data, or local files.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime output, mock AgentOps event, fake assistive transcript, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `The JSON stores source-relative file names and view roles only; it does not record the temporary user-data root, host desktop pixels, default Application Support state, account values, local files, credentials, raw runtime transcripts, or secret-bearing UI content.`

redactionReview: `RelayConsoleAppAccessibilityInventoryHarness, RelayConsoleVisualEvidenceTests, and scoped redaction scans; future keyboard, VoiceOver, focus, contrast, copy-feedback, and human-review artifacts require explicit redaction reviewer signoff.`

failureHandling: `If this inventory is counted as keyboard proof, VoiceOver proof, focus proof, contrast proof, copy feedback proof, long-content proof, human review, or release proof, ITC-0054 and ITC-0055 closeout must remain blocked or partial.`

releaseImpact: `Provides a branch-local accessibility inventory for Demo 8 triage; release remains blocked until required assistive and human-review artifacts are captured and reviewed.`
