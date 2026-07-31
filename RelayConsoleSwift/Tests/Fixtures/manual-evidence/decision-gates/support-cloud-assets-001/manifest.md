# Manual Evidence Manifest - support-cloud-assets-001

id: `fix-manual-evidence-decision-gates-support-cloud-assets-001`

layer: `manual-evidence`

productArea: `decision-gates`

requirementIds: `RCSPR-0101`, `RCSPR-0112`, `RCSPR-0116`, `RCSPR-0147`, `RCSPR-0154`

sourceMapIds: `SM-0128`, `SM-0130`, `SM-0141`, `SM-0154`, `SM-0155`

featureIds: `FI-0110`, `FI-0111`, `FI-0138`, `FI-0145`

gapOrDecisionIds: `D-0001`, `D-0004`, `D-0005`, `D-0006`, `SBD-0001`

fixtureKind: `manual-note`

owner: `QA evidence`

status: `planned`

disposition: `unavailable`

evidenceType: `decision-gate-review`

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
`unavailable-surface-evidence-standard.md`,
`visual-a11y-unavailable-negative-drill-matrix.md`

files:

- `manual-evidence/decision-gates/support-cloud-assets-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`

validationCommandIds: `VC-0108`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0006-0008-service-replay-visual-scaffold/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-009-itc-0008-visual-a11y-manual-scaffold.md`

surface: `Support, cloud account, broader assets, AgentOps HQ, Applications, Insights, and Approvals guarded or disabled nav placeholders.`

stateKind: `decision-gated`

reasonCode: `decision.required`

decisionIds: `D-0001`, `D-0004`, `D-0005`, `D-0006`

missingPrerequisites: `Human decision approval, service-backed scope, visual evidence, accessibility review, and release-impact signoff.`

currentState: `Disabled or unavailable scaffold only; no active parity claim.`

notParityStatement: `Decision-gated or disabled placeholder evidence can prove unavailable honesty only and must not be counted as implemented surface parity.`

activationRequirement: `Resolve the applicable decision, add service/source proof, capture visual/accessibility/manual evidence, and update branch and release packets before activation.`

releaseImpact: `Unavailable residual until decisions and evidence are complete.`

determinism: `Manifest id, decision ids, state kind, reason code, and activation requirement are stable; future review must add reviewer disposition and artifacts.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, harnesses, settings, screenshots, or UI data.`

noSimulatedRuntimeOutput: `No runtime transcript or generated runtime output is included.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Future artifacts must exclude private paths, account values, local files, raw secret-bearing UI content, and private runtime transcripts.`

redactionReview: `RelayConsoleVisualEvidenceTests plus branch redaction scan; future decision artifacts require explicit redaction reviewer signoff.`

failureHandling: `If a disabled or decision-gated surface is counted as active parity, ITC-0008 and downstream visual/manual evidence closeout must fail.`
