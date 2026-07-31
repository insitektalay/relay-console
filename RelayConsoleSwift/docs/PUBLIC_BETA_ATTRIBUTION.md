# Public Beta Authentication and Model Wording

Relay Console connects to a Hermes Agent or OpenClaw runtime that the user
installs, configures, authenticates, updates, and supports. Each runtime handles
its own OpenAI sign-in and stores its auth profile outside Relay Console. Relay
Console does not issue an OpenAI account or determine OpenAI access.

OpenAI controls account, plan, workspace, usage-limit, regional, rollout, and
model eligibility. Hermes Agent and OpenClaw can also differ in the models they
support. Relay Console lists models tested with its pinned runtime versions and
falls back to that runtime's tested default when a saved model is no longer in
the catalog.

## Required Product Copy

- Name the selected runtime in authentication-required and reconnect messages.
- State that authentication happens in the selected runtime, not Relay Console.
- Link to the runtime's official setup instructions instead of starting an
  authentication flow from Relay Console.
- State that OpenAI controls account, plan, workspace, usage-limit, rollout, and
  model eligibility.
- Explain that Relay Console's catalog records tested runtime compatibility and
  that fallback can replace a retired selection with the runtime default.

Do not promise that buying or holding a named ChatGPT subscription guarantees
access through Hermes Agent or OpenClaw. Do not describe Relay Console as the
OpenAI authentication provider.

## Website Copy

The public site must show this text anywhere it describes OpenAI-backed agent
access:

> Relay Console connects to Hermes Agent or OpenClaw, which you install and
> manage. The selected runtime handles OpenAI sign-in. OpenAI controls account,
> plan, workspace, usage limits, rollout, and model eligibility. Model support
> also varies by runtime version.

## Source Review

- OpenAI, “Using Codex with your ChatGPT plan,” reviewed 2026-07-11:
  `https://help.openai.com/en/articles/11369540-codex-in-chatgpt`
- OpenAI, “Latest models,” reviewed 2026-07-11:
  `https://developers.openai.com/api/docs/guides/latest-model.md`
- Relay Console pinned compatibility manifest:
  `Sources/RelayConsoleCore/Resources/harness-compatibility.json`
