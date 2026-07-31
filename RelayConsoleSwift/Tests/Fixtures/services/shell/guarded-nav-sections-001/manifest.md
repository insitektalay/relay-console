# Service Fixture Manifest - Guarded Nav Sections

id: `fix-services-shell-guarded-nav-sections-001`

layer: `service`

productArea: `shell`

requirementIds: `RCSPR-0016`, `RCSPR-0017`, `RCSPR-0018`, `RCSPR-0085`,
`RCSPR-0106`, `RCSPR-0150`, `RCSPR-0153`, `ITC-0051`

sourceMapIds: `SM-0016`, `SM-0017`, `SM-0018`, `SM-0019`, `SM-0131`,
`SM-0141`, `SM-0155`

featureIds: `FI-0016`, `FI-0017`, `FI-0018`, `FI-0095`, `FI-0141`,
`FI-0144`

gapOrDecisionIds: `SBD-0001`, `Run-030-Approvals-exclusion`

fixtureKind: `deterministic-fixture`

owner: `services`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `guarded-route-fixture`

branch: `codex/itc-0011-0012-shell-components`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T20:45:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `ShellNavigation.swift`, `ServiceGuards.swift`,
`AppViewModel.swift`, `UIComponents.swift`,
`screen-contracts/shell/app-shell-navigation.md`,
`unavailable-surface-evidence-standard.md`

files:

- `services/shell/guarded-nav-sections-001/manifest.md`
- `../RelayConsoleShellNavigationTests/ShellNavigationTests.swift`

expectedChecks:

- `VC-0102`
- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleShellNavigationTests`

implementationTaskIds: `ITC-0011`, `ITC-0051`

validationCommandIds: `VC-0102`, `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 1`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0011-0012-shell-components/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-012-itc-0011-shell-navigation-readiness.md`

routeMatrix: `Chats, Agents, AgentOps HQ, Applications, Insights, and Settings are active. Approvals is excluded with action.unsupported.`

stateKind: `mixed-active-excluded`

reasonCode: `action.unsupported`

excludedReasonCode: `action.unsupported`

serviceState: `ShellNavigationResolver allows active direct route selection for AgentOps HQ, Applications, and Insights backed by local wrap-up reports, report snapshots, and derived analytics, and returns ServiceGuardResult for unavailable or excluded direct route selection while preserving the current active section.`

sideEffectCheck: `Denied route selections keep resolvedKey equal to the previous active section and set sideEffectsAllowed to false.`

surface: `AgentOps HQ`, `Applications`, `Insights`, `Approvals`

disposition: `active entry-live-state for AgentOps HQ; active marketplace-catalog for Applications; active source-backed-reports for Insights; out-of-scope for standalone Approvals`

missingPrerequisites: `Full AgentOps visualization and layout polish remain later work. Applications provider OAuth, Marketplace installs, local apps, generated packs, source-host records, and Paperclip remain later or excluded work. Insights runtime report generation/retry remains unavailable until structured-job support is approved and wired. Approvals needs explicit reinstatement before any top-level shell route.`

currentUiState: `ShellIconRail renders AgentOps HQ, Applications, and Insights as active selectable routes and renders the retained guarded Approvals button with excluded glyph overlay, reason-backed help text, accessibility labels, and a guarded status notice on denied selection.`

notParityStatement: `Guarded nav evidence now proves AgentOps HQ entry routing, Applications marketplace-catalog routing, and Insights source-backed report routing only; it does not prove full AgentOps visualization, provider installs, local apps, generated pack review, Paperclip, runtime report generation/retry, or standalone Approvals parity.`

activationRequirement: `Complete later provider OAuth, install execution, local app, source-host, generated pack, Paperclip, visual, and accessibility task cards before enabling Applications writes; approve and wire structured-job report generation before enabling Insights retry; explicitly reinstate standalone Approvals before adding any top-level Approvals route.`

determinism: `The resolver uses stable section keys, reason codes, correlation ids, route outcomes, and no external services.`

noFakeProductSeed: `The fixture does not seed product-visible chats, agents, workspaces, reports, applications, approvals, or AgentOps rows. Applications and Insights route activation depend on retained service records, not shell seed data.`

noSimulatedRuntimeOutput: `No runtime transcript or generated runtime output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, personal account values, local files, and raw credentials are excluded from the route metadata.`

redactionReview: `RelayConsoleShellNavigationTests plus branch redaction scan; metadata contains canonical ids and no user state.`

failureHandling: `Any active route regression for Chats, Agents, AgentOps HQ, Applications, Insights, or Settings; guarded direct-selection side effect; missing reason code; missing non-parity statement; or Approvals reinstatement without human decision blocks shell evidence.`

releaseImpact: `Verified active routes for AgentOps HQ entry state, Applications marketplace catalog, and Insights source-backed reports; release aggregation must not count full AgentOps visualization, provider installs, local apps, Paperclip, runtime report generation/retry, or standalone Approvals as active parity.`
