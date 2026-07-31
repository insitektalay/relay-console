# Accessibility Fixture Manifest - Component Icon Label Status

id: `fix-accessibility-components-icon-label-status-001`

layer: `accessibility`

productArea: `components`

requirementIds: `RCSPR-0009`, `RCSPR-0074`, `RCSPR-0080`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0053`

sourceMapIds: `SM-0128`, `SM-0130`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0267`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0297`

gapOrDecisionIds: `D-0005`, `SBD-0001`

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

sourceBaseline: `UIComponents.swift`, `Views.swift`, `RCComponentBaseline.inventory`, `RCVisualSystemAudit`, `RCAssetManifest`

files:

- `accessibility/components/icon-label-status-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0053`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0053-0054-visual-accessibility-polish/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-052-itc-0053-asset-manifest-visual-system.md`

reviewMatrix: `icon-only labels, non-color status, risk badge text, app badge names, avatar action labels, generated app icon labels, disabled reasons, focus visibility, keyboard traversal, contrast, and redacted state labels.`

stateCoverage: `normal, selected, focus, disabled, retry, error, stale, read-only, decision-gated, sensitive, and no-avatar states.`

accessibilityEvidence: `Source anchors expose help/accessibility labels for icon buttons, generated app icons, avatar upload/no-avatar, guarded nav, retry buttons, and text-bearing StatusBadge rows.`

assetFallbackEvidence: `Avatar initials and deterministic app icons must expose accessible names even when images are missing.`

notParityStatement: `This accessibility source audit does not claim completed VoiceOver session, keyboard traversal, contrast pass, screenshot proof, or release readiness.`

activationRequirement: `Run current-branch keyboard, focus, VoiceOver/help, and contrast review before accessibility pass.`

determinism: `Stable label strings, source files, fixture id, validation ids, ITC-0053 id, SM-0267 id, and Demo 8 id make the accessibility fixture deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, applications, approvals, AgentOps rows, screenshots, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript or simulated output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Private paths, account values, local files, credentials, raw runtime content, and screenshot artifacts are excluded.`

redactionReview: `RelayConsoleVisualEvidenceTests validates source anchors; future assistive review notes require explicit redaction review.`

failureHandling: `Missing icon-only labels, color-only status, unlabeled generated fallback, missing disabled reason, missing D-0005 residual, or stale source blocks the accessibility row.`

releaseImpact: `Provides ITC-0053 source-level accessibility anchors for downstream ITC-0054 manual review.`
