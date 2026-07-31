# Research log

## 2026-06-27

### Products researched

- Slack — official feature, pricing, and help pages.
- Telegram — official FAQ, apps/open-source clients page, and Premium page.
- Hermes Desktop Agent — official Hermes Agent docs landing page.

### Files changed

- Updated `README.md` with current maintenance rules and local Relay Console grounding.
- Created `index.md` with the initial product list and rotation backlog.
- Created `products/slack.md`.
- Created `products/telegram.md`.
- Created `products/hermes-desktop-agent.md`.
- Created `positioning-matrix.md`.
- Created this `research-log.md`.

### Local Relay Console codebase observations

- No top-level `README.md` was present; grounding came from `Package.swift`, core/app Swift sources, tests, and agent-loop docs.
- `Package.swift` defines a macOS 14+ `Relay Console` executable, core/app libraries, a marketplace tool bridge executable, and numerous executable test/harness targets including event replay, component baseline, visual evidence, accessibility capture, and app visual snapshot harnesses.
- `Sources/RelayConsoleApp/AppViewModel.swift` exposes navigation sections for chats, agents, Agent Ops HQ, artifacts, applications, approvals, insights, and settings.
- `Sources/RelayConsoleCore/RelayConsoleServices.swift` wires local services for chat/data, applications, provider connections, marketplace installs, provider policies, approval inbox, provider action broker, wrapper tools, runtime mounts/tool bridge, runtime workspace, Hermes cron scheduler, artifacts, controlled actions, runtime dashboard/actions/recovery, secrets, registry, dispatch, harness install, provisioning, and teardown.
- `RelayConsoleServices` registers `HermesAgentAdapter` and `OpenClawAdapter`, making Hermes a direct runtime integration as well as a competitive comparable.
- `RuntimeActionService` currently blocks or dry-runs destructive runtime actions, controlled file writes, controlled provider writes, and local app command execution pending permission/approval/audit/release-scope gates.
- Gmail marketplace loop docs state Relay Marketplace apps use user-owned credentials stored via local Keychain references and expose only policy-scoped wrapper tools to agents.

### Notable new facts from sources

- Slack's public feature page now groups collaboration, project-management, platform, and intelligence capabilities, including channels, Slack Connect, huddles, canvases, lists, apps/integrations, Workflow Builder, Slack AI, Slackbot, Agentforce, enterprise search, and security features: https://slack.com/features.
- Slack's pricing page lists a Free plan with 90 days of message history and up to ten apps: https://slack.com/pricing.
- Telegram's FAQ describes Telegram as a cloud-based messaging app with speed/security focus, device sync, more than 1 billion active users, and groups/channels/bots/calls/secret chats; it also says non-developers do not have an out-of-the-box way to create working bots: https://telegram.org/faq.
- Telegram's apps page says Telegram apps are open source and support reproducible builds: https://telegram.org/apps.
- Hermes Agent docs describe a self-improving agent with learning loop, skills, memory, scheduled automations, delegates/subagents, execute_code, MCP integration, messaging platforms, voice mode, and security docs topics: https://hermes-agent.nousresearch.com/docs.

### Open questions

- Slack: what exact app-admin approval/governance controls should be compared with Relay Console's provider action approval inbox and audit services?
- Telegram: should Relay Console treat Telegram as a first-class control/notification channel or only as a comparable messaging surface through Hermes?
- Hermes: what claims belong to Relay Console as the console versus Hermes as the runtime, and is there a current Hermes pricing/packaging page to cite separately?

## 2026-06-27 — Discord and Microsoft Teams pass

### Products researched

- Discord — official Developer Platform documentation and Nitro product page.
- Microsoft Teams — Microsoft Learn Teams Developer Platform overview. Microsoft product/pricing pages were attempted but returned HTTP 403 from this environment.

### Files changed

- Added `products/discord.md`.
- Added `products/microsoft-teams.md`.
- Updated `index.md` to include Discord and Microsoft Teams and expanded local Relay Console grounding notes.
- Updated `positioning-matrix.md` with Discord and Microsoft Teams columns.
- Updated `README.md` to note the adjacent products now covered.
- Appended this `research-log.md` entry.

### Local Relay Console codebase observations

- `Package.swift` still grounds Relay Console as a macOS 14+ Swift package with a `Relay Console` executable plus runtime/evidence/test harness executables.
- `agent-loops/agent-loop-clawchat-web-to-relayconsole-swift-prd/master-prd.md` says the Swift target is local-first by default, owns local product services/persistence, and uses same-machine Hermes/OpenClaw harnesses.
- `Sources/RelayConsoleCore/RelayConsoleServices.swift` wires local data/chat/agent/app/provider/runtime/security/artifact services and registers Hermes and OpenClaw adapters.
- `Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift` shows runtime-mounted marketplace apps/tool surfaces are scoped by active install, agent, runtime format, connection/policy information, diagnostics, and redaction status.
- `Sources/RelayConsoleCore/HermesCronSchedulerService.swift` manages a launchd-backed Hermes profile background scheduler, reinforcing the cron/autonomous-agent dimension.

### Notable new facts from sources

- Discord's developer docs describe the platform as supporting bots, integrations, rich presence, voice chat, and companion apps: https://discord.com/developers/docs/intro.
- Discord Nitro is packaged as end-user communication perks such as custom emojis, animated avatars, larger file uploads, and HD screensharing: https://discord.com/nitro.
- Microsoft Teams developer docs state Teams is evolving from a communication hub into a collaborative and AI app platform where developers can build agents and apps directly into Teams: https://learn.microsoft.com/en-us/microsoftteams/platform/overview.
- The Teams developer overview says agents in Teams can be deployed across desktop, web, and mobile and integrated to increase engagement, surface information/tools, automate processes, and extend/scale agents: https://learn.microsoft.com/en-us/microsoftteams/platform/overview.

### Source access notes

- Microsoft commercial product/pricing URLs returned HTTP 403 in this environment: `https://www.microsoft.com/en-us/microsoft-teams/group-chat-software` and `https://www.microsoft.com/en-us/microsoft-teams/compare-microsoft-teams-options`. Pricing/packaging details are recorded as open questions rather than asserted.
- OpenAI/ChatGPT help pages for release notes, Projects, Tasks, and desktop app also returned HTTP 403 during exploratory fetching; ChatGPT was not added this run because reliable current source content could not be verified.

### Open questions

- Discord: should Relay Console treat Discord as a future first-class notification/control channel through Hermes or only as a comparable chat/bot ecosystem?
- Discord: what are the current production app-review, permission, and monetization rules relative to Relay Console's provider action approval/audit model?
- Microsoft Teams: what accessible current source should be used for Teams pricing/packaging and tenant app/agent approval governance?
- Microsoft Teams: does Relay Console need an explicit Microsoft 365/Teams integration/channel story for enterprise buyers?

## 2026-06-28 — Raycast, Zapier Agents, and Notion AI pass

### Products researched

- Raycast AI — official AI, Pro/pricing, and developer documentation pages.
- Zapier Agents / Zapier AI — official AI and Agents product pages; pricing page checked but plan detail text was not reliably captured.
- Notion AI / Notion Agents — official AI, pricing, and developer documentation pages.

### Files changed

- Added `products/raycast-ai.md`.
- Added `products/zapier-agents.md`.
- Added `products/notion-ai.md`.
- Updated `index.md` with the three new products, 2026-06-28 local codebase grounding, and rotation backlog.
- Updated `positioning-matrix.md` with Raycast AI, Zapier Agents/AI, and Notion AI/Agents columns.
- Updated `README.md` last-maintained date and adjacent-products list.
- Appended this `research-log.md` entry.

### Local Relay Console codebase observations

- `Package.swift` still grounds Relay Console as a macOS 14+ Swift package with a `Relay Console` executable, `RelayMarketplaceToolBridge`, and extensive service/model/shell/evidence/capture/accessibility test and harness targets.
- `Sources/RelayConsoleCore/RelayConsoleServices.swift` wires local data, chat, agent organization/work/ops, applications, provider connections, marketplace installs/policies/approvals/broker/wrapper tools/runtime mounts, runtime workspace/dashboard/actions/recovery, Hermes cron scheduling, artifacts, secrets, dispatch, harness install, provisioning, and teardown services.
- `RelayConsoleServices` registers `HermesAgentAdapter` and `OpenClawAdapter`, starts a marketplace runtime broker server when configured, and refreshes installed harnesses on launch by default.
- `Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift` filters active installs by assigned agent and runtime format, compiles wrapper tool surfaces, and emits tool counts/redaction status.
- `Sources/RelayConsoleCore/RuntimeActionService.swift` records dry-runs and blocks destructive actions; its host-control exclusion reason says Mission Control host-control, local app process control, and local app command execution are excluded from Swift scope, which is important when comparing against OS-level products like Raycast.

### Notable new facts from sources

- Raycast AI describes itself as "AI that works with your OS," with AI Chat, Quick AI, web search with references, attachments/screen context, AI Extensions, and AI Commands; Raycast Pro starts at $8/month and supports multiple model providers: https://www.raycast.com/ai and https://www.raycast.com/pro.
- Raycast developer docs cover creating, publishing, debugging, reviewing, public/private, and AI extensions: https://developers.raycast.com/.
- Zapier's AI page describes no-code automation across 9,000+ apps, with Zaps, Tables, Forms, Canvas, Agents, Chatbots, app integrations, AI automation, security, Zapier MCP, SDK beta, and Functions beta: https://zapier.com/ai.
- Zapier Agents says users can create AI teammates with company knowledge that work across 9,000+ apps "on command and while you sleep": https://zapier.com/agents.
- Notion AI describes a system of record for teams and agents, answers with citations, collaborative AI automation, Notion Agent, connected-app/web context, and security claims including no model training on customer data and SOC 2 Type 2/ISO 27001: https://www.notion.com/product/ai.
- Notion developer docs describe connections/integrations, REST API access, OAuth/internal connections, personal access tokens, content access/capabilities, webhooks, marketplace listing, Agent APIs, and Notion MCP: https://developers.notion.com/.

### Source access notes

- Network fetches for the official Raycast, Zapier, and Notion pages succeeded with HTTP 200.
- Zapier pricing returned HTTP 200 but the captured text did not include stable plan details; pricing is logged as an open question.
- Notion pricing was accessible, but captured plan prices were localized to GBP, so exact USD seat pricing was not asserted.

### Open questions

- Raycast: does Relay Console need a command-palette/desktop-launcher UX story, especially given Relay Console's current Swift scope explicitly excludes host-control/local app command execution?
- Zapier: what are the current public governance, audit, human-in-the-loop, and pricing details for Zapier Agents/MCP/Functions?
- Notion: should Relay Console prioritize a Notion integration for artifacts/knowledge/runbooks, or position against Notion primarily as local runtime ops versus cloud workspace system-of-record?

## 2026-06-28 — ChatGPT, Claude, and Cursor pass

### Products researched

- ChatGPT desktop / Projects / Tasks — official ChatGPT desktop and pricing pages plus OpenAI Help pages for Projects and Scheduled Tasks.
- Claude desktop / computer use / MCP — Claude download page, Anthropic computer-use docs, Claude remote MCP custom connector Help page, and Anthropic pricing page check.
- Cursor — Cursor homepage, pricing page, and docs landing page.

### Files changed

- Added `products/chatgpt-desktop.md`.
- Added `products/claude-desktop.md`.
- Added `products/cursor.md`.
- Updated `index.md` with the three new products and refreshed the rotation backlog.
- Updated `positioning-matrix.md` to add ChatGPT, Claude, and Cursor while preserving Discord/Teams and prior products.
- Updated `README.md` adjacent-products list.
- Appended this `research-log.md` entry.

### Local Relay Console codebase observations

- Re-inspected `Package.swift`: Relay Console remains grounded as a macOS 14+ Swift package with `Relay Console`, `RelayMarketplaceToolBridge`, and numerous service/model/shell/evidence/capture/accessibility test and harness executables.
- Re-inspected `Sources/RelayConsoleCore/RelayConsoleServices.swift`: it wires local data/chat/agent/app/provider/runtime/security/artifact services, provider connection/action broker/approval/runtime mount services, Hermes cron scheduling, runtime workspace/actions/recovery, harness install, provisioning/teardown, and registers Hermes/OpenClaw adapters.
- These local observations support comparing ChatGPT/Claude/Cursor as adjacent assistant/computer-use/coding-agent products while keeping Relay Console positioned around local runtime operations, provider-action approval, cron, artifacts, and evidence.

### Notable new facts from sources

- ChatGPT desktop says users can chat about code, email, screenshots, files, and anything on screen, with macOS and Windows downloads; it also says ChatGPT can write edits directly into an IDE on macOS: https://chatgpt.com/features/desktop/.
- OpenAI Help says Projects are smart workspaces that group chats, uploaded reference files, and custom instructions for long-running/repeated work: https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt.
- OpenAI Help says Scheduled Tasks support one-off/recurring tasks and plan-specific active-task limits; Tasks can use apps like Gmail when available for the account/workspace: https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt.
- Claude download says desktop gives access to Claude in one app, works with files and apps, and offers macOS/Windows/ChromeOS downloads while Linux is not available: https://claude.ai/download.
- Claude Help says remote MCP custom connectors are available on Claude, Cowork, and Claude Desktop for Free/Pro/Max/Team/Enterprise users, Free is limited to one connector, and the feature is beta: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp.
- Anthropic computer-use docs say Claude can interact with computer environments through screenshot capabilities plus mouse/keyboard control for autonomous desktop interaction; the docs mark computer use as beta and require a beta header: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool.
- Cursor homepage positions Cursor as an AI coding agent with Desktop and CLI surfaces: https://cursor.com/.
- Cursor pricing lists Hobby Free, Individual Pro at $20/month, Teams at $40/user/month, plus capabilities including MCPs/skills/hooks, cloud agents, Bugbot, team marketplace, usage analytics, team-wide privacy mode, and SAML/OIDC SSO: https://cursor.com/pricing.

### Source access notes

- OpenAI pages were intermittently 403 without a browser-like user agent but returned HTTP 200 with a browser-like header; facts were captured from successful fetches.
- Anthropic `https://www.anthropic.com/claude/desktop` returned 404, so the Claude brief uses `https://claude.ai/download` as the official app source.
- Anthropic pricing was reachable but did not yield stable plan-price text in the captured content; exact Claude prices remain open.
- Cursor docs landing page returned only sparse title text in this environment; Cursor details are therefore grounded mainly in the homepage and pricing page.

### Open questions

- ChatGPT: what current public source best documents app connector/custom GPT governance, admin approvals, auditability, and human-in-the-loop controls?
- Claude: what are current Claude Team/Enterprise admin/audit/connector-approval controls, and how much of computer use belongs to API agents versus Claude Desktop product claims?
- Cursor: should Relay Console build a coding-agent integration/interop story, or treat Cursor as a vertical coding analogue rather than a direct competitor?

## 2026-06-28 — Lindy, Replit Agent, and Devin pass

### Products researched

- Lindy — official Lindy docs for assistant overview, pricing, custom agents, triggers/actions, computer use, and evals.
- Replit Agent — official Replit Agent docs, AI billing, Core plan, and Enterprise plan docs; product and pricing pages checked.
- Devin — official Devin homepage/pricing page plus docs index, self-serve billing, security, and API overview pages.

### Files changed

- Added `products/lindy.md`.
- Added `products/replit-agent.md`.
- Added `products/devin.md`.
- Updated `index.md` with the three new products and rotation backlog.
- Updated `positioning-matrix.md` with an additional matrix section for Lindy, Replit Agent, and Devin.
- Updated `README.md` adjacent-products list.
- Appended this `research-log.md` entry.

### Local Relay Console codebase observations

- Re-inspected `Package.swift`: Relay Console remains grounded as a macOS 14+ Swift package with `Relay Console`, `RelayMarketplaceToolBridge`, and service/model/shell/evidence/capture/accessibility harness executable targets.
- Re-inspected `Sources/RelayConsoleCore/RelayConsoleServices.swift`: it wires local data/chat/agent/app/provider/runtime/security/artifact services, provider connections/action broker/approval/runtime mounts, Hermes cron scheduling, runtime workspace/actions/recovery, harness install, provisioning/teardown, and registers Hermes/OpenClaw adapters.
- `RelayConsoleServices.swift` now clearly shows a broader provider adapter set than earlier shorthand notes: X, LinkedIn, Gmail, Google Docs, Google Search Console, Notion, Microsoft Clarity, PostHog, TelemetryDeck, and Sentry adapters are routed through the provider action broker.
- Re-inspected `RuntimeActionService.swift`: host-control/local app process control/local app command execution remain explicitly excluded from Swift scope, which is important against Lindy computer use and other computer-control products.
- Re-inspected `MarketplaceRuntimeMountService.swift`: runtime-mounted provider apps are scoped by active install, assigned agent, runtime type, role manifest support, wrapper tool diagnostics, tool counts, fingerprinting, and private-state redaction.

### Notable new facts from sources

- Lindy docs describe an AI executive assistant for inbox, meetings, calendar, follow-ups, with delegation through iMessage, SMS, Slack, email, or web app: https://docs.lindy.ai/index.md.
- Lindy custom agents are composed of workflows, steps, integrations, and memory; triggers can be time-based, chat-based, or event-based; actions include email/calendar/spreadsheet/Slack examples: https://docs.lindy.ai/fundamentals/lindy-101/introduction.md, https://docs.lindy.ai/fundamentals/lindy-101/triggers.md, and https://docs.lindy.ai/fundamentals/lindy-101/actions.md.
- Lindy computer use lets agents use a computer for processes that cannot be automated with APIs/integrations, with persistent computer session data, dedicated computers per agent, and incognito computers: https://docs.lindy.ai/fundamentals/lindy-101/computer-use.md.
- Lindy evals currently support offline evals for historical tasks, not real-time online scoring: https://docs.lindy.ai/fundamentals/lindy-101/evals.md.
- Replit Agent docs say Agent turns ideas into apps, designs, slides, and more from plain language: https://docs.replit.com/references/agent/overview.md.
- Replit AI Billing lists Agent feature differences by Starter/Core/Pro, including Plan Mode, Connectors, task planning/Kanban, and active background tasks: https://docs.replit.com/billing/ai-billing.md.
- Replit Enterprise docs list SSO/SAML with SCIM, RBAC, SIEM audit logging, admin governance controls, security scans/SBOM, custom-scoped integrations, and unlimited seats: https://docs.replit.com/billing/plans/replit-enterprise.md.
- Devin self-serve docs list Free, Pro ($20/month), Max ($200/month), and Teams ($80/month minimum) with Pro covering Devin sessions, CLI, Desktop, Slack, Linear, and MCP integrations: https://docs.devin.ai/admin/billing/self-serve.md.
- Devin API docs describe organization and enterprise API scopes, service users with RBAC, session creation on behalf of users, audit trails, and centralized key management: https://docs.devin.ai/api-reference/overview.md.
- Devin security docs say web app, GitHub integration, and Slack integration are access modes, and GitHub/Slack integration admins can review/manage granted permissions; Cognition states SOC 2 Type II certification: https://docs.devin.ai/admin/security.md.

### Source access notes

- Lindy, Replit, and Devin docs were accessible with HTTP 200, including `llms.txt` indexes for source discovery.
- Replit's old `/replitai/agent.md` URL redirected to `/references/agent/overview.md`; the brief uses the resolved canonical docs URL.
- Devin docs URLs for `get-started/overview.md` and `get-started/what-is-devin.md` returned 404, so the brief uses the homepage plus API/security/billing docs and docs index.

### Open questions

- Lindy: what public source best documents approval, audit, human-review, and enterprise governance for agent actions and computer use?
- Replit Agent: what exact human-in-the-loop or approval controls exist around connectors, deployments, and background tasks?
- Devin: how should Relay Console compare with Devin Desktop/CLI/Cloud handoff without conflating Devin's coding-agent vertical with Relay Console's broader provider-action/runtime operations?

## 2026-06-28 — Linear, Dust, and Glean pass

### Products researched

- Linear — official product AI/Agents/pricing pages and Markdown docs for Linear Agent, agents in Linear, MCP, and security/access.
- Dust — official docs index plus docs for agent management, remote MCP servers, audit logs, Computer admin setup, and subscriptions.
- Glean — official homepage/AI Agents page and docs for agents, agent development lifecycle, MCP, Agent Sandbox/PTC, tool confirmations, chat history, and action-pack OAuth.

### Files changed

- Added `products/linear.md`.
- Added `products/dust.md`.
- Added `products/glean.md`.
- Updated `index.md` with the three new products, local runtime type evidence, and refreshed backlog.
- Updated `positioning-matrix.md` with a new product-workflow/enterprise-agent matrix section and refreshed the positioning takeaway.
- Updated `README.md` adjacent-products list and local Relay Console grounding notes.
- Appended this `research-log.md` entry.

### Local Relay Console codebase observations

- Re-inspected `Package.swift`: Relay Console remains grounded as a macOS 14+ Swift package with `Relay Console`, `RelayMarketplaceToolBridge`, and executable service/model/shell/evidence/capture/accessibility harness targets.
- Re-inspected `Sources/RelayConsoleCore/RelayConsoleServices.swift`: it wires local data/chat/agent/app/provider/runtime/security/artifact services, provider connections/action broker/approval/runtime mounts, Hermes cron scheduling, runtime workspace/actions/recovery, harness install, provisioning/teardown, and registers Hermes/OpenClaw adapters.
- `RelayConsoleServices.swift` routes a broad provider action adapter set through the broker: X, LinkedIn, Gmail, Google Docs, Google Search Console, Notion, Microsoft Clarity, PostHog, TelemetryDeck, and Sentry.
- `Sources/RelayConsoleCore/Models.swift` defines runtime types for `hermes`, `openclaw`, `claude_code`, and `codex_cli`, which strengthens the case for comparing Relay Console with agent/client ecosystems that expose Claude/Codex/Cursor/Linear MCP surfaces.
- `Sources/RelayConsoleCore/RuntimeActionService.swift` still states Mission Control host-control, local app process control, and local app command execution are excluded from Swift scope.

### Notable new facts from sources

- Linear Agent can create/update issues, projects, milestones, and initiatives; summarize/analyze work; answer workspace-data questions; and post/edit/delete its own comments. It operates within existing permissions and can be disabled by admins: https://linear.app/docs/linear-agent.md.
- Linear agents/app users can be installed by workspace admins, scoped to selected teams, triggered by assignment or @mention, and delegated issues while the human teammate remains responsible: https://linear.app/docs/agents-in-linear.md.
- Linear's hosted remote MCP server exposes Linear data/actions such as finding/creating/updating issues, projects, and comments to compatible clients including Claude, Codex, and Cursor: https://linear.app/docs/mcp.md.
- Dust docs say Enterprise audit logs provide a tamper-evident, time-ordered record and can distinguish human/API/system actions plus AI-driven `agent.executed`/`tool.executed` metadata: https://docs.dust.tt/docs/audit-logs.md.
- Dust remote MCP setup lets workspace admins add public MCP servers with OAuth, Bearer token, and static secret authentication patterns: https://docs.dust.tt/docs/remote-mcp-server.md.
- Dust Computer admin controls allowed domains, environment variables, HTTPS secrets, and whether agents can request user-approved temporary domains during a conversation: https://docs.dust.tt/docs/computer-admin.md.
- Glean docs show a much deeper agent-governance surface than first-pass product pages: ADLC, draft/version/rollback, schedule/content triggers, insights, MCP Gateway, Agent Sandbox/PTC, human-in-the-loop write confirmations, and chat/agent-run retention controls: https://docs.glean.com/llms.txt.
- Glean Agent Sandbox gives Glean a virtual computer with file system, shell, and code interpreter for batch processing, intermediate files, Python computation, and programmatic tool calling: https://docs.glean.com/administration/assistant/features/agentic-engine/agent-sandbox-ptc.md.

### Source access notes

- Linear, Dust, and Glean official pages/docs were reachable with HTTP 200 using Python `urllib` and a browser-like user agent.
- `https://dust.tt/pricing` returned HTTP 308; the brief uses Dust's subscription docs instead.
- `https://www.glean.com/pricing` redirected to the Glean homepage in this environment, so current Glean pricing remains an open question.

### Open questions

- Linear: should Relay Console treat Linear primarily as an integration target/provider adapter or as a comparable for agent work orchestration and human-owned delegation?
- Dust: what source best documents scheduled/background-agent behavior and human-in-the-loop write confirmations beyond MCP/Computer/audit controls?
- Glean: how do Glean Agent access policies, Protect/Protect+, and MCP analytics compare in detail to Relay Console's approval inbox/audit/evidence posture?

## 2026-06-28 — Manus and Open Interpreter pass

### Products researched

- Manus — official homepage/pricing page plus Help Center/llms and messaging/team articles.
- Open Interpreter — official product site, docs/llms index, safety/isolation/local-running docs, and GitHub repository.

### Files changed

- Added `products/manus.md`.
- Added `products/open-interpreter.md`.
- Updated `index.md` with Manus and Open Interpreter rows and refreshed the rotation backlog.
- Updated `positioning-matrix.md` with a hosted action-agent/local computer-use section and refreshed the positioning takeaway.
- Updated `README.md` adjacent-products list.
- Appended this `research-log.md` entry.

### Local Relay Console codebase observations

- Re-inspected `Package.swift`: Relay Console remains a macOS 14+ Swift package with `Relay Console`, `RelayMarketplaceToolBridge`, and executable service/model/shell/event-replay/visual-evidence/capture/accessibility harness targets.
- Re-inspected `Sources/RelayConsoleCore/RelayConsoleServices.swift`: it wires local data/chat/agent/app/provider/runtime/security/artifact services, approval inbox/broker/runtime mounts/tool bridge, runtime workspace/actions/recovery, Hermes cron scheduling, harness install, provisioning/teardown, and registers Hermes/OpenClaw adapters.
- Re-inspected `Sources/RelayConsoleCore/Models.swift`: runtime types include `hermes`, `openclaw`, `claude_code`, and `codex_cli`, but no Open Interpreter runtime type was observed.
- Re-inspected `Sources/RelayConsoleCore/RuntimeActionService.swift`: host-control, local app process control, and local app command execution remain explicitly excluded from Swift scope; destructive/provider/file actions are blocked or dry-run gated pending permission/approval/audit scope.

### Notable new facts from sources

- Manus positions itself as an action engine beyond answers and lists web app, AI design/slides/image/music tools, Manus Browser Operator, Wide Research, Mail, Slack integration, mobile/desktop app downloads, API, Team plan, and SSO on its public site: https://manus.im/.
- Manus Team is a multi-seat subscription for organizations; each user gets a Manus account, and a separate help article says each team member has an independent workspace inaccessible to other team members: http://help.manus.im/en/articles/11711750-what-is-manus-team-plan.md and http://help.manus.im/en/articles/11711793-is-the-environment-configured-separately-for-team-members.md.
- Manus Agents in Telegram provide the same action engine with reasoning, tool usage, and multi-step execution; they support text, voice, images/files, Wide Research/file generation, and return structured reports/PDFs/final deliverables: http://help.manus.im/en/articles/14033617-how-do-i-set-up-and-use-manus-agents-in-telegram.md.
- Manus Slack Agent lets users assign tasks, ask questions, and receive files from Manus in Slack channels or DMs after account linking: http://help.manus.im/en/articles/14432468-how-do-i-set-up-connect-and-use-manus-agents-in-slack.md.
- Manus currently documents a limit of one active messaging Agent connection at a time per workspace: http://help.manus.im/en/articles/14178640-can-i-connect-multiple-messaging-agents-at-once.md.
- Open Interpreter docs say it lets language models run code through a ChatGPT-like terminal interface and can create/edit media/PDFs, control Chrome for research, and analyze datasets; quick start is `pip install open-interpreter` then `interpreter`: https://docs.openinterpreter.com/getting-started/introduction.md.
- Open Interpreter can run fully locally with model providers such as Ollama, Llamafile, Jan, and LM Studio: https://docs.openinterpreter.com/guides/running-locally.md.
- Open Interpreter safety docs say safe mode is experimental, disables auto-run, and can scan generated code with semgrep; isolation docs recommend Docker/E2B and say Docker support is experimental: https://docs.openinterpreter.com/safety/safe-mode.md and https://docs.openinterpreter.com/safety/isolation.md.
- Open Interpreter GitHub now describes the project as a lightweight coding agent for open models, with native sandboxing, `/model` and `/harness`, browser/native app QA skills, ACP, local config/session state, MCP, skills, hooks, permissions, and AGENTS.md: https://github.com/OpenInterpreter/open-interpreter.

### Source access notes

- Manus homepage/pricing/help pages and Open Interpreter site/docs/GitHub were reachable with HTTP 200 using Python `requests` and a browser-like user agent.
- The Manus pricing page rendered general pricing-page metadata and navigation, but exact plan names/prices/credit allowances were not reliably extractable from static HTML in this environment.
- The Manus homepage rendered text saying "Manus is now part of Meta" and copyright "© 2026 Meta"; this was recorded as an open question rather than treated as an investor-facing fact until independently confirmed.

### Open questions

- Manus: what are current plan prices, included credits, enterprise controls, approval/audit surfaces, and task replay/evidence capabilities?
- Open Interpreter: how should Relay Console compare with the product-site desktop agent versus the docs/Python terminal agent versus the GitHub coding-agent/harness fork?
- Open Interpreter: should it be tracked as a possible Relay Console runtime adapter candidate, or only as a competing local computer-use/coding-agent product?
