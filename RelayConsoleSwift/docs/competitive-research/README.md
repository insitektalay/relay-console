# Relay Console competitive research

Last maintained: 2026-06-28

This directory is maintained by a Hermes cron job. Its purpose is to build a living documentation set about products people may compare with Relay Console, including products that overlap only partially with Relay Console's use case.

## Seed competitors / comparables

Always keep these covered and revisit them as their public positioning changes:

- Slack
- Telegram
- Hermes Desktop Agent

Current adjacent products with briefs: Discord, Microsoft Teams, Raycast AI, Zapier Agents/Zapier AI, Notion AI/Notion Agents, ChatGPT desktop/Projects/Tasks, Claude desktop/computer use/MCP, Cursor, Lindy, Replit Agent, Devin, Linear, Dust, Glean, Manus, and Open Interpreter. Continue rotating through adjacent agent/workspace products from `index.md`.

## Relay Console grounding used by this research

Positioning claims about Relay Console should be grounded in the local Swift codebase, not guessed from product intent. Current code evidence includes:

- macOS Swift Package executable: `Package.swift` defines `Relay Console` for macOS 14+ and many executable test/harness targets.
- App navigation: `Sources/RelayConsoleApp/AppViewModel.swift` exposes primary sections for chats, agents, Agent Ops HQ, artifacts, applications, approvals, insights, and settings.
- Core services: `Sources/RelayConsoleCore/RelayConsoleServices.swift` wires local data, chat, agent organization/work dashboards, applications/marketplace installs, provider connections, provider action approval services, runtime workspace, Hermes cron scheduler, artifacts, runtime actions/recovery, secrets, dispatch, and harness installation.
- Runtime harnesses: `Sources/RelayConsoleCore/RelayConsoleServices.swift` registers Hermes and OpenClaw adapters via `RuntimeBridgeRegistry`; `Models.swift` also defines runtime types for Hermes, OpenClaw, Claude Code, and Codex CLI; runtime bridge install work is present in `MarketplaceRuntimeHarnessBridgeInstaller.swift` and `HarnessInstallManager.swift`.
- Provider/action model: local code includes provider connection services, X/LinkedIn/Gmail/Google Docs/Google Search Console/Notion/Microsoft Clarity/PostHog/TelemetryDeck/Sentry provider action adapters, marketplace policy compilation, provider wrapper tools, and approval-gated broker services.
- Safety posture: `Sources/RelayConsoleCore/RuntimeActionService.swift` currently keeps destructive runtime actions, controlled file writes, provider writes, and local app command execution behind permission/approval/audit gates or dry-run blockers until release scope is decided.
- Evidence/testing: `Package.swift` and `Tests/` include component baseline, event replay, visual evidence, accessibility capture, app visual snapshot, and service test targets.

## Expected outputs

- `index.md` — map of researched products, last-updated dates, and current takeaways.
- `products/<product-slug>.md` — one product brief per competitor/comparable.
- `positioning-matrix.md` — cross-product comparison against Relay Console capabilities inferred from the local codebase.
- `research-log.md` — chronological notes on what changed in each run.

## Research rules

- Prefer primary sources: official product docs, changelogs, pricing pages, app store pages, GitHub repos, release notes, and trusted vendor announcements.
- Cite URLs inline for factual claims.
- Clearly distinguish observed product facts from interpretation.
- Inspect the local Relay Console Swift codebase before making positioning claims about Relay Console.
- Do not invent facts when sources are unavailable; record open questions instead.
- Preserve prior useful notes and update stale claims only when a newer source supports the change.
- If network access fails, still update `research-log.md` with the local codebase observations and the source-access failure.
