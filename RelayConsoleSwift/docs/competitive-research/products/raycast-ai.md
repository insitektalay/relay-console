# Raycast AI

## Summary

Raycast AI is an OS-level productivity/launcher AI surface: Raycast describes it as "AI that works with your OS" and says it combines leading models with extensions on the operating system surface: https://www.raycast.com/ai. It is a strong adjacent comparable for Relay Console when buyers think about local desktop command palettes, AI commands, extension stores, and productivity automation rather than team messaging.

## Jobs/use cases

- Invoke AI from a desktop workflow with a hotkey/floating UI; Raycast's AI page describes Quick AI, AI Chat, web search with references, and attachments/screen/context use: https://www.raycast.com/ai.
- Use many LLM providers/models from one desktop interface; Raycast Pro lists providers including OpenAI, Anthropic, Perplexity, Meta, Google, xAI, Mistral, DeepSeek, and others: https://www.raycast.com/pro.
- Automate repetitive desktop work through AI Commands; Raycast says users can create AI Commands and choose from 30+ built-in commands: https://www.raycast.com/ai.
- Extend Raycast through extensions and optionally publish them to the store; developer docs include creating, debugging, publishing, and reviewing extensions plus AI extension guidance: https://developers.raycast.com/.

## Feature overlap with Relay Console

- Local desktop surface: overlaps with Relay Console's macOS executable in `Package.swift`.
- Tool/extension ecosystem: Raycast extensions and AI extensions are comparable to Relay Console's local marketplace/provider wrapper/runtime bridge services (`MarketplaceInstallService`, `RelayProviderWrapperToolCompilerService`, `MarketplaceRuntimeMountService`).
- AI automation: Raycast AI Commands overlap with Relay Console's goal of mounting scoped tools into runtimes, but Raycast is centered on end-user desktop productivity.
- Provider/model aggregation: Raycast exposes multiple AI providers/models, while Relay Console code currently focuses on runtime adapters (Hermes/OpenClaw) and provider-action services.

## Where it differs

- Raycast is a productivity launcher/command palette with AI; Relay Console local code is closer to an agent operations console with runtime dispatch, harness install, cron scheduling, provider action approvals, artifacts, and evidence harnesses.
- Raycast's public AI pages emphasize interactive desktop assistance and extension commands; Relay Console code includes approval inboxes, audit security, blocked/dry-run runtime actions, and per-agent runtime marketplace mounts.
- Raycast does not appear, from sources checked this run, to be a multi-profile autonomous-agent operations console with replay/visual-evidence harnesses.

## Pricing/packaging if relevant

Raycast Pro starts at $8/month according to the Raycast Pro page; the same page says Pro is for individuals and Team is for organizations with private shared extensions/snippets/quicklinks: https://www.raycast.com/pro. Enterprise features are referenced via "Contact us" on the same page.

## Distribution/ecosystem

Raycast distributes as an OS productivity app and has an extension developer platform and store. Developer docs cover public and private extensions, AI extensions, OAuth/preferences/storage/system utilities, and window/search-bar APIs: https://developers.raycast.com/.

## Evidence/source links

- Raycast AI product page: https://www.raycast.com/ai
- Raycast Pro/pricing page: https://www.raycast.com/pro
- Raycast developer documentation: https://developers.raycast.com/

## Open questions

- How should Relay Console compare against Raycast for "desktop AI operating system" narratives without over-claiming local OS control? Relay Console code currently excludes host-control/local app command execution from Swift scope in `RuntimeActionService`.
- Are Raycast Team/Enterprise private-extension controls comparable to Relay Console's provider action approval/audit model, or only to extension distribution?
- Does Relay Console need a command-palette UX story for launching agent/runtime operations from anywhere on macOS?

## Last updated

2026-06-28
