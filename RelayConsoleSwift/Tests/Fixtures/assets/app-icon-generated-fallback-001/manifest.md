# Asset Fixture Manifest - Generated App Icon Fallback

id: `fix-assets-app-icon-generated-fallback-001`

layer: `assets`

productArea: `applications`

requirementIds: `RCSPR-0009`, `RCSPR-0080`, `RCSPR-0098`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `ITC-0008`, `ITC-0053`

sourceMapIds: `SM-0143`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0267`

featureIds: `FI-0110`, `FI-0111`, `FI-0190`, `FI-0297`

gapOrDecisionIds: `D-0005`

fixtureKind: `asset-fallback`

owner: `applications-ui`

status: `verified-source`

secretsPolicy: `no-secrets`

artifactClass: `asset-manifest`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `asset evidence`

sourceBaseline: `ApplicationsService.swift`, `Models.swift`, `Views.swift`, `UIComponents.swift`, `web/lib/app-icons.ts`, `web/lib/marketplace-fallback.ts`, `itc-0053-asset-manifest-visual-system-component-polish-packet-dry-run.md`

files:

- `assets/app-icon-generated-fallback-001/manifest.md`
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

assetFallbackEvidence: `ApplicationsService.iconFallback generates MarketplaceIconFallback initials and colorName from slug/name with source deterministic-slug-fallback.`

fallbackContract: `ApplicationsIconFallbackView renders local initials and deterministic palette color without relying on a remote logo as product truth.`

stateCoverage: `missing logo, external provider, local app excluded, read-only, beta allowlist, risk badge, category badge, and generated icon rows.`

accessibilityEvidence: `ApplicationsIconFallbackView exposes help and accessibility label text: Deterministic app icon fallback.`

decisionStatus: `approved-current-fallback`

notParityStatement: `This manifest does not claim bundled third-party logos, remote-logo availability, integration-provider parity, or release visual proof.`

activationRequirement: `Capture current-branch visual and accessibility evidence for marketplace icon rows before final visual signoff.`

determinism: `Slug/name inputs, deterministic-slug-fallback source marker, palette names, ITC-0053 id, SM-0267 id, and Demo 8 id make generated app icons deterministic.`

noFakeProductSeed: `The manifest does not seed marketplace apps, provider connections, installs, tool requests, screenshots, or runtime output.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime result, or simulated provider response is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Provider secrets, OAuth codes, tenant ids, private account values, local files, and screenshot artifacts are excluded.`

redactionReview: `RelayConsoleVisualEvidenceTests validates source anchors; future screenshot evidence must be redacted separately.`

failureHandling: `Missing deterministic source marker, remote logo treated as truth, unlabeled icon fallback, color-only risk state, or D-0005 overclaim blocks the fallback row.`

releaseImpact: `Provides source-backed app/icon fallback evidence for ITC-0053 while keeping manual visual proof pending.`
