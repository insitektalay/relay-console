# Asset Fixture Manifest - Avatar Bundle Upload Fallback

id: `fix-assets-avatar-bundle-upload-fallback-001`

layer: `assets`

productArea: `avatars`

requirementIds: `RCSPR-0009`, `RCSPR-0074`, `RCSPR-0080`, `RCSPR-0098`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `ITC-0008`, `ITC-0053`

sourceMapIds: `SM-0143`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0267`

featureIds: `FI-0089`, `FI-0110`, `FI-0111`, `FI-0190`, `FI-0297`

gapOrDecisionIds: `D-0005`

fixtureKind: `asset-fallback`

owner: `avatars`

status: `verified-source`

secretsPolicy: `no-secrets`

artifactClass: `asset-manifest`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `asset evidence`

sourceBaseline: `UIComponents.swift`, `LocalDataService.swift`, `Sources/RelayConsoleApp/Resources/Assets/avatars/illustrated`, `web/lib/avatar-library.ts`, `itc-0053-asset-manifest-visual-system-component-polish-packet-dry-run.md`

files:

- `assets/avatar-bundle-upload-fallback-001/manifest.md`
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

curatedIllustratedAvatarBundleCount: `42`

curatedIllustratedAvatarVisibleCount: `41`

hiddenIllustratedAvatarCount: `1`

uploadValidation: `png-jpeg-only; max-3145728-bytes; data-url-persistence; private-path-excluded`

assetFallbackEvidence: `AgentAvatarView loads data URLs, bundled illustrated avatar paths, or file URLs, then falls back to initials over the shared accent gradient.`

fallbackContract: `defaultIllustratedAvatarURL(seed:) is deterministic; no-avatar state clears the value; hiddenIllustratedAvatarResourceName remains bundled but excluded from visible picker choices.`

stateCoverage: `selected avatar, upload, remove/no-avatar, missing image, corrupt data URL, deterministic default, initials fallback, relaunch-persisted value, and D-0005 broader bundle residual.`

accessibilityEvidence: `Avatar choices expose Use avatar labels; upload and no-avatar buttons expose help and accessibility labels.`

decisionStatus: `decision_gated_d0005`

notParityStatement: `This manifest does not claim full web avatar bundle parity, mission-control generated avatar parity, screenshot proof, or release readiness.`

activationRequirement: `Capture picker, upload, no-avatar, missing/corrupt fallback, and relaunch visual/accessibility evidence before release signoff.`

determinism: `Bundle count, visible count, hidden avatar file, stable seed helper, upload validation string, ITC-0053 id, SM-0267 id, and Demo 8 id make the avatar fallback evidence deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible people, agents, avatars, screenshots, or account data.`

noSimulatedRuntimeOutput: `No runtime transcript or simulated output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Uploaded private paths, local files, account values, and screenshot artifacts are excluded; persisted uploads use data URLs only.`

redactionReview: `RelayConsoleComponentBaselineTests and RelayConsoleVisualEvidenceTests validate source anchors; future manual artifacts require redaction review.`

failureHandling: `Missing count, hidden avatar overclaim, unsupported upload type accepted, oversized upload accepted, private path leakage, or D-0005 overclaim blocks avatar fallback evidence.`

releaseImpact: `Provides source-backed avatar fallback and upload-validation evidence for ITC-0053 while keeping visual/manual proof pending.`
