# Manual Evidence Manifest - Chat Attachments References

id: `fix-manual-chat-attachments-references-001`

layer: `manual-evidence`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `manual-review-placeholder`

owner: `composer-ui`

status: `planned`

secretsPolicy: `no-secrets`

artifactClass: `manual-screenshot-a11y-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:05:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `screen-contracts/chat/composer-attachments-references.md`

files:

- `manual-evidence/chat/attachments-references-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `VC-0107`
- `manual screenshot review`
- `manual VoiceOver/help review`

implementationTaskIds: `ITC-0008`, `ITC-0016`

validationCommandIds: `VC-0106`, `VC-0107`

demoIds: `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-017-itc-0016-attachments-references.md`

surface: `Manual attachment/reference visual and accessibility review`

stateKind: `planned`

reasonCode: `manual-evidence-required`

decisionIds: `none`

missingPrerequisites: `Standard-window screenshot, minimum-window screenshot, keyboard traversal notes, and VoiceOver/help label notes remain to be captured by a human reviewer.`

currentState: `Source-backed automated evidence exists for composer attachment controls and message metadata rows; this manifest intentionally stays planned until manual evidence is captured.`

notParityStatement: `This planned manual manifest is not proof of screenshot parity, Paperclip behavior, or browser upload transport parity.`

activationRequirement: `Manual screenshots and accessibility review must be attached before final Demo 8 visual/accessibility claims.`

releaseImpact: `Tracks remaining manual evidence for ITC-0016 without overstating completion.`

determinism: `Manual review must record fixed window sizes, keyboard path, VoiceOver/help labels, and redaction observations.`

noFakeProductSeed: `Manual review must use test-owned content only.`

noSimulatedRuntimeOutput: `Manual review must not use fake runtime output as evidence.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, credentials, account values, local file bytes, and runtime snapshots must be excluded from screenshots and notes.`

redactionReview: `Manual review must confirm no raw local paths or secret values are visible.`

failureHandling: `If manual capture reveals overlap, missing labels, or path leakage, ITC-0016 remains not visually closed out.`
