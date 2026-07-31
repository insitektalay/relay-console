# UI Fixture Manifest - Shared State Polish

id: `fix-ui-components-shared-state-polish-001`

layer: `ui`

productArea: `components`

requirementIds: `RCSPR-0009`, `RCSPR-0074`, `RCSPR-0075`, `RCSPR-0076`, `RCSPR-0077`, `RCSPR-0078`, `RCSPR-0079`, `RCSPR-0080`, `RCSPR-0081`, `RCSPR-0082`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0120`, `RCSPR-0200`, `ITC-0008`, `ITC-0053`

sourceMapIds: `SM-0118`, `SM-0119`, `SM-0120`, `SM-0121`, `SM-0122`, `SM-0123`, `SM-0124`, `SM-0125`, `SM-0126`, `SM-0127`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0267`

featureIds: `FI-0085`, `FI-0086`, `FI-0087`, `FI-0088`, `FI-0089`, `FI-0090`, `FI-0091`, `FI-0092`, `FI-0093`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0114`, `FI-0190`, `FI-0297`

gapOrDecisionIds: `D-0005`, `SBD-0001`

fixtureKind: `source-audit`

owner: `UI`

status: `verified-source`

secretsPolicy: `no-secrets`

artifactClass: `ui-flow`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `UI evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`, `RCComponentBaseline.inventory`, `RCVisualSystemAudit`, `RCAssetManifest`

files:

- `ui/components/shared-state-polish-001/manifest.md`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0053`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0053-0054-visual-accessibility-polish/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-052-itc-0053-asset-manifest-visual-system.md`

componentInventory: `RCComponentBaseline.inventory records shared component rows for asset manifest, app-icon fallback, badge/meta rows, retry/error state, guarded nav, composer, status badges, forms, avatars, search, and empty/loading state.`

stateCoverage: `loading, empty, no-match, disabled, submitting, retry, stale, error, read-only, permission-needed, approval-required, blocked, selected, hover/pressed, focus, long-content, redacted, and decision-gated states.`

sharedComponentRule: `Reusable states must use shared component source or documented exceptions; one-off styling cannot count as ITC-0053 proof.`

accessibilityEvidence: `Buttons, icon controls, badges, guarded nav, retry controls, and avatar actions must expose labels/help and non-color state text.`

assetFallbackEvidence: `Shared state polish consumes RCAssetManifest rows for app icons, avatars, generated app icons, AgentOps deterministic fallback, and D-0005 residual assets.`

notParityStatement: `This source UI fixture does not claim screenshot parity, keyboard review, VoiceOver review, contrast pass, or release readiness.`

activationRequirement: `Capture standard/minimum-window UI evidence and accessibility review before downstream visual parity consumes this source fixture.`

determinism: `Stable component inventory keys, source file anchors, validation ids, ITC-0053 id, SM-0267 id, and Demo 8 id make the UI fixture deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, applications, approvals, AgentOps rows, reports, screenshots, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript or simulated output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Private paths, account values, local files, raw credentials, raw runtime content, and screenshots are excluded.`

redactionReview: `RelayConsoleComponentBaselineTests and RelayConsoleVisualEvidenceTests validate source anchors; future visual artifacts require explicit redaction review.`

failureHandling: `Missing shared component key, one-off styling overclaim, missing retry/error state, unlabeled icon, missing D-0005 residual, or stale source blocks ITC-0053 component polish.`

releaseImpact: `Provides source-backed shared component state evidence for ITC-0053 only; visual/accessibility/manual pass remains downstream.`
