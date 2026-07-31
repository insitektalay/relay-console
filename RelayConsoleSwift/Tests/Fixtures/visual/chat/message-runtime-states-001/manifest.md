# Visual Fixture Manifest - Chat Message Runtime States

id: `fix-visual-chat-message-runtime-states-001`

layer: `visual`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `source-backed-visual-state-evidence`

owner: `composer-ui`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `visual-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:20:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `DispatchService.swift`

files:

- `visual/chat/message-runtime-states-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0015`

validationCommandIds: `VC-0106`

demoIds: `Demo 2`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-016-itc-0015-composer-drafts-send-failure-mentions.md`

surface: `Failed local send and active dispatch visual states`

stateKind: `active`

reasonCode: `verified-source-visual`

decisionIds: `none`

missingPrerequisites: `Standard-window and minimum-window screenshots remain required before visual closeout.`

currentState: `MessageBubble renders failed local sends with error copy and retry-unavailable state; DispatchStatusView continues active, failed, and cancelled runtime status rows without fabricating agent replies.`

notParityStatement: `This fixture does not claim screenshot parity, runtime transcript proof, or full retry UI parity.`

activationRequirement: `Visual screenshot packets must cite this source-backed state fixture before final Demo visual claims.`

releaseImpact: `Provides source-backed visual state coverage for ITC-0015 while preserving screenshot residuals.`

determinism: `The source anchors are stable Swift view/type names and fixed visible state labels.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, account values, and runtime snapshots are excluded.`

redactionReview: `Fixture text contains no secrets and failed-send metadata is redacted in service tests.`

failureHandling: `If failed-send state disappears or is mistaken for runtime output, ITC-0015 visual evidence fails.`
