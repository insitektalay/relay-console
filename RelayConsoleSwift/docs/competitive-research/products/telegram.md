# Telegram

## Summary

Telegram is a cloud-based mobile and desktop messaging app focused on speed and security. Telegram's FAQ says messages sync across phones, tablets, and computers, that Telegram is among the top five most downloaded apps and has over 1 billion active users, and that it supports groups/channels, bots, voice/video/group calls, and device-specific secret chats: https://telegram.org/faq.

## Jobs/use cases

- Consumer and community messaging across mobile/desktop/web.
- Broadcast channels and large groups.
- Bot-driven workflows and lightweight app surfaces.
- Public/community distribution, creator/audience communication, and notification delivery.
- Privacy-sensitive one-to-one chats via Secret Chats when users explicitly choose them.

## Feature overlap with Relay Console

- **Messaging-channel bridge:** Telegram can serve as a remote messaging channel for agents; Hermes Agent docs explicitly mention Telegram interaction modes, and Relay Console's seed comparables include Hermes Desktop Agent.
- **Bots/API:** Telegram bots can automate messaging interactions; Relay Console has provider/action adapters and runtime wrapper tools that can expose controlled actions to agents.
- **Desktop footprint:** Telegram has desktop apps, while Relay Console is a macOS Swift desktop app.

## Where it differs

- Telegram is primarily a messaging network and distribution surface; Relay Console is a local agent operations console with agent/work dashboards, runtime harness installation, provider action policies/approvals, artifacts, runtime workspace, cron scheduler, and tests/evidence harnesses.
- Telegram bots require developer setup and are not, by themselves, a local multi-profile agent runtime or provider-action safety framework. Telegram's FAQ says there are no out-of-the-box ways to create a working bot without programming skills: https://telegram.org/faq.
- Telegram's open API/source-code posture differs from Relay Console's current local Swift codebase and user-owned provider credential model.

## Pricing/packaging if relevant

Telegram is free for core use and offers Telegram Premium. Telegram's FAQ says it has advertisements in certain public channels and launched Premium in 2022 to support the app and unlock exclusive features: https://telegram.org/faq. Telegram Premium marketing is at https://telegram.org/premium.

## Distribution/ecosystem

- Telegram offers mobile, desktop, macOS, and web apps: https://telegram.org/apps.
- Telegram says its apps are open source and support reproducible builds; the apps page links to official clients and GitHub repositories: https://telegram.org/apps.
- Telegram provides platform/API and bot ecosystem entry points from its main navigation: https://telegram.org/faq and https://telegram.org/apps.

## Evidence/source links

- Telegram FAQ: https://telegram.org/faq
- Telegram apps/open-source clients: https://telegram.org/apps
- Telegram Premium: https://telegram.org/premium
- Relay Console local evidence: `Package.swift`; `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/ProviderConnectionService.swift`; `agent-loops/agent-loop-marketplace-app-install-gmail/README.md`.

## Open questions

- Should Relay Console support Telegram as a first-class notification/control channel, or treat it only as an external comparable through Hermes?
- Which Telegram bot capabilities should be benchmarked against Relay Console provider-action wrappers and approval requirements?

## Last updated

2026-06-27
