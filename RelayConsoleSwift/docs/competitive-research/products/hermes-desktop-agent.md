# Hermes Desktop Agent

## Summary

Hermes Agent is the Nous Research self-improving AI agent. Its documentation describes a built-in learning loop, skills created/reused from experience, memory across sessions, messaging-platform access, provider/model flexibility, scheduled automations, delegates/subagents, execute-code tool use, MCP integration, voice mode, security/command approval/container isolation topics, and deployment on local machines or inexpensive cloud hosts: https://hermes-agent.nousresearch.com/docs.

## Jobs/use cases

- Personal/business AI agent that can run tasks over time.
- Scheduled automations with delivery to messaging platforms.
- Remote operation through messaging platforms such as Telegram/Discord while the agent runs on a machine or cloud VM.
- Skill/memory accumulation across repeated workflows.
- Tool-using automation via code execution, MCP servers, browser/tool gateways, and integrations.

## Feature overlap with Relay Console

- **Local desktop/runtime agent:** Relay Console's local code registers a `HermesAgentAdapter` and OpenClaw adapter in `RuntimeBridgeRegistry`, indicating Hermes is not only a comparable but also a supported/target runtime inside Relay Console.
- **Cron/autonomy:** Hermes docs advertise scheduled automations; Relay Console includes `HermesCronSchedulerService`, artifact integration with the scheduler, and harness scheduler maintenance in `HarnessInstallManager`.
- **Skills/tools:** Hermes docs emphasize skills and MCP; Relay Console includes marketplace runtime mounts, runtime tool bridge services, provider wrapper tool compilation, and provider action brokers.
- **Profiles/memory:** Hermes docs emphasize memory/skills; Relay Console's runtime workspace UI has Hermes profile editing notices for `SOUL.md`, `profile.yaml`, and `config.yaml`.
- **Approvals/safety:** Hermes docs include security/command approval/container isolation topics; Relay Console has explicit local approval inbox/services, permission policy, audit security, native file permissions, and runtime action blockers/dry-runs.

## Where it differs

- Hermes is the agent/runtime; Relay Console appears to be an operations console around agents, workspaces, harness installs, provider integrations, action policies, approvals, artifacts, visual/evidence tests, and runtime monitoring/recovery.
- Hermes is documented as living wherever deployed, including cloud hosts; Relay Console's packaged product is a macOS Swift app (`Package.swift` requires macOS 14+ for the executable).
- Hermes docs describe broad agent capabilities; Relay Console's current code must distinguish installed/bridged runtime functionality from advertised product UX. For example, local code currently blocks or dry-runs several destructive/action-write classes pending release-scope decisions.

## Pricing/packaging if relevant

Open question. The public docs page describes installation/deployment modes and providers, but this run did not verify a current pricing page for Hermes Desktop Agent. Source checked: https://hermes-agent.nousresearch.com/docs.

## Distribution/ecosystem

- Documentation and download links are in Hermes Agent docs: https://hermes-agent.nousresearch.com/docs.
- Integrates with messaging platforms and MCP according to docs navigation/content.
- Relay Console code integrates Hermes through `HermesAgentAdapter`, harness installation, runtime workspace, marketplace runtime mount/bridge services, and cron scheduling.

## Evidence/source links

- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs
- Relay Console local evidence: `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/RuntimeAdapters.swift`; `Sources/RelayConsoleCore/HarnessInstallManager.swift`; `Sources/RelayConsoleCore/HermesCronSchedulerService.swift`; `Sources/RelayConsoleApp/RuntimeWorkspaceViews.swift`; `Package.swift`.

## Open questions

- What should Relay Console claim as native console capability versus Hermes runtime capability surfaced through Relay Console?
- Which Hermes security model details map one-to-one to Relay Console's local approval/audit/policy services, and which remain runtime-specific?
- Is there a current Hermes Desktop Agent pricing/packaging page that should be cited separately from the docs landing page?

## Last updated

2026-06-27
