# Claude desktop / computer use / MCP

## Summary

Claude is Anthropic's AI assistant family across web, desktop/mobile apps, API, and enterprise products. The Claude download page says the desktop app gives access to Claude on desktop and mobile, with macOS/Windows/ChromeOS downloads, and describes desktop as "All of Claude, in one app" that works with files and apps: https://claude.ai/download. Claude is a comparable for Relay Console when buyers think about desktop AI, connectors/MCP, and autonomous computer-use agents.

## Jobs/use cases

- Use Claude from desktop/mobile clients; the download page lists macOS, Windows, Windows Arm64, ChromeOS, iOS, and Android options and says Linux is not available: https://claude.ai/download.
- Connect Claude to tools and data through remote MCP custom connectors. Claude Help says custom connectors using remote MCP are available on Claude, Cowork, and Claude Desktop for Free, Pro, Max, Team, and Enterprise users, with Free limited to one custom connector, and that the feature is beta: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp.
- Build API agents with computer use. Anthropic Platform docs say Claude can interact with computer environments through a computer-use tool that provides screenshot capabilities and mouse/keyboard control for autonomous desktop interaction; the docs mark computer use as beta and require a beta header: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool.
- Use Claude products in team/enterprise contexts; the Anthropic pricing/product navigation references Claude plans and enterprise/contact-sales paths, but this run did not capture stable plan-price details: https://www.anthropic.com/pricing.

## Feature overlap with Relay Console

- Desktop agent surface: overlaps with Relay Console's macOS local app, but Claude Desktop is the assistant client while Relay Console code manages runtime/workspace/provider-action operations around Hermes/OpenClaw adapters.
- MCP/connectors: Claude remote MCP custom connectors overlap with Relay Console's marketplace runtime tool bridge and provider-wrapper surface concepts.
- Computer control/autonomous agents: Claude computer use overlaps with Relay Console's runtime action/autonomous-agent operations at a conceptual level; Relay Console's current Swift code explicitly excludes Mission Control host-control, local app process control, and local app command execution from scope in `RuntimeActionService.hostControlExclusionReason`.
- Team/enterprise knowledge and app access: comparable to Relay Console's provider connection/permission/audit services, though exact Claude enterprise governance details need deeper sourcing.

## Where it differs

- Claude is primarily an AI assistant/model platform; Relay Console local code is an operations console around local runtime harnesses, provider action brokers, approvals, artifacts, and evidence/test harnesses.
- Claude computer use is documented as a developer/API tool in beta; Relay Console code this run shows a safety stance that blocks or dry-runs controlled writes/actions pending permission/release gates.
- Claude MCP custom connectors expose external tool/data context to Claude; Relay Console's code compiles policy-scoped marketplace wrapper tools, runtime mounts, and approval-gated provider actions for local runtimes.

## Pricing/packaging if relevant

Claude remote MCP custom connectors are documented as available on Free, Pro, Max, Team, and Enterprise plans, with Free users limited to one connector: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp. Exact current Claude desktop/consumer/team prices were not captured reliably from official pages in this run.

## Distribution/ecosystem

Claude distributes desktop/mobile apps via the download page and has an API/platform docs ecosystem, MCP custom connectors, and computer-use tooling: https://claude.ai/download, https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp, and https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool.

## Evidence/source links

- Claude download page: https://claude.ai/download
- Claude remote MCP custom connectors Help page: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Anthropic computer-use tool docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- Anthropic pricing page checked: https://www.anthropic.com/pricing

## Open questions

- Which Claude Desktop capabilities are local desktop-app features versus cloud-account/API features, and what should be compared directly with Relay Console's local runtime services?
- What are Claude Team/Enterprise admin/audit/connector-approval controls, and are they comparable to Relay Console's provider action approval inbox/audit model?
- Does Relay Console need to state explicitly that it is not trying to be an OS computer-use controller, given Claude's public computer-use positioning?

## Last updated

2026-06-28
