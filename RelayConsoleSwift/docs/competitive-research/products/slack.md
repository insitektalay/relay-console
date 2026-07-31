# Slack

## Summary

Slack is a workplace collaboration platform centered on channels, direct messages, huddles, clips, canvases, workflow automation, apps/integrations, Slack AI, Slackbot, and Salesforce/Agentforce integrations. Slack's public feature page describes collaboration features such as channels, Slack Connect, messaging, huddles, clips, canvases, lists, file sharing, apps/integrations, Workflow Builder, Slack AI, Slackbot, Agentforce, enterprise search, and security/enterprise key management: https://slack.com/features.

## Jobs/use cases

- Team chat, workspace collaboration, and searchable organizational memory.
- Internal/external collaboration through channels and Slack Connect.
- Lightweight automation with Workflow Builder and app integrations.
- AI summarization/search and agent surfaces inside an existing work-chat context.
- Enterprise communication governance and security.

## Feature overlap with Relay Console

- **Chat/workspace:** overlaps with Relay Console's `chat` navigation/service and local workspace model.
- **Applications/integrations:** overlaps with Relay Console's Applications section, provider connection services, marketplace installs, wrapper tools, and provider action broker.
- **Approvals/safety:** Slack has enterprise security/governance and app controls; Relay Console has explicit provider action approval services and runtime action blockers in local code.
- **Agent surface:** Slack now positions Slackbot and Agentforce as AI/agent surfaces in Slack, which can be compared with Relay Console's agent organization, Agent Ops HQ, runtime harnesses, dispatch, and provider action tooling.

## Where it differs

- Slack is primarily a cloud team-communication and collaboration platform; Relay Console is a macOS Swift app with local data/services and installed desktop agent runtime harnesses.
- Slack integrations usually bring external apps into Slack; Relay Console appears to mount policy-scoped provider wrapper tools into local/desktop agent runtimes and uses local Keychain-backed user credentials where implemented.
- Slack is not positioned as a multi-runtime local agent operations console with Hermes/OpenClaw harness installation, runtime workspace, cron scheduling, artifact library, event replay, visual evidence, and runtime recovery services.

## Pricing/packaging if relevant

Slack's pricing page lists a Free plan with 90 days of message history and up to ten apps; paid plans add more business features. Source: https://slack.com/pricing.

## Distribution/ecosystem

- Web and desktop/mobile collaboration app.
- Slack App Marketplace / App Directory and APIs for third-party apps and internal tooling; public feature navigation points to Apps & integrations, Workflow Builder, Slack Marketplace, and Agentic Platform: https://slack.com/features.
- Salesforce ecosystem tie-in through Salesforce channels, Agentforce, and enterprise search messaging on Slack's product pages.

## Evidence/source links

- Slack features: https://slack.com/features
- Slack pricing: https://slack.com/pricing
- Slack help article, "What is Slack?": https://slack.com/intl/en-gb/help/articles/115004071768-What-is-Slack-
- Relay Console local evidence: `Package.swift`; `Sources/RelayConsoleApp/AppViewModel.swift`; `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/RuntimeActionService.swift`.

## Open questions

- How mature/available are Slackbot Skills and Agentforce agent workflows for non-Salesforce-native operator use cases compared with Relay Console's local runtime bridge model?
- Which Slack app approval/security controls should be compared directly against Relay Console's provider action approval inbox and audit services?

## Last updated

2026-06-27
