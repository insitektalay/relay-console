# UI Fixture Manifest - Active Guarded State Matrix

id: `fix-ui-active-guarded-state-matrix-001`

layer: `ui`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0004`, `D-0005`, `D-0006`, `SBD-0001`, `SBD-0004`, `SBD-0005`

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

sourceBaseline: `UIComponents.swift`, `Views.swift`, `RelayConsoleApp.swift`, `RCAccessibilityEvidenceMatrix`, `guarded-state-standard.md`, `unavailable-surface-evidence-standard.md`

files:

- `ui/active-guarded-state-matrix-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0053-0054-visual-accessibility-polish/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-053-itc-0054-accessibility-manual-matrix.md`

retainedSurfaceRule: `retained-surfaces-only-excluded-surfaces-stay-unavailable`

activeSurfaceMatrix: `Shell/sidebar/navigation; Chats/thread list/detail/messages/composer; Agents/org/work dashboard; Applications marketplace; Settings/Insights/reports/wrap-ups; AgentOps native visual scene; Retained local file and high-risk action states.`

guardedUnavailableMatrix: `Decision-gated support, cloud, assets, lifecycle; excluded renderer app Paperclip Approvals; D-0001; D-0004; D-0005; D-0006; html_native; local app/source-host/generated-pack; standalone Approvals.`

stateCoverage: `disabled, pending, retryable_error, terminal_error, blocked_action, read_only, permission_needed, approval_required, decision_gated, unavailable, auth_required, dependency_missing, no-match, loading, empty, selected, and long-content states.`

accessibilityEvidence: `Matrix rows require keyboard traversal, VoiceOver/help labels, icon-only labels, disabled reasons, and non-color status before verification.`

assetFallbackEvidence: `D-0005 asset-dependent surfaces consume the ITC-0053 asset manifest and stay decision-gated where broader assets remain unapproved.`

notParityStatement: `This source UI matrix proves retained/guarded scope discipline only; it does not prove final visual, keyboard, VoiceOver, or release parity.`

activationRequirement: `Complete standard/minimum-window visual review, keyboard traversal, VoiceOver/help review, contrast notes, and manual Demo 8 review before active visual parity.`

determinism: `Surface keys, state taxonomy names, decision ids, ITC-0054 id, SM-0268 id, Demo 8 id, and validation ids make the matrix deterministic.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, applications, AgentOps rows, approvals, reports, screenshots, or runtime data.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime output, mock AgentOps event, or simulated provider/application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `Private paths, account values, local files, credentials, raw runtime transcripts, and screenshot artifacts are excluded.`

redactionReview: `RelayConsoleVisualEvidenceTests validates source anchors; future manual artifacts require redaction review.`

failureHandling: `If a guarded or excluded surface is counted as active parity, if decision ids are missing, or if UI-only guards replace service evidence, ITC-0054 closeout must fail.`

releaseImpact: `Provides retained/guarded surface map for ITC-0054 and ITC-0055; release remains partial until visual/accessibility/manual rows are captured.`
