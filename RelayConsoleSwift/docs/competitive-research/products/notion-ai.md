# Notion AI / Notion Agents

## Summary

Notion is a collaborative workspace/documentation/project-management product increasingly positioned around AI for capture, search, and automation. Its AI page describes "one system of record, for teams and agents," answers with citations, and collaborative AI that turns context into action: https://www.notion.com/product/ai. Notion is a key comparable when users/investors view Relay Console as a workspace for agents, artifacts, knowledge, approvals, or operational records.

## Jobs/use cases

- Maintain a team knowledge/workspace system of record and use AI to search, cite, summarize, and act on that context: https://www.notion.com/product/ai.
- Use Notion Agent for complex, multi-step tasks using context from Notion, connected apps, and the web; Notion's AI page says agents can handle repetitive tasks autonomously: https://www.notion.com/product/ai.
- Use enterprise search across connected apps such as Slack and GitHub, according to Notion AI/pricing page text checked this run: https://www.notion.com/pricing.
- Build integrations/connections through the Notion API; developer docs say connections can automate workflows, read/create/update workspace content, use OAuth/internal tokens, define capabilities/content access, and use webhooks: https://developers.notion.com/.

## Feature overlap with Relay Console

- Workspace/artifacts: overlaps with Relay Console's local data, chat, artifacts, applications, insights, and Agent Ops sections in local code.
- Agent work context: Notion AI/Agents turn workspace context into actions; Relay Console code mounts provider wrapper tools into runtime contexts and tracks artifacts/action capability status.
- Provider integrations: Notion connections/API overlap with Relay Console's provider connection and marketplace install concepts, though Notion is a SaaS workspace API rather than a local runtime bridge.
- Enterprise safety: Notion cites security controls such as no model training on customer data, SOC 2 Type 2/ISO 27001, GDPR/CCPA mapping, encryption, and enterprise zero-retention claims on its AI/pricing pages: https://www.notion.com/product/ai and https://www.notion.com/pricing.

## Where it differs

- Notion is a cloud collaborative workspace and knowledge base; Relay Console local code is a native macOS agent-runtime operations console.
- Notion's agent story is embedded in workspace content, connected apps, and web research; Relay Console code directly manages Hermes/OpenClaw runtime adapters, harness install, cron scheduling, runtime dispatch/recovery, and local marketplace tool bridges.
- Notion's source-of-truth is document/database content; Relay Console's source-of-truth includes runtime events, action approvals, audit/evidence artifacts, and local agent profile/runtime state.

## Pricing/packaging if relevant

Notion's pricing page lists Free, Plus, Business, and Enterprise plans and describes Notion Agent/AI-related features in the comparison table: https://www.notion.com/pricing. The captured pricing text was localized to GBP during this run, so exact USD seat prices are left as an open question for a later source check.

## Distribution/ecosystem

Notion is distributed as web/desktop/mobile workspace software. Developer docs expose Notion connections/integrations, REST API access, OAuth/public connections, internal connections, personal access tokens, Admin API, webhooks, marketplace listing, Agent APIs, and Notion MCP: https://developers.notion.com/.

## Evidence/source links

- Notion AI product page: https://www.notion.com/product/ai
- Notion pricing page: https://www.notion.com/pricing
- Notion developer documentation: https://developers.notion.com/

## Open questions

- What exact Notion Agent credit/pricing mechanics and enterprise controls should be compared against Relay Console's local approval/audit model?
- Does Relay Console need a Notion integration story for artifacts, knowledge base synchronization, or agent runbooks?
- How should Relay Console position local-first agent operations against Notion's cloud workspace system-of-record and enterprise search narrative?

## Last updated

2026-06-28
