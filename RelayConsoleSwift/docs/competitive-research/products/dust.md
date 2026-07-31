# Dust

## Summary

Dust is a hosted enterprise AI-agent platform and developer platform for building, managing, and running workspace agents over company data, connectors, tools, and MCP servers. Dust's docs describe user guides and a developer platform for creating and using AI agents, with admin guides for data spaces, connectors, tools, audit logs, Computer, MCP servers, credits, and seat/subscription management: https://docs.dust.tt/.

## Jobs/use cases

- Build and manage AI agents in a shared workspace; Dust docs cover agent management, tags, discoverability, editable/default agents, and admin-managed tags: https://docs.dust.tt/docs/managing-agents.md.
- Connect enterprise data sources such as Google Drive, GitHub, Microsoft, Notion, Snowflake, Zendesk, Intercom, BigQuery, Gong, and Confluence, according to the docs index: https://docs.dust.tt/llms.txt.
- Extend agent toolsets with remote MCP servers, including public MCP servers and OAuth/Bearer/static secret authentication modes: https://docs.dust.tt/docs/remote-mcp-server.md.
- Use Dust Computer for web/API processes that require controlled network access and workspace/user approvals for domains: https://docs.dust.tt/docs/computer-admin.md.
- Provide enterprise observability/compliance via audit logs that distinguish significant workspace actions and AI-agent/tool execution attribution: https://docs.dust.tt/docs/audit-logs.md.

## Feature overlap with Relay Console

- **Agents/tool runtime:** Dust agents plus MCP/tools overlap with Relay Console's runtime mounts, wrapper tools, broker server, and provider action broker.
- **Provider/data integrations:** Dust connectors and tools overlap with Relay Console's provider adapters for X, LinkedIn, Gmail, Google Docs, Google Search Console, Notion, Microsoft Clarity, PostHog, TelemetryDeck, and Sentry observed in `RelayConsoleServices.swift`.
- **Safety/audit:** Dust audit logs, admin-only controls, MCP auth modes, and Computer network allowlists are strong comparables for Relay Console's provider action approval inbox, permission policies, audit security, and host-control exclusions.
- **Multi-agent operations:** Dust's agent management/tags and workspace controls compare with Relay Console's agent organization, Agent Ops HQ, provisioning, teardown, runtime dashboard, and Hermes cron scheduling.

## Where it differs

- Dust is a hosted collaborative AI-agent/workspace platform; Relay Console is locally grounded as a macOS Swift app with local data/services, runtime harness management, and desktop runtime adapters.
- Dust Computer provides controlled web/API computer capabilities; Relay Console's `RuntimeActionService.hostControlExclusionReason` explicitly excludes Mission Control host-control, local app process control, and local app command execution from Swift scope.
- Dust's Enterprise audit logs are SaaS workspace compliance features; Relay Console's evidence/replay/capture harness targets are local product/testing/evidence infrastructure rather than a verified SaaS audit-log product.

## Pricing/packaging if relevant

Dust subscription docs say Dust offers Business and Enterprise plans. Business has a free option with no credit card required, up to 5 users, 3 connectors, and 5 Spaces, or paid Pro/Max seats up to 100 seats, up to 3 connectors, and 5 Spaces; Enterprise has unlimited users/connectors/Spaces, SSO, SCIM, audit logs, and advanced credit controls, with contact-sales onboarding: https://docs.dust.tt/docs/subscriptions.md.

## Distribution/ecosystem

- Hosted web/SaaS workspace with admin console, Slack community/docs, developer platform, and API references: https://docs.dust.tt/.
- Connector ecosystem spans common SaaS/data systems; tools can be extended via remote MCP servers and authentication modes: https://docs.dust.tt/llms.txt and https://docs.dust.tt/docs/remote-mcp-server.md.

## Evidence/source links

- Dust docs home: https://docs.dust.tt/
- Dust docs index/llms.txt: https://docs.dust.tt/llms.txt
- Agents management: https://docs.dust.tt/docs/managing-agents.md
- Adding remote MCP servers: https://docs.dust.tt/docs/remote-mcp-server.md
- Audit logs: https://docs.dust.tt/docs/audit-logs.md
- Computer admin setup: https://docs.dust.tt/docs/computer-admin.md
- Subscriptions/payments: https://docs.dust.tt/docs/subscriptions.md
- Relay Console local evidence: `Package.swift`; `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift`; `Sources/RelayConsoleCore/RuntimeActionService.swift`.

## Open questions

- What current public source best describes Dust's end-user agent builder UX, scheduled/background-agent behavior, and human-in-the-loop action confirmations?
- How should Relay Console compare Dust Computer's controlled network/browser-like capability with Relay Console's current explicit exclusion of local host-control/app command execution?
- Are Dust's audit-log and MCP auth controls closer to Relay Console's approval inbox model or to enterprise SaaS governance that Relay Console might integrate with later?

## Last updated

2026-06-28
