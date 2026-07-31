# Service Fixture Manifest - Applications Needed Tools

id: `fix-service-applications-needed-tools-001`

layer: `service`

productArea: `applications`

requirementIds: `RCSPR-0037`, `RCSPR-0179`, `ITC-0036`, `ITC-0043`

sourceMapIds: `SM-0058`, `SM-0061`, `SM-0145`, `SM-0159`

featureIds: `FI-0043`, `FI-0119`, `FI-0127`

gapOrDecisionIds: `PAPERCLIP-EXCLUDED-001`, `TOOL-AUTO-GRANT-EXCLUDED-001`, `LOCAL-FILE-ACCESS-EXCLUDED-001`

fixtureKind: `applications-needed-tools-service`

owner: `tool-request-service`

status: `verified`

secretsPolicy: `secret-references-only`

artifactClass: `service-fixture`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `service evidence`

sourceBaseline: `ToolRequestService.swift`, `PermissionPolicyService.swift`, `AuditSecurityService.swift`, `LocalDataService.swift`, `ServiceTests.swift`

files:

- `services/applications/needed-tools-001/manifest.md`
- `../RelayConsoleServiceTests/ServiceTests.swift`
- `../../Sources/RelayConsoleCore/ToolRequestService.swift`
- `../../Sources/RelayConsoleCore/LocalDataService.swift`

expectedChecks:

- `VC-0102`
- `swift run RelayConsoleServiceTests`

implementationTaskIds: `ITC-0036`, `ITC-0043`

validationCommandIds: `VC-0102`

demoIds: `Demo 4`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-036-itc-0036-needed-tools.md`,
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-043-itc-0043-tool-requests-needed-tools-capability-resolution.md`

surface: `ToolRequestService policy-denied no-persist behavior, permission-policy authority, audit records, open-request dedupe, provider connection/grant derivation, scheduled continuation annotations, status updates, snapshot summaries, redaction, and relaunch durability`

stateKind: `verified-service`

reasonCode: `applications-needed-tools-service-backed`

decisionIds: `PAPERCLIP-EXCLUDED-001`, `TOOL-AUTO-GRANT-EXCLUDED-001`, `LOCAL-FILE-ACCESS-EXCLUDED-001`

missingPrerequisites: `Paperclip connection/link/setup/test/member/chat integration, automatic installs, automatic grants, runtime provider writes, local file access, and release readiness remain excluded or later.`

currentState: `ToolRequestService records policy-allowed agent-reported gaps, denies policy-blocked reports without persistence, audits report/status/no-persist transitions, dedupes open requests, derives connected/granted state from provider connection and install rows, annotates scheduled continuations waiting on capabilities, lets admins dismiss/ignore/mark unavailable/resolve, and does not auto-install or auto-grant.`

notParityStatement: `This fixture does not claim live tool execution, live install execution, Paperclip support, local app support, automatic grants, or local file access.`

activationRequirement: `Tool grant execution requires later permission, audit, and approval authority cards.`

releaseImpact: `Closes service-backed Needed Tools behavior for ITC-0036 and authority-backed tool request capability resolution for ITC-0043.`

determinism: `The test uses isolated stores, fixed timestamps, deterministic apps, memory Keychain references, and no live provider data.`

noFakeProductSeed: `No product-visible Needed Tools requests, snapshots, installs, credentials, or Paperclip rows are seeded outside isolated service tests.`

noSimulatedRuntimeOutput: `No runtime transcript, generated output, or runtime action run is stored.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Raw tokens, API keys, client secrets, bearer values, local paths, source-host metadata, prompts, raw workspace state, and runtime file contents are excluded.`

redactionReview: `Service assertions scan persisted request and snapshot JSON for raw sensitive values and require redacted evidence.`

failureHandling: `If policy-denied requests persist, permission policy checks are bypassed, audit rows are missing, scheduled continuation metadata is lost after relaunch, duplicate open requests are created, connected/granted state ignores source records, member mutation succeeds, raw secrets persist, runtime actions execute, local file access is claimed, auto-grants appear, or Paperclip/local state persists, this fixture fails.`
