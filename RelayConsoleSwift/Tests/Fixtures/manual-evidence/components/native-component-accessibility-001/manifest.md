# Manual Evidence Manifest - Native Component Accessibility

id: `fix-manual-components-native-component-accessibility-001`

layer: `manual-evidence`

productArea: `components`

requirementIds: `RCSPR-0074`, `RCSPR-0075`, `RCSPR-0076`, `RCSPR-0077`,
`RCSPR-0078`, `RCSPR-0079`, `RCSPR-0080`, `RCSPR-0081`, `RCSPR-0082`,
`RCSPR-0083`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`,
`RCSPR-0116`, `RCSPR-0147`, `RCSPR-0154`

sourceMapIds: `SM-0118`, `SM-0119`, `SM-0120`, `SM-0121`, `SM-0122`,
`SM-0123`, `SM-0124`, `SM-0125`, `SM-0126`, `SM-0127`, `SM-0128`,
`SM-0129`, `SM-0130`, `SM-0141`, `SM-0154`, `SM-0155`

featureIds: `FI-0085`, `FI-0086`, `FI-0087`, `FI-0088`, `FI-0089`,
`FI-0090`, `FI-0091`, `FI-0092`, `FI-0093`, `FI-0094`, `FI-0110`,
`FI-0111`, `FI-0138`, `FI-0145`

gapOrDecisionIds: `D-0005`, `SBD-0001`

fixtureKind: `manual-note`

owner: `accessibility`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-review`

branch: `codex/itc-0011-0012-shell-components`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T20:55:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`,
`screen-contracts/shell/app-shell-navigation.md`,
`itc-0012-native-component-accessibility-baseline-packet-dry-run.md`,
`ui-visual-a11y-manual-evidence-review-rubric.md`,
`visual-a11y-unavailable-negative-drill-matrix.md`

files:

- `manual-evidence/components/native-component-accessibility-001/manifest.md`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0012`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 1`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0011-0012-shell-components/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-013-itc-0012-component-accessibility-baseline.md`

componentInventory: `Component inventory is source-backed by RCComponentBaseline.inventory and consumed by RelayConsoleComponentBaselineTests.`

stateCoverage: `Active and guarded component states include normal, selected, disabled, busy, empty, loading, error, no-match, unavailable, excluded, status, upload, remove, and fallback states.`

accessibilityEvidence: `Source labels/help cover icon-only controls, app sections, account/settings rows, search clear, avatar choices, upload/remove, composer editor/send, message copy actions, harness status/actions, and guarded status notices. Keyboard traversal is reviewed as source-ready but still requires future manual capture for final release.`

assetFallbackEvidence: `App icon assets, curated illustrated avatar assets, selected avatar state, upload/remove actions, initials fallback, deterministic avatar fallback, and D-0005 residual status are recorded.`

keyboardEvidence: `Buttons remain native SwiftUI controls, icon controls expose labels/help, guarded nav remains keyboard-selectable for denied-route proof, and text inputs keep native focus behavior.`

focusEvidence: `Current baseline records focus-readiness through native controls and labels; future release evidence must capture manual focus order and visibility.`

contrastEvidence: `StatusBadge uses text plus tone, guarded nav uses lock/excluded glyphs plus labels, and status meaning is not color-only. Full contrast measurement remains future visual QA.`

notParityStatement: `This manual component accessibility manifest verifies source-level baseline and schema coverage only; it does not replace future VoiceOver session capture, screenshot proof, full visual parity, or release readiness.`

activationRequirement: `Capture standard/minimum-window screenshots, VoiceOver/help notes, keyboard traversal, focus visibility, and residual asset decisions before final visual/accessibility parity.`

determinism: `Stable component keys, token constants, resource roots, labels, validation command ids, branch, and app version make the source-level review deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, harnesses, reports, AgentOps rows, applications, approvals, screenshots, or UI data.`

noSimulatedRuntimeOutput: `No runtime transcript or generated runtime output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Future review artifacts must exclude private paths, account values, local files, raw credentials, raw auth codes, and private runtime transcripts.`

redactionReview: `RelayConsoleComponentBaselineTests, RelayConsoleVisualEvidenceTests, and branch redaction scan; current manifest contains only component metadata and no private values.`

failureHandling: `Missing labels/help, missing keyboard/focus review status, color-only status state, missing D-0005 residual, stale source baseline, or visual/accessibility parity overclaim blocks ITC-0012 closeout.`

releaseImpact: `Verified component/accessibility source baseline only; release accessibility remains partial until manual VoiceOver, keyboard, focus, contrast, and screenshot reviews are captured and linked.`
