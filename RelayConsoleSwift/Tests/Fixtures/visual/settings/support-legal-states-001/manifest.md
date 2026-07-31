# Visual Fixture Manifest - Settings Service And Unavailable States

id: `fix-visual-settings-support-legal-states-001`

layer: `visual`

productArea: `settings`

requirementIds: `RCSPR-0008`, `RCSPR-0058`, `RCSPR-0059`, `RCSPR-0060`, `RCSPR-0061`, `RCSPR-0065`, `RCSPR-0097`, `RCSPR-0111`, `RCSPR-0122`, `RCSPR-0132`, `RCSPR-0195`, `ITC-0008`, `ITC-0048`

sourceMapIds: `SM-0093`, `SM-0094`, `SM-0095`, `SM-0096`, `SM-0103`, `SM-0104`, `SM-0145`, `SM-0148`, `SM-0150`, `SM-0151`, `SM-0155`, `SM-0161`

featureIds: `FI-0067`, `FI-0068`, `FI-0069`, `FI-0070`, `FI-0075`, `FI-0116`, `FI-0125`, `FI-0185`

gapOrDecisionIds: `D-0001`, `D-0004`, `D-0006`, `PAPERCLIP-EXCLUDED-001`, `MISSION-CONTROL-HOST-CONTROL-EXCLUDED`

fixtureKind: `visual-source-scaffold`

owner: `settings-ui`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `manual-evidence-scaffold`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `SettingsPreferenceService.swift`, `AppViewModel.swift`, `Views.swift`, `RelayConsoleProfileSettingsTests`, `RelayConsoleVisualEvidenceTests`

files:

- `visual/settings/support-legal-states-001/manifest.md`
- `../RelayConsoleProfileSettingsTests/ProfileSettingsTests.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0106`
- `swift run RelayConsoleProfileSettingsTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0048`, `CODE-001-047`

validationCommandIds: `VC-0106`, `ITC-0008`

demoIds: `Demo 6`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-047-itc-0048-settings-services.md`

surface: `Account save states, Appearance theme default, Workspace save states, Team & members routing, support/legal/status unavailable posture, cloud account lifecycle unavailable posture`

stateKind: `planned-visual-review`

reasonCode: `settings-services-visual-review-pending`

decisionIds: `D-0001`, `D-0004`, `D-0006`, `PAPERCLIP-EXCLUDED-001`, `MISSION-CONTROL-HOST-CONTROL-EXCLUDED`

missingPrerequisites: `Rendered standard-window screenshots, minimum-window screenshots, keyboard traversal, VoiceOver traversal, support/legal/status placement decision, cloud account mode decision, destructive local lifecycle decision, email/mobile delivery service evidence, Paperclip reinstatement, and Mission Control host-control reinstatement remain absent.`

currentState: `Automated source and service tests verify SettingsPreferenceService account, appearance, workspace, role, event, relaunch, and Team routing source anchors; visual/manual parity is not yet claimed.`

notParityStatement: `This planned visual manifest is not screenshot proof, keyboard proof, VoiceOver proof, support/legal/status parity, cloud account parity, email/mobile delivery parity, Paperclip parity, Mission Control host-control parity, destructive lifecycle proof, or release readiness.`

activationRequirement: `Reviewer must attach redacted standard and minimum-window observations for retained Settings service states before this manifest can become verified visual evidence. Decision-gated support/legal/cloud/lifecycle states must remain unavailable unless approved.`

releaseImpact: `Keeps ITC-0048 visual residuals explicit while allowing automated service/UI source evidence to close honestly.`

determinism: `The placeholder uses fixed ids, source anchors, task ids, and unavailable-state decisions without environment-specific values.`

noFakeProductSeed: `No product-visible chats, agents beyond deterministic service-test count fixtures, notifications, provider connections, support tickets, legal records, cloud sessions, account lifecycle records, or Paperclip rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript output, notification delivery output, provider callback, support/legal action, Mission Control action, cloud account lifecycle output, or account deletion/export output is generated.`

noGeneratedWelcome: `No generated welcome messages are inserted.`

privateStateExclusions: `Private paths, account values beyond example.test service fixtures, credentials, provider tokens, screenshots, prompts, runtime logs, auth/session data, source-host data, workspace roots, support/legal payloads, and lifecycle exports are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future screenshots and reviewer observations must redact profile values, workspace ids, local paths, and account data before status changes.`

failureHandling: `If this planned manifest is cited as verified screenshot proof, loses Settings service source anchors, exposes private state, or activates support/legal/status, cloud account, email/mobile delivery, Paperclip, Mission Control, or destructive lifecycle controls without decisions and service evidence, ITC-0048 closeout must be downgraded.`
