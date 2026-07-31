# Service Fixture Manifest - security-decision-gates-001

id: `fix-services-settings-security-decision-gates-001`

layer: `services`

productArea: `settings`

requirementIds: `ITC-0050`, `RCSPR-0064`, `RCSPR-0065`, `RCSPR-0097`, `RCSPR-0111`

sourceMapIds: `SM-0100`, `SM-0101`, `SM-0102`, `SM-0142`, `SM-0155`

featureIds: `FI-0073`, `FI-0074`, `FI-0075`, `FI-0113`, `FI-0187`

gapOrDecisionIds: `D-0001`, `D-0004`, `D-0006`

fixtureKind: `service-behavior`

owner: `settings-security`

status: `verified-source`

secretsPolicy: `redacted`

artifactClass: `service-fixture`

branch: `codex/itc-0038-0040-task-approval-foundation`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `SettingsSecurityService.swift`, `LocalDataService.swift`, `AppViewModel.swift`, `Views.swift`, `RelayConsoleProfileSettingsTests`

files:

- `Tests/Fixtures/services/settings/security-decision-gates-001/manifest.md`
- `Sources/RelayConsoleCore/SettingsSecurityService.swift`
- `Sources/RelayConsoleCore/LocalDataService.swift`
- `Tests/RelayConsoleProfileSettingsTests/ProfileSettingsTests.swift`

expectedChecks:

- `swift run RelayConsoleProfileSettingsTests`
- `swift run RelayConsoleVisualEvidenceTests`
- `swift run RelayConsoleMigrationTests`
- `swift run RelayConsoleModelContractTests`

implementationTaskIds: `ITC-0050`, `CODE-001-049`

validationCommandIds: `VC-0102`, `VC-0106`, `VC-0108`

demoIds: `Demo 6`, `Demo 7`

branchPacket:
`agent-loop-relayconsole-swift-coding/evidence/branches/codex-itc-0038-0040-task-approval-foundation/evidence-packet.md`

reportIds:
`agent-loop-relayconsole-swift-coding/loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-049-itc-0050-security-support-legal-decision-gates.md`

surface: `Settings Security local-first account lifecycle, support/legal/status disposition, cloud account unavailable state, and secret-safe export metadata.`

stateKind: `decision_gated`

reasonCode: `decision.required`

decisionIds: `D-0001`, `D-0004`, `D-0006`

missingPrerequisites: `Native support/legal/status placement, optional cloud account mode, and destructive local lifecycle semantics are not approved.`

currentState: `SettingsSecurityService creates durable decision dispositions, prepares secret-safe export metadata, emits settingsSecurityUpdated and settingsLocalExportPrepared, audits blocked lifecycle actions, and rejects destructive/cloud/support/legal actions with decision.required.`

notParityStatement: `This fixture does not claim support/legal/status parity, cloud account parity, password/session authority, destructive reset/removal execution, support upload, real export file creation, or release readiness.`

activationRequirement: `Resolve D-0001, D-0004, and D-0006, then add service, UI, visual, accessibility, manual, and release evidence before enabling gated actions.`

releaseImpact: `Allows the release packet to list unresolved security/support/legal/account lifecycle scope as verified unavailable rather than fake parity.`

determinism: `Service tests use fixed dates, stable decision ids, explicit reason codes, and no environment-specific account values.`

noFakeProductSeed: `No support tickets, legal records, cloud sessions, browser sessions, mobile sessions, account lifecycle rows beyond redacted export metadata, or Paperclip rows are seeded.`

noSimulatedRuntimeOutput: `No runtime transcript, support/legal action, cloud account lifecycle output, account deletion, password change, session revoke, or destructive reset output is generated.`

noGeneratedWelcome: `No generated welcome messages are inserted.`

privateStateExclusions: `Raw secrets, account values, browser sessions, support payloads, legal payloads, workspace values, local paths, account export contents, and destructive lifecycle payloads are excluded.`

redactionReview: `RelayConsoleProfileSettingsTests checks export metadata, audit redaction, relaunch recovery, and secret-free encoded export records.`

failureHandling: `If decision-gated actions execute, raw account values enter export metadata, support/legal/cloud controls become active without decisions, or audit rows lose redaction, ITC-0050 closeout fails.`
