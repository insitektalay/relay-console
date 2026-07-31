# Glean

## Summary

Glean positions itself as "Work AI" for enterprise search, assistant, and agents over company knowledge, tools, and workflows. Its product navigation emphasizes Glean Assistant, Glean Agents, Glean Search, Enterprise Graph/Personal Graph, connectors/actions, model hub, APIs, MCP Gateway, and embedded surfaces such as Slack, Microsoft Teams, Zoom, Zendesk, GitHub, and browser extension: https://www.glean.com/ and https://www.glean.com/product/ai-agents.

## Jobs/use cases

- Enterprise search and assistant over company data with permission-aware context; Glean docs describe search, Glean Chat, connectors, and admin setup: https://docs.glean.com/.
- Build, publish, govern, version, share, schedule, and monitor agents through Agent Builder/library concepts and an Agent Development Lifecycle documented by Glean: https://docs.glean.com/agents.md and https://docs.glean.com/agents/agent-development-lifecycle/adlc.md.
- Run agents with triggers, schedule triggers, content triggers, Slack publishing, insights, execution limits, memory, sharing/permissions, and templates according to the docs index: https://docs.glean.com/llms.txt.
- Connect AI clients and external tools through Glean's managed MCP server/Gateway and expose Glean Agents as MCP tools: https://docs.glean.com/administration/platform/mcp/about.md and https://docs.glean.com/administration/platform/mcp/agents-as-tools.md.
- Use tool/action governance, including human-in-the-loop confirmations for write tools and admin controls for tool visibility/access: https://docs.glean.com/tools/human-in-the-loop-experience-for-tools.md and https://docs.glean.com/administration/tools.md.

## Feature overlap with Relay Console

- **Agent/workspace ops:** Glean Agents, agent library, schedule/content triggers, insights, and lifecycle governance overlap strongly with Relay Console's Agent Ops HQ, agent provisioning/teardown, Hermes cron scheduler, runtime dashboard, and artifact/evidence posture.
- **Provider/action integrations:** Glean connectors/actions, tools, MCP Gateway, and remote MCP server support overlap with Relay Console's provider action adapters, marketplace runtime mounts, wrapper tools, and broker server.
- **Approvals/safety/audit:** Glean docs explicitly discuss human-in-the-loop confirmations for write tools, chat/agent history retention, tool controls, and agent access policies; Relay Console has local approval inbox, permission policy, audit security, and runtime blockers.
- **Evidence/monitoring:** Glean insights/evaluations/governance materials are adjacent to Relay Console's event replay, visual evidence, accessibility capture, and component baseline harnesses, though not the same implementation type.

## Where it differs

- Glean is an enterprise SaaS knowledge/search/agent platform; Relay Console is a local macOS operations console for runtimes and provider actions, based on inspected Swift package structure and services.
- Glean's primary value is indexed/federated company context and permission-aware enterprise search plus agent workflows; Relay Console's inspected code emphasizes local harness install, runtime adapters, provider-action approval/mounting, cron, artifacts, and evidence harnesses.
- Glean Agent Sandbox gives Glean a virtual computer with file system, shell, and code interpreter for data analysis/cross-system aggregation; Relay Console code currently excludes local host-control/app command execution from Swift scope while supporting runtime dispatch/mount services.

## Pricing/packaging if relevant

Glean's public pages checked this run did not expose stable self-serve plan prices; treat pricing as contact-sales/open until a current pricing source is verified. Glean docs do expose enterprise admin/security/control topics, and the product site positions Glean around enterprise Work AI: https://www.glean.com/ and https://docs.glean.com/.

## Distribution/ecosystem

- Hosted enterprise SaaS with web app, admin console, browser extension, and embedded surfaces in Slack, Microsoft Teams, Zoom, Zendesk, GitHub, Miro, and more: https://www.glean.com/.
- Connector/action ecosystem plus Glean MCP server/Gateway for AI host applications and external tools: https://docs.glean.com/administration/platform/mcp/about.md and https://docs.glean.com/administration/platform/mcp/mcp-gateway.md.

## Evidence/source links

- Glean homepage/product navigation: https://www.glean.com/
- Glean AI Agents product page: https://www.glean.com/product/ai-agents
- Glean docs home: https://docs.glean.com/
- Glean docs index/llms.txt: https://docs.glean.com/llms.txt
- Agents docs entry: https://docs.glean.com/agents.md
- Agent Development Lifecycle: https://docs.glean.com/agents/agent-development-lifecycle/adlc.md
- Agent Sandbox & Programmatic Tool Calling: https://docs.glean.com/administration/assistant/features/agentic-engine/agent-sandbox-ptc.md
- Tool/agent human-in-the-loop confirmations: https://docs.glean.com/tools/human-in-the-loop-experience-for-tools.md
- Chat history/admin retention: https://docs.glean.com/administration/assistant/configuration/chat-history.md
- OAuth options for action packs: https://docs.glean.com/administration/actions/setup-actions/choose-central-or-custom-oauth.md
- Relay Console local evidence: `Package.swift`; `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/RuntimeActionService.swift`; `Tests/RelayConsoleEventReplayTests`; `Tests/RelayConsoleVisualEvidenceTests`.

## Open questions

- Which Glean pricing/packaging source should be used for current plan boundaries and add-ons?
- How do Glean Agent access policies, Protect/Protect+, and MCP analytics compare in detail to Relay Console's approval inbox/audit/evidence story?
- Should Relay Console treat Glean primarily as an enterprise knowledge/agent competitor or as an integration target for company-context search and agent tools?

## Last updated

2026-06-28
