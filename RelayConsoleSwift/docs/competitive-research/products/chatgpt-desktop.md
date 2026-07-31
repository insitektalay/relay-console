# ChatGPT desktop / Projects / Tasks

## Summary

ChatGPT is a general AI assistant with desktop, workspace, and lightweight autonomous scheduling surfaces. The desktop product page says users can chat about code, email, screenshots, files, and anything on screen; it offers macOS and Windows downloads and says ChatGPT can write edits directly into an IDE on macOS: https://chatgpt.com/features/desktop/. ChatGPT is a comparable when users/investors think Relay Console is "an AI app for work" or an agent/workspace layer, but Relay Console local code is more specifically a macOS runtime/provider-action operations console.

## Jobs/use cases

- Use ChatGPT from the desktop against screen/files/app context; the desktop page describes chatting about screenshots, files, code, email, and screen contents: https://chatgpt.com/features/desktop/.
- Organize long-running work in Projects. OpenAI Help says Projects are smart workspaces that keep chats, reference files, and custom instructions together for repeated/evolving work: https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt.
- Schedule one-off or recurring Tasks. OpenAI Help says scheduled tasks can automate work in ChatGPT, notify on changes, and have plan-specific active-task limits: https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt.
- Use ChatGPT plans from Free through Business/Enterprise; the pricing page lists Free, Go, Plus, Pro, Business, and Enterprise plan categories: https://chatgpt.com/pricing/.

## Feature overlap with Relay Console

- Desktop AI surface: overlaps with Relay Console's macOS app/executable in `Package.swift`, but ChatGPT is a hosted AI assistant/client rather than a local runtime ops console.
- Project/workspace context: ChatGPT Projects overlap with Relay Console's local workspace/artifacts/chat concepts, but ChatGPT Projects are assistant workspaces rather than runtime-mounted provider/action harnesses.
- Scheduled work: ChatGPT Tasks overlap with Relay Console's cron/autonomous-agent dimension; Relay Console code specifically includes `HermesCronSchedulerService` and artifact integration around launchd-backed Hermes profile scheduling.
- App/provider actions: ChatGPT Tasks Help says Tasks can use apps like Gmail when available for the account/workspace; Relay Console code has explicit provider connection, policy compiler, approval inbox, broker, audit, and Gmail/X/LinkedIn adapter services.

## Where it differs

- ChatGPT is a broad cloud AI assistant with desktop clients, projects, tasks, and app integrations; Relay Console code wires local services for runtime adapters, harness installs, marketplace runtime mounts, provider-action approvals, runtime workspace, artifacts, audit, and evidence harnesses.
- ChatGPT's scheduling/productivity surfaces are plan/account features inside ChatGPT; Relay Console's cron path is explicitly tied to Hermes runtime profiles and local scheduler/service state.
- Relay Console has code-level safety/evidence dimensions (`MarketplaceProviderActionApprovalInboxService`, `AuditSecurityService`, event replay, visual evidence, accessibility capture) that are not presented as the core value proposition on the checked ChatGPT pages.

## Pricing/packaging if relevant

The ChatGPT pricing page lists Free, Go, Plus, Pro, Business, and Enterprise plans: https://chatgpt.com/pricing/. The fetched text did not expose stable numeric USD prices in this environment, so exact pricing is left open.

## Distribution/ecosystem

ChatGPT is distributed through web and desktop clients; the desktop page lists downloads for macOS and Windows: https://chatgpt.com/features/desktop/. Its ecosystem includes custom GPTs/apps and connected apps referenced from ChatGPT product/help pages, but this run did not verify developer/admin governance details.

## Evidence/source links

- ChatGPT desktop page: https://chatgpt.com/features/desktop/
- ChatGPT pricing: https://chatgpt.com/pricing/
- Scheduled Tasks in ChatGPT: https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt
- Projects in ChatGPT: https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt

## Open questions

- What current public source best documents ChatGPT app connectors/custom GPT governance, admin approvals, auditability, and human-in-the-loop controls?
- Should Relay Console position against ChatGPT Tasks as "local runtime cron + approvals + artifacts" rather than general assistant reminders/scheduling?
- Is there a buyer-facing story needed for importing/exporting Relay Console artifacts into ChatGPT Projects?

## Last updated

2026-06-28
