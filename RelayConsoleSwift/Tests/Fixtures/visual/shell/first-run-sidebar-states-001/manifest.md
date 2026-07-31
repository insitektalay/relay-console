# Visual Fixture Manifest - Shell First Run Sidebar States

id: `fix-visual-shell-first-run-sidebar-states-001`

layer: `visual`

productArea: `shell`

requirementIds: `RCSPR-0101`, `RCSPR-0112`, `RCSPR-0113`, `RCSPR-0147`, `RCSPR-0154`

sourceMapIds: `SM-0128`, `SM-0130`, `SM-0141`, `SM-0154`, `SM-0155`

featureIds: `FI-0110`, `FI-0111`, `FI-0138`, `FI-0145`

gapOrDecisionIds: `D-0005`, `SBD-0001`

fixtureKind: `manual-note`

owner: `UI`

status: `created`

secretsPolicy: `no-secrets`

artifactClass: `visual-review`

branch: `codex/itc-0006-0008-service-replay-visual-scaffold`

commit: `69b6e30`

appVersion: `0.1.0`

capturedAt: `2026-06-22T19:51:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`,
`ui-visual-a11y-manual-evidence-review-rubric.md`,
`visual-a11y-unavailable-negative-drill-matrix.md`

files:

- `visual/shell/first-run-sidebar-states-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0105`
- `VC-0106`
- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`

validationCommandIds: `VC-0105`, `VC-0106`, `VC-0108`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0006-0008-service-replay-visual-scaffold/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-009-itc-0008-visual-a11y-manual-scaffold.md`

stateMatrix: `standard window 1280x900; minimum window 1024x720; Chats, Agents, Settings, Harnesses, guarded nav unavailable states, copy controls, composer disabled, empty states, selected states, long labels.`

notParityStatement: `This scaffold creates the visual review location and expected state matrix only; it is not a captured screenshot set and does not prove active visual parity.`

activationRequirement: `Capture standard window and minimum window evidence, review layout/clipping/overlap/redaction, link reviewer signoff, and update branch packet before any visual pass claim.`

determinism: `Fixture id, branch, app version, window labels, surface list, and expected state matrix are stable; future screenshots must add artifact paths and reviewer metadata.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, harnesses, settings, screenshots, or UI data.`

noSimulatedRuntimeOutput: `No runtime transcript or generated runtime output is included.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Screenshots and future notes must exclude private paths, account values, local files, and raw secret-bearing UI content.`

redactionReview: `RelayConsoleVisualEvidenceTests plus branch redaction scan; future screenshots require explicit redaction review before verification.`

failureHandling: `Missing visual metadata, standard/minimum window coverage, non-parity wording, or redaction blocks ITC-0008 scaffold closeout.`

itc0011Overlay: `ITC-0011 updates disabled nav placeholders into guarded nav unavailable states for AgentOps HQ, Applications, Insights, and excluded Approvals; this remains unavailable evidence, not active parity.`

releaseImpact: `Created scaffold only; release visual rows remain partial until screenshots or structured visual reviews are captured and reviewed. Guarded nav unavailable states do not prove AgentOps HQ, Applications, Insights, or standalone Approvals parity.`
