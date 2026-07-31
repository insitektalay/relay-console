# Visual Fixture Manifest - All-State Long-Content Residual Matrix

id: `fix-visual-all-surfaces-all-state-long-content-residual-matrix-001`

layer: `visual`

productArea: `all-surfaces`

requirementIds: `RCSPR-0009`, `RCSPR-0081`, `RCSPR-0083`, `RCSPR-0098`, `RCSPR-0101`, `RCSPR-0111`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0114`, `RCSPR-0115`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0200`, `ITC-0008`, `ITC-0054`, `ITC-0055`

sourceMapIds: `SM-0121`, `SM-0122`, `SM-0128`, `SM-0129`, `SM-0130`, `SM-0138`, `SM-0139`, `SM-0141`, `SM-0153`, `SM-0154`, `SM-0155`, `SM-0161`, `SM-0268`

featureIds: `FI-0091`, `FI-0094`, `FI-0110`, `FI-0111`, `FI-0138`, `FI-0190`, `FI-0298`

gapOrDecisionIds: `D-0001`, `D-0004`, `D-0005`, `D-0006`, `SBD-0001`, `SBD-0004`, `SBD-0005`

fixtureKind: `residual-matrix`

owner: `visual`

status: `source-backed-residual-matrix-not-rendered-proof`

disposition: `partial`

secretsPolicy: `no-secrets`

artifactClass: `visual-review`

branch: `current-working-tree`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `Run 006 retained-surface visual artifacts`, `Run 006 retained-surface accessibility inventory`, `Views.swift`, `UIComponents.swift`, `retained screen contracts`, `Demo 8 visual/accessibility/manual rubric`

files:

- `visual/all-surfaces/all-state-long-content-residual-matrix-001/manifest.md`
- `evidence/visual-all-state-residuals/run-007-code-007-002/all-state-long-content-residual-matrix.md`
- `evidence/visual-app-window/run-006-code-006-001/retained-surface-visual-snapshots.json`
- `evidence/accessibility-app-inventory/run-006-code-006-003/retained-surface-accessibility-inventory.json`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0054`, `ITC-0055`, `CODE-007-002`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`, `VC-0109`

demoIds: `Demo 8`

reportIds:
`loop-runs/007-assistive-human-review-residuals/reports/CODE-007-002-all-state-long-content-residual-matrix.md`

run007AllStateResidualMatrixTaskId: `CODE-007-002`

run007AllStateResidualMatrixArtifact:
`evidence/visual-all-state-residuals/run-007-code-007-002/all-state-long-content-residual-matrix.md`

run007AllStateResidualMatrixStatus: `source-backed-residual-matrix-not-rendered-proof`

allStateVisualStatus: `not-captured`

longContentVisualStatus: `not-reviewed`

minimumWindowStateMatrixStatus: `partial-top-level-only`

assistiveReviewStatus: `not-captured`

humanReviewerStatus: `not-reviewed`

releaseProof: `false`

retainedSurfaceRows: `Chats`, `Agents`, `AgentOps HQ`, `Applications`, `Insights`, `Settings`, `Work-safety and guarded states`

notParityStatement: `This matrix identifies missing all-state and long-content evidence only; it is not rendered visual proof, assistive proof, human review, or release proof.`

activationRequirement: `Capture or review retained state and long-content evidence at standard and minimum window sizes, then complete assistive and human-review artifacts before Demo 8 or release verification can pass.`

determinism: `Artifact id, surface rows, Run 006 input artifacts, ITC-0054 id, ITC-0055 id, Demo 8 id, and status strings are stable.`

noFakeProductSeed: `The matrix does not seed chats, agents, applications, AgentOps rows, approvals, reports, screenshots, assistive transcripts, runtime data, or local files.`

noSimulatedRuntimeOutput: `No runtime transcript, generated runtime output, mock AgentOps event, fake assistive transcript, or simulated application output is included.`

noGeneratedWelcome: `No generated welcome copy is included.`

privateStateExclusions: `The matrix stores source-relative references and residual labels only; it does not record private paths, account values, local files, credentials, raw runtime transcripts, or secret-bearing UI content.`

redactionReview: `RelayConsoleVisualEvidenceTests and scoped redaction scans; future rendered state artifacts require explicit redaction reviewer signoff.`

failureHandling: `If this source-backed matrix is counted as rendered all-state proof, long-content proof, assistive proof, human review, or release proof, ITC-0054 and ITC-0055 closeout must remain blocked or partial.`

releaseImpact: `Clarifies remaining all-state and long-content residuals; release remains blocked until rendered/reviewed state, assistive, and human-review artifacts exist.`
