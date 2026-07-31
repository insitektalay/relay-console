# Open Interpreter

## Summary

Open Interpreter is an open-source local/computer-use agent comparable. Its docs state that Open Interpreter lets language models run code and provides a ChatGPT-like terminal interface after installing; it can create/edit files such as photos/videos/PDFs, control Chrome for research, and plot/clean/analyze datasets: https://docs.openinterpreter.com/getting-started/introduction.md. The project site positions "Interpreter" as "The Desktop Agent" that lets users work alongside agents that can edit documents and fill PDF forms: https://openinterpreter.com/. The GitHub repository currently describes Open Interpreter as "a lightweight coding agent for open models like Deepseek, Kimi, and Qwen" and says it supports native sandboxing, harness switching, computer-use QA skills, ACP, MCP, skills, hooks, permissions, and local config/session state under `~/.openinterpreter`: https://github.com/OpenInterpreter/open-interpreter.

## Jobs/use cases

- Natural-language terminal control over computer/file/data tasks.
- Local model operation through providers such as Ollama, Llamafile, Jan, and LM Studio; docs say Open Interpreter can be run fully locally: https://docs.openinterpreter.com/guides/running-locally.md.
- Coding-agent and model-harness experimentation with open/low-cost models; GitHub says users can switch providers/models and inspect/switch harnesses with `/model` and `/harness`: https://github.com/OpenInterpreter/open-interpreter.
- Computer-use testing via browser/native app QA skills; GitHub says it can drive web apps in a real browser with `agent-browser` or native apps with `trycua`: https://github.com/OpenInterpreter/open-interpreter.

## Feature overlap with Relay Console

- **Local desktop/runtime operations:** Strong overlap in local agent execution and computer-use/control ideas. Relay Console, however, is grounded as a macOS Swift operator console that registers Hermes/OpenClaw adapters and defines runtime types for Hermes, OpenClaw, Claude Code, and Codex CLI rather than as a single terminal agent.
- **Tool/runtime ecosystem:** Open Interpreter supports MCP/skills/hooks/permissions per GitHub; Relay Console has marketplace installs, wrapper tools, runtime mounts, a tool bridge, provider action broker, and provider-action approval services.
- **Safety/sandboxing:** Open Interpreter docs discuss safe mode, code scanning, Docker/E2B isolation, and experimental safety status; Relay Console code has permission/audit services, approval inbox services, and runtime action blockers/dry-runs.
- **Local evidence/testing:** Open Interpreter's QA/computer-use testing overlaps conceptually with Relay Console's event replay, visual evidence, accessibility capture, visual snapshot, and component baseline harnesses, but Open Interpreter is not documented as a Relay-style product evidence console.

## Where it differs

- Open Interpreter is primarily an agent/terminal/desktop-agent runtime; Relay Console is an operations console that can manage/mount multiple runtimes and provider/action tools.
- Open Interpreter can directly run code or control computer/browser environments; Relay Console's current Swift code explicitly excludes Mission Control host-control, local app process control, and local app command execution from scope via `RuntimeActionService.hostControlExclusionReason`.
- Open Interpreter is open-source/CLI-first, with docs and a GitHub repository; Relay Console is a local macOS app/package with app navigation, local services, marketplace bridge executable, and many bundled test/harness targets.

## Pricing/packaging if relevant

- Open Interpreter's GitHub repository is licensed Apache-2.0 and provides one-line installers plus terminal startup commands: https://github.com/OpenInterpreter/open-interpreter.
- The docs quick start shows `pip install open-interpreter` and then `interpreter`: https://docs.openinterpreter.com/getting-started/introduction.md.
- Open question: the current public site markets a desktop agent, while docs and GitHub emphasize terminal/package/coding-agent usage; pricing or commercial packaging for the desktop product was not verified this run.

## Distribution/ecosystem

- GitHub repository: https://github.com/OpenInterpreter/open-interpreter.
- Docs: https://docs.openinterpreter.com/ and `llms.txt` docs index: https://docs.openinterpreter.com/llms.txt.
- Python package install path documented as `pip install open-interpreter`: https://docs.openinterpreter.com/getting-started/introduction.md.
- Local model providers include Ollama, Llamafile, Jan, and LM Studio per docs: https://docs.openinterpreter.com/guides/running-locally.md.
- Sandboxing/isolation docs mention Docker and E2B; Docker support is marked experimental: https://docs.openinterpreter.com/safety/isolation.md and https://docs.openinterpreter.com/integrations/docker.md.

## Evidence/source links

- Product site: https://openinterpreter.com/
- Docs introduction: https://docs.openinterpreter.com/getting-started/introduction.md
- Docs index: https://docs.openinterpreter.com/llms.txt
- Running locally: https://docs.openinterpreter.com/guides/running-locally.md
- Safe mode: https://docs.openinterpreter.com/safety/safe-mode.md
- Isolation: https://docs.openinterpreter.com/safety/isolation.md
- Docker integration: https://docs.openinterpreter.com/integrations/docker.md
- GitHub repository: https://github.com/OpenInterpreter/open-interpreter
- Relay Console local evidence: `Package.swift`; `Sources/RelayConsoleCore/RelayConsoleServices.swift`; `Sources/RelayConsoleCore/RuntimeActionService.swift`; `Sources/RelayConsoleCore/Models.swift`.

## Open questions

- How should Relay Console compare against Open Interpreter's current branch/repo positioning, given docs emphasize the Python terminal agent while GitHub now describes a fork of OpenAI Codex with harness emulation?
- Is the "Interpreter: The Desktop Agent" product generally available, and does it have separate commercial packaging from the open-source terminal agent?
- Could Open Interpreter become a future Relay Console runtime adapter alongside Hermes/OpenClaw/Claude Code/Codex CLI, or is it mainly a competitive computer-use agent?

## Last updated

2026-06-28
