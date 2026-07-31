# Devin

## Summary

Devin is Cognition's AI software engineer product. The public homepage title describes it as “The AI Software Engineer”: https://devin.ai/. Devin is a strong vertical comparable to Relay Console for autonomous agent sessions, CLI/desktop/cloud handoff, codebase knowledge, Slack/GitHub-style workflows, API-driven sessions, scheduled automations, MCP, security, and enterprise audit/governance.

## Jobs/use cases

- Run Devin sessions for software engineering tasks; the Devin API docs describe organization-scoped sessions, messages, attachments, schedules, metrics, insights, and tags: https://docs.devin.ai/api-reference/overview.md and https://docs.devin.ai/llms.txt.
- Programmatically integrate Devin through REST APIs using service users with role-based access control; v3 has organization and enterprise API scopes: https://docs.devin.ai/api-reference/overview.md.
- Attribute sessions to users with `create_as_user_id`, with RBAC, audit trails, and centralized key management benefits over older personal-key flows: https://docs.devin.ai/api-reference/overview.md.
- Use integrations and team workflows including Slack, Linear, MCP, Devin CLI, Devin Desktop, DeepWiki, scheduled sessions, automations, auto-triage, session insights, knowledge onboarding, and environment configuration; these are listed in the docs index: https://docs.devin.ai/llms.txt.
- Use scheduled sessions and event-driven workflows; docs index lists Scheduled Sessions and Automations product guides: https://docs.devin.ai/llms.txt.

## Feature overlap with Relay Console

- Autonomous session operations overlap with Relay Console's runtime dashboard/actions/recovery, dispatch, harness install, Agent Ops, and Hermes/OpenClaw adapter model.
- Scheduled sessions/automations overlap with Relay Console's `HermesCronSchedulerService` and artifact integration.
- MCP/CLI/desktop/cloud handoff overlaps with Relay Console's marketplace runtime tool bridge, wrapper tools, runtime mounts, and local runtime harness operations.
- API service users, RBAC, audit trails, and centralized key management are useful comparables for Relay Console's permission policy, audit security, provider-action approval inbox, broker, and Keychain-backed secret patterns.
- Session insights and metrics are comparable to Relay Console's evidence/replay/test harness posture, although Devin is code-session focused.

## Where it differs

- Devin is a software-engineering vertical agent; Relay Console local code is broader agent runtime/provider-action operations for a macOS Swift console rather than a dedicated coding agent.
- Devin is packaged as hosted cloud sessions plus CLI/Desktop/integrations; Relay Console's inspected code is local macOS app infrastructure that registers Hermes/OpenClaw runtimes and mounts provider tools to agents.
- Devin docs include explicit API and enterprise-account surfaces; Relay Console public API/packaging was not verified from inspected local files.

## Pricing/packaging if relevant

Devin self-serve docs list Free, Pro at $20/month, Max at $200/month, and Teams with an $80/month minimum and unlimited members. Pro includes daily/weekly usage quota covering Devin sessions, Devin CLI, and Devin Desktop, plus on-demand credits and Slack, Linear, and MCP integrations; Max increases weekly quota; Teams shares on-demand credits and uses full/flex seats: https://docs.devin.ai/admin/billing/self-serve.md. The same docs say authoritative pricing is the Devin pricing page: https://devin.ai/pricing.

## Distribution/ecosystem

Devin distributes through web app, GitHub/Slack integrations, API, CLI, and Desktop/Cascade/Windsurf-related surfaces according to docs pages/index entries: https://docs.devin.ai/admin/security.md and https://docs.devin.ai/llms.txt. Security docs say Cognition processes data based on whether customers access Devin through web app, GitHub integration, or Slack integration, and admins installing GitHub/Slack integrations can review/manage permissions: https://docs.devin.ai/admin/security.md.

## Evidence/source links

- Devin homepage: https://devin.ai/
- Devin pricing page: https://devin.ai/pricing
- Devin docs index: https://docs.devin.ai/llms.txt
- Self-serve plans: https://docs.devin.ai/admin/billing/self-serve.md
- Security at Cognition: https://docs.devin.ai/admin/security.md
- API overview: https://docs.devin.ai/api-reference/overview.md

## Open questions

- What exact Devin Desktop capabilities should be compared against Relay Console's local macOS operations console, given Devin Desktop docs are intertwined with Windsurf/Cascade surfaces?
- How do Devin's scheduled sessions and automations enforce human approvals, secrets boundaries, and repository/deployment safety in practice?
- Should Relay Console frame Devin/Cursor/Replit as coding-agent verticals to integrate with, rather than direct competitors, while emphasizing broader provider-action operations and evidence?

## Last updated

2026-06-28
