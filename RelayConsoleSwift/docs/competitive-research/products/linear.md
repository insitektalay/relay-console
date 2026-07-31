# Linear

## Summary

Linear is a software-development planning and execution workspace for issues, projects, initiatives, roadmaps, customer requests, support intake, integrations, and increasingly AI/agent workflows. Its docs describe Linear as a purpose-built tool for planning and building products, while the AI product page frames Linear AI as workflow support for modern product teams: https://linear.app/docs and https://linear.app/ai.

## Jobs/use cases

- Plan and track product/software work across issues, projects, initiatives, cycles, views, and triage: https://linear.app/docs.
- Use Linear Agent to turn workspace context into action: create/update issues, projects, milestones, and initiatives; summarize/analyze work; answer workspace questions; and post/edit/delete its own comments: https://linear.app/docs/linear-agent.md.
- Delegate issues to AI agents/app users that behave similarly to users in a workspace; admins install agents and choose team access: https://linear.app/docs/agents-in-linear.md.
- Expose Linear data/actions to AI clients via a hosted remote MCP server for Claude, Cursor, Codex, and other compatible clients: https://linear.app/docs/mcp.md.

## Feature overlap with Relay Console

- **Workspace/chat/task context:** Linear's issues/projects/agent chat overlap conceptually with Relay Console's local `ChatService`, agent work dashboards, and Agent Ops HQ services.
- **Agent delegation/ops:** Linear's app-user agents and Linear Agent compare with Relay Console's agent organization/provisioning/teardown/runtime dispatch services.
- **Tool/action integrations:** Linear MCP and agent/app integrations are adjacent to Relay Console's marketplace/provider wrapper tools and provider action broker.
- **Permissions/safety:** Linear says Linear Agent operates within existing permissions and admins can disable it; Relay Console code has explicit approval inbox, permission policy, audit security, and runtime-action blockers.

## Where it differs

- Linear is a hosted product-development system of record; Relay Console is locally grounded as a macOS Swift package with runtime harnesses, provider-action approvals, artifacts, cron, and evidence harness targets.
- Linear's agents work inside Linear's issue/project model, while Relay Console code mounts provider/action tools into agent runtimes and registers Hermes/OpenClaw runtime adapters.
- Linear MCP is centrally hosted/managed by Linear; Relay Console's inspected code emphasizes local runtime broker/mount services and user-owned credentials via local service/Keychain patterns.

## Pricing/packaging if relevant

Linear pricing lists Free at $0 with unlimited members, 2 teams, and 250 issues; Basic at $10/user/month billed yearly; Business at $16/user/month billed yearly; and Enterprise as custom annual billing. The pricing page lists AI and agent workflows, agent platform, MCP access, Linear Agent, coding sessions beta, Linear Agent automations beta, Code Intelligence beta, and Triage Intelligence among plan features: https://linear.app/pricing.

## Distribution/ecosystem

- Web, desktop/mobile app ecosystem and developer/API integrations; Linear docs include download, integrations, API/webhooks, and MCP: https://linear.app/docs and https://linear.app/docs/mcp.md.
- Integrations Directory for available agents; Linear's agent page names examples including OpenAI Codex, Cursor, GitHub Copilot, and Sentry agent surfaces: https://linear.app/agents and https://linear.app/docs/agents-in-linear.md.

## Evidence/source links

- Linear docs index: https://linear.app/docs
- Linear AI page: https://linear.app/ai
- Linear for Agents page: https://linear.app/agents
- Linear Agent docs: https://linear.app/docs/linear-agent.md
- AI Agents in Linear docs: https://linear.app/docs/agents-in-linear.md
- Linear MCP server docs: https://linear.app/docs/mcp.md
- Linear pricing: https://linear.app/pricing
- Linear security/access docs: https://linear.app/docs/security-and-access.md
- Relay Console local evidence: `Package.swift`; `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/Models.swift`; `Sources/RelayConsoleCore/RuntimeActionService.swift`.

## Open questions

- How much of Linear's agent platform should Relay Console treat as a direct agent-ops comparable versus a vertical product-management/code-workflow integration target?
- What exact admin/audit/event records exist for Linear agent actions beyond app install permissions, authorized applications, and Linear Agent permission scoping?
- Should Relay Console prioritize Linear as a provider/action adapter given Devin/Cursor/Claude/Codex all interact with Linear via MCP/integrations?

## Last updated

2026-06-28
