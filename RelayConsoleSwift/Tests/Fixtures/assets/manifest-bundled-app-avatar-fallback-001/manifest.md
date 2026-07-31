# Asset Fixture Manifest - Bundled App And Avatar Fallback

id: `fix-assets-manifest-bundled-app-avatar-fallback-001`

layer: `assets`

productArea: `visual-system`

requirementIds: `RCSPR-0009`, `RCSPR-0074`, `RCSPR-0080`, `RCSPR-0098`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0200`, `ITC-0008`, `ITC-0053`

sourceMapIds: `SM-0143`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0267`

featureIds: `FI-0089`, `FI-0110`, `FI-0111`, `FI-0190`, `FI-0297`

gapOrDecisionIds: `D-0005`

fixtureKind: `asset-manifest`

owner: `assets`

status: `verified-source`

secretsPolicy: `no-secrets`

artifactClass: `asset-manifest`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `asset evidence`

sourceBaseline: `UIComponents.swift`, `Package.swift`, `Sources/RelayConsoleApp/Resources/Assets`, `task-card-decision-gate-matrix.md`, `itc-0053-asset-manifest-visual-system-component-polish-packet-dry-run.md`

files:

- `assets/manifest-bundled-app-avatar-fallback-001/manifest.md`
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

appIconBundleCount: `3`

curatedIllustratedAvatarBundleCount: `42`

curatedIllustratedAvatarVisibleCount: `41`

hiddenIllustratedAvatarCount: `1`

assetFallbackEvidence: `RCAssetManifest records app-icons, curated-illustrated-avatars, uploaded-avatar-validation, deterministic-marketplace-icons, agentops-floor-worker-assets, and brand-landing-broader-assets rows.`

fallbackContract: `appIconImage loads source.png then icon.png; defaultIllustratedAvatarURL(seed:) uses stableAvatarIndex and excludes illustrated-white-male-03.png from visible picker fallbacks.`

decisionStatus: `decision_gated_d0005`

broaderAvatarResidual: `full-359-avatar-bundle-claim-blocked-by-D-0005`

stateCoverage: `bundled, visible, hidden, no-avatar, missing image, deterministic default, initials fallback, upload validation, and decision-gated broader assets.`

accessibilityEvidence: `AgentAvatarView falls back to initials; generated app/icon fallback rows require accessible text labels.`

notParityStatement: `This source asset manifest does not claim full web avatar parity, brand/landing carry-over, AgentOps floor/worker asset parity, screenshot proof, or release readiness.`

activationRequirement: `Resolve D-0005 or keep broader assets unavailable, then capture current-branch visual/manual evidence before release parity.`

determinism: `Static asset counts, resource roots, hidden avatar id, fallback seed helper, ITC-0053 id, SM-0267 id, and Demo 8 id make the manifest deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible avatars, users, agents, applications, reports, screenshots, or UI data.`

noSimulatedRuntimeOutput: `No runtime transcript or simulated output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Private paths, uploaded file paths, account values, credentials, and raw local files are excluded.`

redactionReview: `RelayConsoleComponentBaselineTests and RelayConsoleVisualEvidenceTests validate source anchors; future screenshots require separate redaction review.`

failureHandling: `Missing asset count, missing hidden/deprecated row, missing fallback contract, or D-0005 overclaim blocks ITC-0053 asset closeout.`

releaseImpact: `Records current native app/avatar assets and residual broader asset decision status for downstream ITC-0054 visual/accessibility review.`
