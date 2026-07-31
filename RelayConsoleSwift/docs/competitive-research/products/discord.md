# Discord

## Summary

Discord is a consumer/community communication product with servers, channels, voice/video, streaming, community moderation, and a large developer platform for bots, apps, activities, and integrations. Discord's developer documentation describes its platform as a place to "build bots and integrations on Discord, or connect your game with rich presence, voice chat, and more": https://discord.com/developers/docs/intro. Discord Nitro packages premium end-user chat perks such as custom emojis, animated avatars, larger file uploads, and HD screensharing: https://discord.com/nitro.

## Jobs/use cases

- Persistent community, friend-group, creator, gaming, and increasingly work-adjacent chat spaces.
- Real-time voice, video, screen-share, and lightweight event/community coordination.
- Bot-driven moderation, notifications, slash-command utilities, and custom community workflows.
- Embedded activities/apps for interaction inside a Discord server or DM context.

## Feature overlap with Relay Console

- **Chat/workspace:** Discord servers/channels/DMs are an obvious user-facing comparable to Relay Console's local `chat` section and workspace shell.
- **Messaging-channel bridge:** Discord bots and integrations overlap with the idea of agents reachable from chat or notification channels.
- **Tool/app ecosystem:** Discord's developer platform overlaps at the ecosystem level with Relay Console's marketplace/provider wrapper-tool work, though the integration model is very different.
- **Approvals/safety:** Discord has platform/community safety and app-permission concepts; Relay Console code has local provider action approval services, permission policies, audit security, and runtime action blockers.

## Where it differs

- Discord is a hosted social/community communication network; Relay Console local evidence points to a macOS local-first app for agent runtimes, provider-action tools, approvals, artifacts, and evidence.
- Discord bots/apps run in the Discord platform context and are usually developer-hosted; Relay Console mounts policy-scoped wrapper tools into local Hermes/OpenClaw-style runtimes via local services and a marketplace runtime tool bridge.
- Discord's premium packaging is end-user communication perks (Nitro), not a local agent-operations console with cron scheduling, runtime recovery, visual/accessibility evidence harnesses, or provider-action audit trails.

## Pricing/packaging if relevant

Discord has free product usage plus Nitro/Nitro Basic premium end-user subscriptions. The Nitro page describes paid perks including custom emojis, animated avatars, larger file uploads, and HD screensharing: https://discord.com/nitro. Developer/bot hosting, app monetization, and enterprise/community packages need deeper current verification.

## Distribution/ecosystem

- Web, desktop, and mobile clients for Discord users.
- Discord Developer Platform for bots, companion apps, embedded apps/activities, rich presence, voice/chat integrations, and developer teams: https://discord.com/developers/docs/intro.
- Large public bot/app ecosystem, but the specific current discovery/monetization mechanics should be verified in a future run.

## Evidence/source links

- Discord Developer Platform documentation: https://discord.com/developers/docs/intro
- Discord Nitro product page: https://discord.com/nitro
- Relay Console local evidence: `Package.swift`; `Sources/RelayConsoleApp/AppViewModel.swift`; `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift`; `Sources/RelayConsoleCore/HermesCronSchedulerService.swift`.

## Open questions

- Should Relay Console treat Discord as a future first-class notification/control channel through Hermes or only as a comparable chat/bot ecosystem?
- What are Discord's current production app-review, permission, and monetization rules, and how should those be compared with Relay Console's provider action approval/audit model?
- Are there current Discord enterprise/team collaboration claims that matter for Relay Console investor positioning, or is Discord mostly a community/bot comparable?

## Last updated

2026-06-27
