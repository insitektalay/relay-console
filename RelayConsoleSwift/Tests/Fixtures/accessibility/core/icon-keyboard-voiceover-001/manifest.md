# Accessibility Fixture Manifest - Icon Keyboard VoiceOver

id: `fix-accessibility-core-icon-keyboard-voiceover-001`

layer: `accessibility`

productArea: `core`

requirementIds: `RCSPR-0101`, `RCSPR-0112`, `RCSPR-0114`, `RCSPR-0147`, `RCSPR-0154`

sourceMapIds: `SM-0128`, `SM-0130`, `SM-0141`, `SM-0154`, `SM-0155`

featureIds: `FI-0110`, `FI-0111`, `FI-0138`, `FI-0145`

gapOrDecisionIds: `SBD-0001`

fixtureKind: `manual-note`

owner: `accessibility`

status: `created`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-review`

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

- `accessibility/core/icon-keyboard-voiceover-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`

validationCommandIds: `VC-0107`, `VC-0108`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0006-0008-service-replay-visual-scaffold/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-009-itc-0008-visual-a11y-manual-scaffold.md`

reviewMatrix: `keyboard traversal, VoiceOver/help labels, focus visibility, contrast, icon-only controls, disabled-state exposure, guarded nav controls, composer disabled, copy actions, bottom nav unavailable states.`

notParityStatement: `This scaffold creates the accessibility review location and expected checklist only; it is not a completed VoiceOver or keyboard review.`

activationRequirement: `Run keyboard traversal and VoiceOver/help review on current branch artifacts, record reviewer setup and findings, and link branch packet evidence before any accessibility pass claim.`

determinism: `Fixture id, branch, app version, review rows, and scoped control list are stable; future reviews must add artifact paths and reviewer metadata.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, harnesses, settings, screenshots, or UI data.`

noSimulatedRuntimeOutput: `No runtime transcript or generated runtime output is included.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Future review artifacts must exclude private paths, account values, local files, and raw secret-bearing UI content.`

redactionReview: `RelayConsoleVisualEvidenceTests plus branch redaction scan; future accessibility notes require explicit redaction review before verification.`

failureHandling: `Missing keyboard, VoiceOver/help, focus, contrast, disabled-state, non-parity, or redaction fields blocks ITC-0008 scaffold closeout.`

itc0011Overlay: `ITC-0011 requires guarded nav controls to expose reason-backed help, accessibility labels, keyboard-reachable denied selection, and non-color lock or excluded glyph state.`

releaseImpact: `Created scaffold only; release accessibility rows remain partial until keyboard and VoiceOver/help reviews are captured and reviewed. Guarded nav unavailable states do not prove active AgentOps HQ, Applications, Insights, or standalone Approvals parity.`
