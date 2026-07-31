# Relay Console paired CLI runtime

This macOS runtime connects a local Claude Code or Codex CLI to an operator's
Railway backend. Use it instead of the Hermes or OpenClaw bridge when you want
Relay Console to dispatch into a local repository through one of those CLIs.

## Prerequisites

- Node.js 20 and pnpm 10;
- a working Claude Code CLI or Codex CLI login;
- a deployed Relay Console Railway backend; and
- a Relay Console workspace-owner or administrator account.

Install repository dependencies and build the runtime:

```bash
pnpm install --frozen-lockfile
pnpm --dir claude-runtime build
```

## Create the local config

The runtime reads only:

```text
~/.clawchat/claude-runtime/config.json
```

Create its private directories and copy the public example:

```bash
install -d -m 700 "$HOME/.clawchat/claude-runtime"
install -m 600 claude-runtime/config.example.json \
  "$HOME/.clawchat/claude-runtime/config.json"
```

Edit the copied file. Required fields are:

- `apiBaseUrl`: `https://YOUR-BACKEND.up.railway.app/api/v1`;
- `wsUrl`: `wss://YOUR-BACKEND.up.railway.app`;
- `workspaceId`: the workspace ID shown by Relay Console;
- `managedRoot`: an existing directory that contains every allowed repo;
- at least one `agents` entry; and
- a matching existing directory in `repos` for each agent's `repoKey`.

The example uses `npx @anthropic-ai/claude-code`. To use Codex, replace
`claudeCommand` with the approved command for your Codex installation. Leave
`dangerousBypassAccepted` false for the first setup.

## Enrol

In Relay Console, open **Settings > Integrations > Runtime pairing** and create
a one-time code. Enrol without saving the code in shell history:

```bash
read -r -s RELAY_ENROLLMENT_CODE
pnpm --dir claude-runtime enroll -- \
  --code "$RELAY_ENROLLMENT_CODE" \
  --label "My paired CLI runtime"
unset RELAY_ENROLLMENT_CODE
```

The runtime stores its device token in the macOS Keychain and writes only the
public device ID to `config.json`.

## Start and verify

```bash
pnpm --dir claude-runtime start
```

Keep that process running. Its log must report the CLI version, successful
websocket authentication and artifact-catalogue publication. Runtime pairing
must show the device online.

Create an agent whose external ID matches the configured `externalAgentId`,
start a direct chat, and send a message. The local CLI runs inside the matching
registered repository and posts its final reply to the Railway conversation.

## Optional managed host operations

`managedAgentHosts` is optional. It maps an external agent ID to a local
workspace and fixed maintenance commands. Railway sends identifiers and
actions; it cannot supply a filesystem path or shell command.

Restart the runtime after changing these entries. Keep device credentials and
repository paths out of version control.
