# Lindy

## Summary

Lindy positions itself as an AI executive assistant that runs inbox, meetings, calendar, and follow-up work autonomously. Its docs say Lindy gives users “10+ hours back every week,” handles email triage/drafting, meeting prep, scheduling, notes, and follow-ups, and can be delegated to through iMessage, SMS, Slack, email, or the web app: https://docs.lindy.ai/index.md. Lindy is a strong comparable for Relay Console when stakeholders think about practical, non-developer AI agents connected to everyday work apps.

## Jobs/use cases

- Personal/executive-assistant workflows across inbox, calendar, meetings, and follow-ups: https://docs.lindy.ai/index.md.
- Custom agents composed of workflows, steps, integrations, and memory that run jobs automatically: https://docs.lindy.ai/fundamentals/lindy-101/introduction.md.
- Event, chat, and schedule-triggered automations; triggers can include recurring times, new chats, or events such as receiving email: https://docs.lindy.ai/fundamentals/lindy-101/triggers.md.
- Integration actions such as sending email, creating calendar events, updating spreadsheets, and sending Slack messages: https://docs.lindy.ai/fundamentals/lindy-101/actions.md.
- Web/computer use for processes that cannot be automated with APIs/integrations; Lindy docs describe a Start Computer action, persistent computer session data, dedicated computers per agent, and incognito computers: https://docs.lindy.ai/fundamentals/lindy-101/computer-use.md.
- Offline evals for agents to assess historical tasks and prevent regressions when an agent is edited: https://docs.lindy.ai/fundamentals/lindy-101/evals.md.

## Feature overlap with Relay Console

- Autonomous agents and scheduling overlap with Relay Console code evidence for `HermesCronSchedulerService`, runtime workspace/dashboard services, dispatch, and agent operations.
- App/integration actions overlap with Relay Console provider connections, provider action broker, marketplace policy compiler, wrapper tools, approval inbox, and adapters for providers such as Gmail, Google Docs, Notion, X, LinkedIn, Sentry, PostHog, TelemetryDeck, and others observed in `RelayConsoleServices.swift`.
- Computer-use adjacency overlaps conceptually with runtime operations, but Relay Console's inspected `RuntimeActionService.hostControlExclusionReason` explicitly says Mission Control host-control, local app process control, and local app command execution are excluded from Swift scope.
- Lindy's offline evals are a useful comparable to Relay Console's local event replay, visual evidence, accessibility capture, visual snapshot, component baseline, and service harness targets in `Package.swift` and `Tests/`.

## Where it differs

- Lindy is a hosted assistant/agent product focused on personal productivity and executive-assistant workflows; Relay Console local code points to a macOS operations console for multiple runtimes, provider-action policy/approval, marketplace runtime mounts, artifacts, and evidence.
- Lindy exposes end-user delegation channels such as iMessage/SMS/Slack/email/web: https://docs.lindy.ai/index.md. Relay Console's inspected local code did not verify first-class SMS/iMessage/Slack channel operation.
- Lindy computer use can operate web apps when APIs/integrations are insufficient: https://docs.lindy.ai/fundamentals/lindy-101/computer-use.md. Relay Console currently records local host/app command execution as out of Swift scope in inspected code.

## Pricing/packaging if relevant

Lindy docs list Plus at $49.99/mo, Pro at $99.99/mo, Max at $199.99/mo, and Enterprise as contact-us, with a 7-day free trial. Pro adds computer use, model selection, and 1:1 onboarding; Enterprise mentions custom usage/inboxes for teams with compliance needs: https://docs.lindy.ai/pricing.md.

## Distribution/ecosystem

Lindy is distributed as a web/chat assistant with delegation through iMessage, SMS, Slack, email, or web app per the docs: https://docs.lindy.ai/index.md. The docs describe hundreds of integrations including Gmail, Google Calendar, Slack, Notion, HubSpot, Salesforce, and more: https://docs.lindy.ai/pricing.md.

## Evidence/source links

- Lindy docs landing page: https://docs.lindy.ai/index.md
- Lindy pricing docs: https://docs.lindy.ai/pricing.md
- Custom agents introduction: https://docs.lindy.ai/fundamentals/lindy-101/introduction.md
- Triggers: https://docs.lindy.ai/fundamentals/lindy-101/triggers.md
- Actions: https://docs.lindy.ai/fundamentals/lindy-101/actions.md
- Computer use: https://docs.lindy.ai/fundamentals/lindy-101/computer-use.md
- Evals: https://docs.lindy.ai/fundamentals/lindy-101/evals.md

## Open questions

- What public source best documents Lindy's approval, audit, human-review, and enterprise governance model for agent actions?
- Should Relay Console position against Lindy as local runtime/provider-action ops versus hosted personal assistant, or prioritize integration/interop with Lindy-style executive workflows?
- How much of Lindy's computer-use model is cloud browser/session control versus local desktop control, and what are the operational safety controls?

## Last updated

2026-06-28
