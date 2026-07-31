# Visual Fixture Manifest - AgentOps Entry Live State

id: `fix-visual-agentops-entry-live-state-001`

layer: `visual`

productArea: `agentops-entry-live-state`

requirementIds: `RCSPR-0018`, `ITC-0008`, `ITC-0027`

sourceMapIds: `SM-0018`, `SM-0150`, `SM-0151`, `SM-0158`

featureIds: `FI-0018`, `FI-0143`

gapOrDecisionIds: `ITC-0045`, `ITC-0053`

fixtureKind: `visual-source-scaffold`

owner: `agentops-ui`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `manual-evidence-scaffold`

branch: `codex/itc-0021-0028-agents-org-provisioning`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `Views.swift`, `screen-contracts/agentops/hq.md`, `ITC-0027`

files:

- `visual/agentops/entry-live-state-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0027`

validationCommandIds: `VC-0106`, `ITC-0008`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0021-0028-agents-org-provisioning/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-028-itc-0027-agentops-live-state-runtime-overview.md`

surface: `AgentOps HQ entry live-state screen`

stateKind: `planned-visual-review`

reasonCode: `agentops-entry-visual-scaffold`

decisionIds: `ITC-0045`

missingPrerequisites: `Rendered screenshots at standard and minimum window sizes, visual overlap review, responsive review, and full AgentOps visualization polish remain later work.`

currentState: `Source defines AgentOps header, status strip, real-time agents panel, selected state panel, runtime overview, and redacted event feed. Screenshots are not yet captured.`

notParityStatement: `This visual scaffold does not claim screenshot parity, final AgentOps visualization parity, layout editor polish, or manual Demo 8 signoff.`

activationRequirement: `Capture and review screenshots before using this fixture as visual release proof.`

releaseImpact: `Provides ITC-0027 visual evidence planning without claiming rendered parity.`

determinism: `The scaffold is source-only and does not rely on live data or generated screenshots.`

noFakeProductSeed: `No product-visible records or screenshots are seeded.`

noSimulatedRuntimeOutput: `No mock AgentOps events are included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, prompt text, account data, screenshots, and runtime logs are excluded.`

redactionReview: `The planned review must confirm event feed and runtime overview do not display raw operator text.`

failureHandling: `If screenshots later reveal overlap, missing empty states, low contrast, leaked content, or mock-event dependence, visual evidence fails until corrected.`
