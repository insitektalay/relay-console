# Accessibility Fixture Manifest - Chat Composer Keyboard

id: `fix-accessibility-chat-composer-keyboard-001`

layer: `accessibility`

productArea: `chat`

requirementIds: `RCSPR-0269`, `FI-0259`

sourceMapIds: `SM-0229`

featureIds: `FI-0259`

gapOrDecisionIds: `G-0126`

fixtureKind: `source-backed-accessibility-evidence`

owner: `accessibility`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `accessibility-source-review`

branch: `codex/itc-0015-0017-composer-attachments-rendering`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T22:20:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `UIComponents.swift`, `Views.swift`

files:

- `accessibility/chat/composer-keyboard-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0107`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `ITC-0015`

validationCommandIds: `VC-0107`

demoIds: `Demo 2`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0015-0017-composer-attachments-rendering/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-016-itc-0015-composer-drafts-send-failure-mentions.md`

surface: `Composer labels, help, disabled reasons, and failed-send accessibility label`

stateKind: `active`

reasonCode: `verified-source-a11y`

decisionIds: `none`

missingPrerequisites: `Manual VoiceOver traversal and focus-return observation remain required before final accessibility closeout.`

currentState: `Composer editor exposes Message composer label, send control exposes reason-backed help/hints, status text exposes accessibility labels, and failed local-send rows combine error and retry-unavailable copy.`

notParityStatement: `This is source-backed accessibility evidence only; it is not manual VoiceOver or screenshot proof.`

activationRequirement: `Manual accessibility evidence must cite this fixture before Demo accessibility claims.`

releaseImpact: `Supports ITC-0015 accessibility source evidence while preserving manual review residuals.`

determinism: `The checks rely on stable accessibility labels/help and Swift type names.`

noFakeProductSeed: `No product-visible data is seeded.`

noSimulatedRuntimeOutput: `No runtime output is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, and runtime snapshots are excluded.`

redactionReview: `Fixture text and source labels contain no secret material.`

failureHandling: `If labels/help/failed-send accessibility copy are removed, ITC-0015 accessibility evidence fails.`
