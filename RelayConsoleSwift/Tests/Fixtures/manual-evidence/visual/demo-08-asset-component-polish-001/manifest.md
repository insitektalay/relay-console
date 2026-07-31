# Manual Evidence Manifest - Demo 8 Asset Component Polish

id: `fix-manual-evidence-visual-demo-08-asset-component-polish-001`

layer: `manual-evidence`

productArea: `visual-system`

requirementIds: `RCSPR-0009`, `RCSPR-0074`, `RCSPR-0080`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0053`

sourceMapIds: `SM-0128`, `SM-0130`, `SM-0141`, `SM-0143`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0267`

featureIds: `FI-0089`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0297`

gapOrDecisionIds: `D-0005`, `SBD-0001`

fixtureKind: `manual-note`

owner: `QA evidence`

status: `planned`

disposition: `partial`

evidenceType: `screenshot-review`

secretsPolicy: `no-secrets`

artifactClass: `manual-evidence`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewedAt: `planned`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`, `RCVisualSystemAudit`, `RCAssetManifest`, `ui-visual-a11y-manual-evidence-review-rubric.md`, `visual-a11y-unavailable-negative-drill-matrix.md`

files:

- `manual-evidence/visual/demo-08-asset-component-polish-001/manifest.md`
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

scenario: `Demo 8 manual asset, component polish, visual-system, and D-0005 residual review for active and guarded Swift surfaces.`

windowMetadataFields: `Window size, display scale, theme, active surface, asset/fallback state, expected component states, screenshot paths, overlap/clipping/wrapping result, and reviewer notes.`

assetCountFields: `appIconBundleCount 3, curatedIllustratedAvatarBundleCount 42, curatedIllustratedAvatarVisibleCount 41, hiddenIllustratedAvatarCount 1, broader assets decision_gated_d0005.`

accessibilityMetadataFields: `Keyboard path, VoiceOver/help labels, icon-only labels, non-color status, focus visibility, contrast notes, disabled reasons, avatar/app icon fallback labels.`

notParityStatement: `This Demo 8 manifest is planned and partial; it does not contain captured screenshots, keyboard results, VoiceOver results, contrast results, broader asset approval, or release pass proof.`

activationRequirement: `Capture current-branch standard/minimum-window screenshots, keyboard and VoiceOver/help notes, redaction review, D-0005 residual rows, and reviewer disposition before verification.`

determinism: `Fixture id, branch, app version, asset counts, validation ids, ITC-0053 id, SM-0267 id, and Demo 8 id make the manual scaffold deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, applications, AgentOps rows, approvals, reports, screenshots, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime result, mock AgentOps event, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Future artifacts must exclude private paths, uploaded private file paths, account values, credentials, raw runtime transcripts, and secret-bearing UI content.`

redactionReview: `RelayConsoleVisualEvidenceTests plus branch redaction scan; future screenshot artifacts require explicit redaction reviewer signoff.`

failureHandling: `Captured-only, stale, unredacted, single-window, clipped, unlabeled, color-only, D-0005-overclaim, or partial artifacts cannot verify Demo 8 and must remain partial or blocked.`

releaseImpact: `Manual evidence remains planned only; release Demo 8 rows stay partial until reviewed current-branch artifacts are linked.`
