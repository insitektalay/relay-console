# Visual Fixture Manifest - Native Claw Classic Components

id: `fix-visual-components-native-claw-classic-001`

layer: `visual`

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

fixtureKind: `evidence`

owner: `UI`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `visual-review`

branch: `codex/itc-0011-0012-shell-components`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T20:55:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`,
`itc-0012-native-component-accessibility-baseline-packet-dry-run.md`,
`ui-visual-a11y-manual-evidence-review-rubric.md`,
`visual-a11y-unavailable-negative-drill-matrix.md`

files:

- `visual/components/native-claw-classic-001/manifest.md`
- `../RelayConsoleComponentBaselineTests/ComponentBaselineTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleComponentBaselineTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0012`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 1`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0011-0012-shell-components/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-013-itc-0012-component-accessibility-baseline.md`

componentInventory: `RCComponentBaseline.inventory covers icon-button, status-badge, search-field, avatar-editor, form-card, empty-loading-state, composer, and guarded-nav primitives.`

tokenAudit: `RCComponentBaseline centralizes 4 px corner radius, compact icon sizes, sidebar width, standard window size 1280x820, minimum window size 980x640, app icon root, avatar root, and D-0005 residual status.`

stateCoverage: `normal, pressed, selected, disabled, busy, empty, loading, error, no-match, unavailable, excluded, long-content, status, upload, remove, and fallback states are source-audited for current active surfaces.`

accessibilityEvidence: `Component source exposes help and accessibility labels for icon-only controls, account/settings navigation, search clear, avatar actions, composer send/editor, message copy actions, harness status/actions, and guarded nav.`

assetFallbackEvidence: `Native app icon assets and at least 42 bundled illustrated avatars are present; deterministic initials and illustrated avatar fallback remain source-backed; broader asset carry-over remains gated by D-0005.`

windowMatrix: `standard window 1280x820; minimum window 980x640; active surfaces include Chats, Agents, Settings, Account, Harnesses, guarded nav, message actions, composer, avatar editor, form cards, empty/loading/error states, and harness cards.`

notParityStatement: `This component baseline verifies current shared component source, labels, assets, and manifest coverage only; it does not prove full visual parity, AgentOps visual parity, HTML-native rendering, chat service parity, or release readiness.`

activationRequirement: `Capture future branch-local screenshots or UI automation for each later active surface before claiming full visual parity; resolve D-0005 before broader asset parity.`

determinism: `Stable component keys, token constants, resource roots, bundled avatar count, fixture id, branch, and app version make reruns deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, harnesses, reports, AgentOps rows, applications, approvals, screenshots, or UI data.`

noSimulatedRuntimeOutput: `No runtime transcript or generated runtime output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, local files, raw credentials, and private runtime transcripts are excluded.`

redactionReview: `RelayConsoleComponentBaselineTests plus branch redaction scan; current artifact contains only source paths, component keys, and bundled asset counts.`

failureHandling: `Missing component inventory keys, missing labels/help, missing deterministic asset fallback, missing D-0005 residual, or visual parity overclaim blocks ITC-0012 closeout.`

releaseImpact: `Verified component/accessibility baseline only; release visual parity remains partial until future standard/minimum-window screenshot and manual review evidence is captured for active surfaces.`
