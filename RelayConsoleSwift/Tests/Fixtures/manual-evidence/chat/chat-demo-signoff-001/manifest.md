# Manual Evidence Manifest - Chat Demo Signoff

id: `fix-manual-chat-demo-signoff-001`

layer: `manual-evidence`

productArea: `chat`

requirementIds: `RCSPR-0003`, `RCSPR-0023`, `RCSPR-0024`, `RCSPR-0025`,
`RCSPR-0026`, `RCSPR-0028`, `RCSPR-0069`, `RCSPR-0070`, `RCSPR-0093`,
`RCSPR-0107`, `RCSPR-0167`

sourceMapIds: `SM-0037`, `SM-0038`, `SM-0042`, `SM-0077`, `SM-0112`,
`SM-0115`, `SM-0133`, `SM-0154`, `SM-0157`

featureIds: `FI-0031`, `FI-0079`, `FI-0137`, `FI-0156`, `FI-0157`,
`FI-0308`, `FI-0321`, `FI-0322`

gapOrDecisionIds: `G-0008`, `G-0010`, `G-0011`, `G-0012`, `G-0013`,
`G-0014`, `G-0033`, `G-0172`

fixtureKind: `manual-review-placeholder`

owner: `QA evidence`

status: `planned`

secretsPolicy: `no-secrets`

artifactClass: `manual-evidence`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T23:05:57Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`,
`RuntimeEventReplay.swift`, `RelayConsoleVisualEvidenceTests`,
`implementation-evidence-packet-matrix.md`

files:

- `manual-evidence/chat/chat-demo-signoff-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0020`, `CODE-001-021`

validationCommandIds: `VC-0108`

demoIds: `Demo 2`, `Demo 7`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0018-0020-runtime-dispatch-chat-evidence/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-021-itc-0020-chat-ui-visual-accessibility-demo-evidence.md`

surface: `Manual Chat demo signoff for Slice 4`

stateKind: `pending`

reasonCode: `manual-demo-signoff-pending`

decisionIds: `none`

missingPrerequisites: `Manual observations for standard and minimum-window chat UI, VoiceOver/help label traversal, Demo 2 chat/runtime, Demo 7 replay/restart, and Demo 8 visual/accessibility review remain required.`

currentState: `Automated service, replay, model, visual-source, accessibility-source, fixture, and no-fake/no-secret evidence exists; manual observations are not yet claimed.`

notParityStatement: `This planned manifest is not screenshot proof, VoiceOver proof, real runtime transcript proof, full Demo closeout, release readiness, Paperclip proof, or HTML-native proof. Paperclip and HTML-native evidence remain excluded unless reinstated.`

activationRequirement: `Reviewer must update status and attach redacted manual observations before this manifest can be cited as completed manual evidence.`

releaseImpact: `Keeps manual Demo 2, Demo 7, and Demo 8 signoff explicit while allowing ITC-0020 automated/source-backed aggregation to close.`

determinism: `The placeholder uses fixed ids and contains no environment-specific values.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, screenshots, prompts, runtime logs, and auth/session data are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future manual evidence must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified manual proof, ITC-0020 closeout must be downgraded to partial-proof.`
