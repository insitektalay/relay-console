# Microsoft Teams

## Summary

Microsoft Teams is Microsoft's communication and collaboration hub across chat, meetings, channels, files, and Microsoft 365. The current accessible primary source inspected in this run was the Teams developer platform documentation, which states that Teams is evolving from a communication hub into a collaborative and AI app platform and that developers can build agents and apps directly into Teams: https://learn.microsoft.com/en-us/microsoftteams/platform/overview.

## Jobs/use cases

- Enterprise/team chat, channels, meetings, calls, and collaboration in Microsoft 365 environments.
- Internal business workflows embedded into the collaboration surface through Teams apps.
- Microsoft 365-integrated agents/apps that surface information, automate processes, and connect existing web apps/SharePoint/Power Apps/services into Teams.
- Cross-device work communication on desktop, web, and mobile.

## Feature overlap with Relay Console

- **Chat/workspace:** Teams is a direct comparable for chat/workspace collaboration because users may map Relay Console's chat shell and workspace nav to Teams-style workplace communication.
- **Provider/action integrations:** Teams apps and agents overlap with Relay Console's Applications, provider connections, marketplace installs, and provider action broker at the platform/ecosystem layer.
- **Agent surfaces:** Microsoft explicitly frames Teams as a place to deploy agents/apps; Relay Console local code frames agents as local runtime-bound workers managed through Agent Ops, dispatch, runtime dashboards, and harness installation.
- **Approvals/governance:** Teams lives in Microsoft 365 governance/admin contexts; Relay Console code has more local, provider-action-specific approval/audit services.

## Where it differs

- Teams is primarily a cloud Microsoft 365 collaboration product; Relay Console local code evidence points to a native macOS local-first application with same-machine harnesses and local persistence.
- Teams extensibility embeds apps/agents into Teams/Microsoft 365 surfaces; Relay Console appears to mount provider wrapper tools into local runtimes and manage runtime activity, artifacts, cron scheduling, and recovery.
- Teams is likely stronger for enterprise communication, meetings, tenant administration, and Microsoft 365 distribution; Relay Console is differentiated if positioned as a local agent runtime operations console with evidence/replay/testing and per-action safety gates.

## Pricing/packaging if relevant

Open question for a later run. The Microsoft commercial Teams pricing pages returned HTTP 403 from this environment on 2026-06-27, so this brief does not make pricing claims beyond noting that Teams is packaged within Microsoft 365 and also has standalone/free offerings that need citation verification from an accessible pricing source.

## Distribution/ecosystem

- Teams web, desktop, and mobile app distribution in Microsoft 365 environments.
- Teams Developer Platform for building apps and agents inside Teams and across Microsoft 365. The docs state agents in Teams can be deployed across desktop, web, and mobile platforms and integrated to increase engagement, surface information/tools, automate processes, and extend/scale agents: https://learn.microsoft.com/en-us/microsoftteams/platform/overview.
- Microsoft 365 ecosystem, including SharePoint, Power Apps, and existing web app integrations referenced by the Teams developer platform overview: https://learn.microsoft.com/en-us/microsoftteams/platform/overview.

## Evidence/source links

- Microsoft Teams Developer Platform overview: https://learn.microsoft.com/en-us/microsoftteams/platform/overview
- Microsoft Teams product/pricing pages attempted but inaccessible from this environment during this run: https://www.microsoft.com/en-us/microsoft-teams/group-chat-software and https://www.microsoft.com/en-us/microsoft-teams/compare-microsoft-teams-options
- Relay Console local evidence: `Package.swift`; `agent-loops/agent-loop-clawchat-web-to-relayconsole-swift-prd/master-prd.md`; `Sources/RelayConsoleApp/AppViewModel.swift`; `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift`.

## Open questions

- Which current Teams pricing/packaging SKUs should be cited and compared once an accessible pricing source is available?
- How should Teams app/agent admin approval and tenant governance be compared against Relay Console's local provider action approval inbox, permission policy, and audit services?
- Does Relay Console need an explicit Microsoft 365/Teams channel integration story, or is Teams primarily a competitive reference for enterprise buyers?

## Last updated

2026-06-27
