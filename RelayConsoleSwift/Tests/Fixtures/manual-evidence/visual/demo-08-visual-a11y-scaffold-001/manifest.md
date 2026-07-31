# Manual Evidence Manifest - demo-08-visual-a11y-scaffold-001

id: `fix-manual-evidence-visual-demo-08-visual-a11y-scaffold-001`

layer: `manual-evidence`

productArea: `visual`

requirementIds: `RCSPR-0101`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0154`

sourceMapIds: `SM-0128`, `SM-0130`, `SM-0141`, `SM-0154`, `SM-0155`

featureIds: `FI-0110`, `FI-0111`, `FI-0138`, `FI-0145`

gapOrDecisionIds: `D-0005`, `SBD-0001`

fixtureKind: `manual-note`

owner: `QA evidence`

status: `planned`

disposition: `partial`

evidenceType: `screenshot-review`

secretsPolicy: `no-secrets`

artifactClass: `manual-evidence`

branch: `codex/itc-0006-0008-service-replay-visual-scaffold`

commit: `69b6e30`

appVersion: `0.1.0`

capturedAt: `2026-06-22T19:51:00Z`

reviewedAt: `planned`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `manual-evidence-manifest-template.md`,
`ui-visual-a11y-manual-evidence-review-rubric.md`,
`visual-a11y-unavailable-negative-drill-matrix.md`

files:

- `manual-evidence/visual/demo-08-visual-a11y-scaffold-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0006-0008-service-replay-visual-scaffold/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-009-itc-0008-visual-a11y-manual-scaffold.md`

scenario: `Demo 8 visual, accessibility, and interaction evidence scaffold for active and guarded Swift surfaces.`

windowMetadataFields: `Window size, display scale, theme, active state, expected state list, screenshot paths, visual comparison notes, overlap/clipping/wrapping result.`

accessibilityMetadataFields: `Keyboard path, VoiceOver/help labels, focus order, focus visibility, contrast notes, disabled/submitting exposure, reviewer assistive setup.`

notParityStatement: `This manifest is a planned screenshot-review scaffold; it does not contain captured screenshots, keyboard results, VoiceOver results, or visual pass proof.`

activationRequirement: `Capture current-branch standard and minimum window artifacts, complete keyboard and VoiceOver/help review, perform redaction review, and link branch packet evidence before verification.`

determinism: `Manifest id, branch, app version, review fields, and expected Demo 8 metadata are stable; future artifacts must add reviewer and capture paths.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, harnesses, settings, screenshots, or UI data.`

noSimulatedRuntimeOutput: `No runtime transcript or generated runtime output is included.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Future artifacts must exclude private paths, account values, local files, raw secret-bearing UI content, and private runtime transcripts.`

redactionReview: `RelayConsoleVisualEvidenceTests plus branch redaction scan; future screenshot artifacts require explicit redaction reviewer signoff.`

failureHandling: `Captured-only, unreviewed, stale, unredacted, single-window, unlabeled, or partial artifacts cannot verify Demo 8 and must remain partial or blocked.`

releaseImpact: `Manual evidence is planned only; release Demo 8 rows remain partial until reviewed current-branch artifacts are linked.`
