# Manual Evidence Manifest - Guarded Nav States

id: `fix-manual-shell-guarded-nav-states-001`

layer: `manual`

productArea: `shell`

requirementIds: `RCSPR-0016`, `RCSPR-0017`, `RCSPR-0018`, `RCSPR-0085`,
`RCSPR-0106`, `RCSPR-0150`, `RCSPR-0153`, `ITC-0051`

sourceMapIds: `SM-0016`, `SM-0017`, `SM-0018`, `SM-0019`, `SM-0131`,
`SM-0141`, `SM-0155`

featureIds: `FI-0016`, `FI-0017`, `FI-0018`, `FI-0095`, `FI-0141`,
`FI-0144`

gapOrDecisionIds: `SBD-0001`, `Run-030-Approvals-exclusion`

fixtureKind: `manual-note`

owner: `UI`

status: `verified-mixed`

secretsPolicy: `no-secrets`

artifactClass: `mixed-route-review`

branch: `codex/itc-0011-0012-shell-components`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-22T20:45:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `Views.swift`, `UIComponents.swift`, `ShellNavigation.swift`,
`screen-contracts/shell/app-shell-navigation.md`,
`unavailable-surface-evidence-standard.md`,
`itc-0011-shell-navigation-readiness-packet-dry-run.md`

files:

- `manual-evidence/shell/guarded-nav-states-001/manifest.md`
- `../RelayConsoleShellNavigationTests/ShellNavigationTests.swift`

expectedChecks:

- `VC-0102`
- `VC-0105`
- `VC-0106`
- `VC-0107`
- `VC-0108`
- `swift run RelayConsoleShellNavigationTests`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0011`, `ITC-0051`

validationCommandIds: `VC-0102`, `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

demoIds: `Demo 1`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0011-0012-shell-components/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-012-itc-0011-shell-navigation-readiness.md`

surface: `AgentOps HQ`, `Applications`, `Insights`, `Approvals`

disposition: `active entry-live-state for AgentOps HQ; active marketplace-catalog for Applications; active source-backed-reports for Insights; out-of-scope for standalone Approvals`

stateKind: `mixed-active-excluded`

reasonCode: `action.unsupported`

excludedReasonCode: `action.unsupported`

decisionIds: `Standalone Approvals excluded by Run 030 unless explicitly reinstated.`

missingPrerequisites: `Full AgentOps visualization and layout polish remain later work. Applications provider OAuth, Marketplace installs, local apps, generated packs, source-host records, and Paperclip remain later or excluded work. Insights runtime report generation/retry remains unavailable until structured-job support is approved and wired. Approvals needs explicit reinstatement before any top-level shell route.`

currentUiState: `AgentOps HQ, Applications, and Insights are active selectable routes. The retained guarded Approvals button stays keyboard-selectable, shows the excluded glyph overlay, exposes reason-backed help and accessibility labels, and renders a guarded status notice while preserving the current active route.`

serviceState: `ShellNavigationResolver allows AgentOps HQ, Applications, and Insights direct selection backed by local wrap-up reports, report snapshots, and derived analytics, and denies unavailable or excluded direct selection with a ServiceGuardResult and no route side effects.`

screenContractReadiness: `screen-contracts/shell/app-shell-navigation.md plus ITC-0027 and ITC-0032 require AgentOps HQ entry live-state routing and Applications marketplace-catalog routing while preserving explicit guarded state and no parity claim for retained unavailable surfaces.`

notParityStatement: `This mixed-route review proves AgentOps HQ entry routing, Applications marketplace-catalog routing, and Insights source-backed report routing only; it does not prove full AgentOps visualization, provider installs, local apps, generated pack review, Paperclip, runtime report generation/retry, or standalone Approvals parity.`

activationRequirement: `Complete later provider OAuth, install execution, local app, source-host, generated pack, Paperclip, visual, accessibility, and manual evidence before enabling Applications writes; approve and wire structured-job report generation before enabling Insights retry; explicitly reinstate standalone Approvals before adding any top-level Approvals route.`

traceability: `ITC-0011`, `ITC-0027`, `ITC-0032`, `ITC-0051`, `RCSPR-0016`, `RCSPR-0017`, `RCSPR-0018`, `RCSPR-0085`, `RCSPR-0106`, `RCSPR-0150`, `FI-0016`, `FI-0017`, `FI-0018`, `FI-0095`, `FI-0141`, `FI-0144`, `SM-0016`, `SM-0017`, `SM-0018`, `SM-0019`, `SM-0131`, `SM-0141`, `SM-0155`, `VC-0102`, `VC-0105`, `VC-0106`, `VC-0107`, `VC-0108`

determinism: `Review state uses stable section keys, labels, glyph overlays, reason codes, and route outcomes; no private account or workspace values are required.`

noFakeProductSeed: `The manifest does not seed product-visible chats, agents, reports, applications, approvals, or AgentOps rows. Applications and Insights route activation depend on retained service records, not shell seed data.`

noSimulatedRuntimeOutput: `No runtime transcript or generated runtime output is included.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Screenshots or future review notes must exclude private paths, account values, local files, raw credentials, and raw workspace identifiers.`

redactionReview: `RelayConsoleShellNavigationTests, RelayConsoleVisualEvidenceTests, and branch redaction scan; current manifest contains only canonical route metadata.`

failureHandling: `Missing reason codes, missing help/accessibility labels, color-only unavailable state, side-effectful denied selection, stale screenshots, active AgentOps, Applications, or Insights route regression, or any active parity claim for retained guarded sections blocks shell evidence.`

releaseImpact: `Verified active AgentOps HQ entry route plus active Applications marketplace-catalog route and active Insights source-backed report route; release aggregation can cite entry live-state, marketplace-catalog, and retained local report routing but must not count full AgentOps visualization, provider installs, local apps, Paperclip, runtime report generation/retry, or standalone Approvals as active parity.`
