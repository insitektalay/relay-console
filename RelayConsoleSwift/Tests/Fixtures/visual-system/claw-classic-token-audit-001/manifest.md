# Visual System Fixture Manifest - Claw Classic Token Audit

id: `fix-visual-system-claw-classic-token-audit-001`

layer: `visual-system`

productArea: `components`

requirementIds: `RCSPR-0009`, `RCSPR-0074`, `RCSPR-0075`, `RCSPR-0076`, `RCSPR-0077`, `RCSPR-0078`, `RCSPR-0079`, `RCSPR-0080`, `RCSPR-0081`, `RCSPR-0082`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0120`, `RCSPR-0200`, `ITC-0008`, `ITC-0053`

sourceMapIds: `SM-0118`, `SM-0119`, `SM-0120`, `SM-0121`, `SM-0122`, `SM-0123`, `SM-0124`, `SM-0125`, `SM-0126`, `SM-0127`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0141`, `SM-0143`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0267`

featureIds: `FI-0085`, `FI-0086`, `FI-0087`, `FI-0088`, `FI-0089`, `FI-0090`, `FI-0091`, `FI-0092`, `FI-0093`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0114`, `FI-0190`, `FI-0297`

gapOrDecisionIds: `D-0005`, `SBD-0001`

fixtureKind: `source-audit`

owner: `visual-system`

status: `verified-source`

secretsPolicy: `no-secrets`

artifactClass: `token-audit`

branch: `codex/itc-0053-0054-visual-accessibility-polish`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual-system evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`, `web/app/globals.css`, `web/components/shared/risk-badge.tsx`, `web/components/shared/agent-app-badge-strip.tsx`, `itc-0053-asset-manifest-visual-system-component-polish-packet-dry-run.md`

files:

- `visual-system/claw-classic-token-audit-001/manifest.md`
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

tokenAudit: `RCVisualSystemAudit records page/sidebar/surface, text/muted/border, accent/status/risk, radius/density, and focus/disabled/selected rows with web source evidence and macOS divergence.`

stateCoverage: `normal, selected, focus, disabled, pressed, loading, empty, no-match, error, retry, stale, read-only, decision-gated, and redacted states are source-audited.`

componentInventory: `RCComponentBaseline.inventory includes shared component rows for icon buttons, badges, search, avatars, form cards, empty/loading, composer, guarded nav, asset manifest, app icon fallback, badge/meta rows, and retry/error state.`

accessibilityEvidence: `Source audit requires text-bearing status/risk badges, icon-only labels, reason-backed help, and non-color status before accessibility proof can pass.`

assetFallbackEvidence: `Token audit links D-0005 asset residuals to RCAssetManifest and does not claim broader web asset parity.`

notParityStatement: `This source token audit does not replace standard-window screenshots, minimum-window screenshots, keyboard traversal, VoiceOver review, contrast measurement, or final visual parity.`

activationRequirement: `Run current-branch visual and accessibility review for standard/minimum windows before treating token rows as release visual proof.`

determinism: `Stable token keys, source files, ITC-0053 id, SM-0267 id, Demo 8 id, and validation command ids make this source audit deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, applications, AgentOps rows, reports, screenshots, or UI data.`

noSimulatedRuntimeOutput: `No runtime transcript, generated output, simulated application state, or mock AgentOps event is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Private paths, account values, local files, raw credentials, raw runtime transcripts, and screenshot artifacts are excluded.`

redactionReview: `RelayConsoleComponentBaselineTests, RelayConsoleVisualEvidenceTests, and branch redaction scan; this artifact contains only source names and token keys.`

failureHandling: `Missing token row, missing web/native source mapping, color-only state, one-off styling overclaim, missing D-0005 residual, or stale source blocks ITC-0053 visual-system closeout.`

releaseImpact: `Provides source-backed token audit evidence for ITC-0053 only; ITC-0054 must still capture visual/accessibility/manual proof.`
