# Event Replay Fixture Manifest - Runtime Applications Slice Relaunch Aggregation

id: `fix-events-applications-slice-6-7-aggregation-relaunch-001`

layer: `event-replay`

productArea: `runtime-applications-slice-signoff`

requirementIds: `RCSPR-0005`, `RCSPR-0006`, `RCSPR-0095`,
`RCSPR-0109`, `RCSPR-0124`, `RCSPR-0126`, `RCSPR-0135`,
`RCSPR-0175`, `RCSPR-0176`, `RCSPR-0177`, `RCSPR-0178`,
`RCSPR-0179`, `RCSPR-0180`, `RCSPR-0181`, `RCSPR-0182`,
`RCSPR-0183`, `ITC-0037`

sourceMapIds: `SM-0055`, `SM-0056`, `SM-0057`, `SM-0058`,
`SM-0059`, `SM-0060`, `SM-0138`, `SM-0139`, `SM-0153`,
`SM-0154`, `SM-0155`, `SM-0159`

featureIds: `FI-0041`, `FI-0042`, `FI-0043`, `FI-0044`,
`FI-0045`, `FI-0046`, `FI-0047`, `FI-0048`, `FI-0049`,
`FI-0050`, `FI-0051`, `FI-0052`, `FI-0053`, `FI-0054`,
`FI-0055`, `FI-0056`, `FI-0102`, `FI-0138`, `FI-0139`,
`FI-0165`, `FI-0166`, `FI-0167`, `FI-0168`, `FI-0169`,
`FI-0170`, `FI-0171`, `FI-0172`, `FI-0173`

gapOrDecisionIds: `ITC-0035-excluded`, `ITC-0045`, `ITC-0046`,
`PAPERCLIP-EXCLUDED-001`

fixtureKind: `event-replay-source-signoff`

owner: `runtime-applications`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `event-replay-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `RuntimeEventReplay.swift`, `EventBus.swift`,
`RuntimeDashboardService.swift`, `RuntimeRecoveryService.swift`,
`ApplicationsService.swift`, `ProviderConnectionService.swift`,
`MarketplaceInstallService.swift`, `ToolRequestService.swift`

files:

- `events/applications/slice-6-7-aggregation-relaunch-001/manifest.md`
- `../RelayConsoleEventReplayTests/EventReplayTests.swift`

expectedChecks:

- `VC-0103`
- `swift run RelayConsoleEventReplayTests`

implementationTaskIds: `ITC-0029`, `ITC-0031`, `ITC-0032`,
`ITC-0033`, `ITC-0034`, `ITC-0036`, `ITC-0037`, `CODE-001-037`

validationCommandIds: `VC-0103`, `ITC-0037`

demoIds: `Demo 7`, `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-037-itc-0037-runtime-applications-evidence-packet.md`

determinism: `The consuming replay and service tests use fixed retained record ids, timestamps, workspace ids, app ids, agent ids, dispatch ids, and duplicate keys. This aggregation manifest does not add product-visible replay rows.`

noFakeProductSeed: `No product-visible runtime dashboard, provider connection, Marketplace install, Needed Tools, local app, generated pack, or Paperclip rows are seeded.`

noSimulatedRuntimeOutput: `The fixture records aggregation and relaunch-evidence boundaries only; it is not runtime harness output, provider output, install output, command output, or generated pack output.`

noGeneratedWelcome: `No generated welcome text is included.`

privateStateExclusions: `Machine-specific paths, account values, private prompts, screenshots, source-host data, local filesystem roots, and raw credentials are excluded.`

redactionReview: `Placeholder text contains no secrets; future replay, relaunch, or screenshot artifacts must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified real relaunch proof or includes local app/source-host/generated-pack/Paperclip scope, ITC-0037 closeout must be downgraded to partial-proof or no-go.`

releaseImpact: `Links Slice 6/7 relaunch residuals for Demo 7 without converting planned manual observations into release proof.`
