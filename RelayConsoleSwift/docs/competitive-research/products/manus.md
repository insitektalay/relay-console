# Manus

## Summary

Manus positions itself as an AI action engine that "goes beyond answers to execute tasks, automate workflows, and extend your human reach"; its public site lists web app, AI design/slides/image/music tools, Manus Browser Operator, Wide Research, Mail, Slack integration, mobile/desktop app downloads, API, Team plan, SSO, and business pages: https://manus.im/. Its pricing page describes Manus pricing plans for individuals, teams, and enterprises, although detailed plan/price text was not reliably extractable from the rendered page in this environment: https://manus.im/pricing.

## Jobs/use cases

- Delegate multi-step work to a hosted action agent and receive generated outputs such as reports, files, websites, dashboards, slides, and other artifacts.
- Use Manus through web, mobile/desktop download surfaces, or messaging-app integrations.
- Run research and file-generation workflows; the Telegram help page says Manus Agents can run complex multi-step tasks like Wide Research or file generation and return structured reports/PDFs/final deliverables: http://help.manus.im/en/articles/14033617-how-do-i-set-up-and-use-manus-agents-in-telegram.md.
- Team/organization rollout: Manus Team is described as a multi-seat subscription for organizations, with each user getting their own Manus account and full access to AI features: http://help.manus.im/en/articles/11711750-what-is-manus-team-plan.md.

## Feature overlap with Relay Console

- **Autonomous/action agent:** Manus is one of the closest public comparables for "delegate a job, get work artifacts back." Relay Console code instead grounds an operator console around local runtimes, dispatch, provider-action tooling, runtime actions/recovery, artifacts, and evidence.
- **Messaging-channel bridge:** Manus Agents connect Manus to Telegram and Slack; Relay Console has provider/action services and Hermes runtime integration, but Telegram/Slack/WhatsApp channel bridges were not verified in the inspected Swift code this run.
- **Artifacts/work outputs:** Manus emphasizes deliverables (reports, PDFs, generated files); Relay Console has an `ArtifactLibraryService` plus evidence/test harnesses in local code.
- **Team/multi-user isolation:** Manus Team allocates independent workspaces per member: http://help.manus.im/en/articles/11711793-is-the-environment-configured-separately-for-team-members.md. Relay Console's code shows local profiles/agents/runtime harness operations rather than a hosted multi-seat SaaS tenant.

## Where it differs

- Manus is primarily a hosted AI action product with web/app/messaging surfaces; Relay Console is a macOS Swift application with local services, runtime harness installation, Hermes/OpenClaw adapters, provider action approvals, and local evidence/replay harnesses.
- Manus' messaging-agent docs say only one active messaging Agent connection is supported at a time per workspace: http://help.manus.im/en/articles/14178640-can-i-connect-multiple-messaging-agents-at-once.md. Relay Console is not yet verified as a messaging-agent product; its current overlap is stronger around local runtime/provider-action operations.
- Relay Console's `RuntimeActionService.hostControlExclusionReason` explicitly excludes Mission Control host-control, local app process control, and local app command execution from Swift scope; Manus appears to be broader as a hosted browser/action agent, but exact local OS-control scope needs more source verification.

## Pricing/packaging if relevant

- Manus has a public pricing page for individual/team/enterprise plans: https://manus.im/pricing.
- Manus help says credits measure system resource usage and each interaction consumes credits depending on task complexity: http://help.manus.im/en/articles/11813771-how-to-use-manus.md.
- Open question: capture exact current plan names, monthly prices, included credits, and enterprise features from an accessible source or screenshots/API-backed page.

## Distribution/ecosystem

- Public site lists web app, mobile app, desktop app, browser/operator, Mail, Slack integration, API, Team plan, SSO, and business offerings: https://manus.im/.
- Telegram integration: no technical knowledge/API tokens required; users start from the Agents tab, scan a QR code or continue in Telegram, and start a bot: http://help.manus.im/en/articles/14033617-how-do-i-set-up-and-use-manus-agents-in-telegram.md.
- Slack integration: users can mention `@Manus` in channels where added or DM the bot; account linking attributes tasks to the Manus user and manages data in the personal workspace: http://help.manus.im/en/articles/14432468-how-do-i-set-up-connect-and-use-manus-agents-in-slack.md.

## Evidence/source links

- Manus homepage: https://manus.im/
- Manus pricing: https://manus.im/pricing
- Manus help center / llms index: https://help.manus.im/llms.txt
- How to use Manus / credits: http://help.manus.im/en/articles/11813771-how-to-use-manus.md
- Manus Team plan: http://help.manus.im/en/articles/11711750-what-is-manus-team-plan.md
- Team workspace isolation: http://help.manus.im/en/articles/11711793-is-the-environment-configured-separately-for-team-members.md
- Telegram integration: http://help.manus.im/en/articles/14033617-how-do-i-set-up-and-use-manus-agents-in-telegram.md
- Slack integration: http://help.manus.im/en/articles/14432468-how-do-i-set-up-connect-and-use-manus-agents-in-slack.md
- Multiple messaging-agent limit: http://help.manus.im/en/articles/14178640-can-i-connect-multiple-messaging-agents-at-once.md
- Relay Console local evidence: `Package.swift`; `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/RuntimeActionService.swift`; `Sources/RelayConsoleCore/Models.swift`.

## Open questions

- What exact current Manus plan prices/credits/enterprise controls are visible to users, and are they region/account dependent?
- What approvals, audit logs, and task replay/evidence surfaces does Manus expose to team admins?
- How much of Manus Browser Operator/local desktop capability overlaps with Relay Console's future runtime-control ambitions versus areas explicitly out of current Swift scope?
- The Manus homepage rendered in this environment says "Manus is now part of Meta" and copyright "© 2026 Meta"; confirm whether this is official corporate positioning, a branding change, or environment-specific content before using it in investor-facing materials.

## Last updated

2026-06-28
