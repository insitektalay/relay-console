# Manual Evidence Manifest - Chat Message Rendering

id: `fix-manual-chat-message-rendering-001`

layer: `manual-evidence`

productArea: `chat`

requirementIds: `RCSPR-0025`, `RCSPR-0079`, `RCSPR-0114`, `RCSPR-0116`, `RCSPR-0152`, `RCSPR-0163`

sourceMapIds: `SM-0035`, `SM-0122`, `SM-0123`, `SM-0130`, `SM-0155`, `SM-0157`

featureIds: `FI-0030`, `FI-0088`, `FI-0114`, `FI-0143`, `FI-0154`

gapOrDecisionIds: `CHAT-MSR-001`

fixtureKind: `manual-review-placeholder`

owner: `message-renderer`

status: `planned`

secretsPolicy: `no-secrets`

artifactClass: `manual-screenshot-a11y-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:45:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `MessageRendering.swift`, `screen-contracts/chat/message-stream-and-rendering.md`

files:

- `manual-evidence/chat/message-rendering-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `VC-0107`
- `manual screenshot review`
- `manual VoiceOver/help review`

implementationTaskIds: `ITC-0008`, `ITC-0017`

validationCommandIds: `VC-0106`, `VC-0107`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-018-itc-0017-markdown-plain-text-rendering.md`

surface: `Manual renderer visual and accessibility review`

stateKind: `planned`

reasonCode: `manual-evidence-required`

decisionIds: `CHAT-MSR-001`

missingPrerequisites: `Standard-window screenshot, minimum-window screenshot, keyboard traversal notes, VoiceOver/help label notes, and copy feedback observations remain to be captured by a human reviewer.`

currentState: `Source-backed automated evidence exists for retained markdown/plain rendering, long-message controls, and copy feedback; this manifest intentionally stays planned until manual evidence is captured.`

notParityStatement: `This planned manual manifest is not proof of screenshot parity, html_native behavior, sanitizer/scoped renderer behavior, or HTML fallback pipelines.`

activationRequirement: `Manual screenshots and accessibility review must be attached before final Demo 8 rendering claims.`

releaseImpact: `Tracks remaining manual evidence for ITC-0017 without overstating completion.`

determinism: `Manual review must record fixed window sizes, keyboard path, VoiceOver/help labels, copy feedback, long-message controls, and redaction observations.`

noFakeProductSeed: `Manual review must use test-owned content only.`

noSimulatedRuntimeOutput: `Manual review must not use fake runtime output as evidence.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, account values, and runtime snapshots must be excluded from screenshots and notes.`

redactionReview: `Manual review must confirm no raw local paths or secret values are visible.`

failureHandling: `If manual capture reveals overlap, missing labels, copy feedback failures, or renderer scope drift, ITC-0017 remains not visually closed out.`
