# Connect a runtime and send the first message

Relay Console needs one runtime host to produce an AI reply. The runtime host
connects outbound to your Railway backend; it needs no public inbound port.

Choose one path:

- **Hermes Agent** is the preferred early-alpha bridge path.
- **OpenClaw** is a preview alternative.
- The bundled [`claude-runtime/`](../claude-runtime/README.md) is a macOS-only
  option for Claude Code or Codex users.

You need only one path. Marketplace applications, Sentry, PostHog, analytics,
billing and managed cloud runtimes are optional.

## Required information

Complete [`SELF_HOSTING.md`](../SELF_HOSTING.md) first. Record:

- your backend origin: `https://YOUR-BACKEND.up.railway.app`;
- your Relay Console account and workspace; and
- the computer where Hermes or OpenClaw will run.

Sign in to the web client as a workspace owner or admin. Open **Settings >
Integrations > Runtime pairing**. This page creates the ten-minute enrollment
code and reports paired-device status.

The bridge source lives in the public
[`relay-console-bridge-plugins`](https://github.com/insitektalay/relay-console-bridge-plugins)
repository. This guide pins commit
`f04043b7d9209fce797da336bccc9dddd0dfde4b` so the installation matches this
Relay Console snapshot:

```bash
git clone https://github.com/insitektalay/relay-console-bridge-plugins.git
cd relay-console-bridge-plugins
git checkout --detach f04043b7d9209fce797da336bccc9dddd0dfde4b
```

Run the remaining commands on the runtime host.

## Option A: Hermes Agent

### Install and configure Hermes

The current bridge candidate accepts Hermes `v2026.7.7.2`. Install Hermes with
its public installer, then pin the managed source checkout to that release:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
cd "${HERMES_HOME:-$HOME/.hermes}/hermes-agent"
git fetch --tags origin
git checkout --detach v2026.7.7.2
if [ -x .venv/bin/python ]; then
  HERMES_PYTHON="$PWD/.venv/bin/python"
else
  HERMES_PYTHON="$PWD/venv/bin/python"
fi
uv pip install --python "$HERMES_PYTHON" -e '.[all,messaging]'
"$HERMES_PYTHON" -m pip show aiohttp | grep 'Version: 3.14.1'
hermes setup
hermes version
```

`hermes setup` requires one model provider or a local compatible model. That
provider is required for an AI reply and may charge for usage. Relay Console
does not need the provider credential and does not pay for the provider.

Start `hermes`, send a short test prompt, and exit after Hermes replies:

```bash
hermes
```

This check proves the runtime and model work before Relay Console adds the
bridge.

### Install and enrol the Hermes bridge

From the bridge checkout created above:

```bash
scripts/install-hermes-agent-bridge.sh \
  "${HERMES_HOME:-$HOME/.hermes}/hermes-agent"
```

In Relay Console, click **Generate pairing code**. Enter the code without
placing it in shell history:

```bash
cd "${HERMES_HOME:-$HOME/.hermes}/hermes-agent"
read -r -s RELAY_ENROLLMENT_CODE
"$HERMES_PYTHON" -m clawchat_bridge.main enroll \
  --api-url https://YOUR-BACKEND.up.railway.app \
  --code "$RELAY_ENROLLMENT_CODE" \
  --device-label "My Hermes bridge"
unset RELAY_ENROLLMENT_CODE
```

Return to the bridge checkout and install its background service:

```bash
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}/hermes-agent" \
HERMES_PYTHON="$HERMES_PYTHON" \
  scripts/manage-hermes-agent-bridge.sh install
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}/hermes-agent" \
  scripts/manage-hermes-agent-bridge.sh status
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}/hermes-agent" \
  scripts/manage-hermes-agent-bridge.sh health
```

The health command must pass. Relay Console's Runtime pairing page must show
the device online.

## Option B: OpenClaw preview

The current bridge candidate accepts OpenClaw `v2026.6.11`. Install that exact
public package and run OpenClaw onboarding:

```bash
npm install -g openclaw@2026.6.11
openclaw onboard --install-daemon
openclaw gateway start
openclaw gateway status
```

Configure a model provider and at least one OpenClaw agent during onboarding.
The provider is required for an AI reply.

From the pinned bridge checkout:

```bash
scripts/manage-openclaw-bridge.sh install
```

Generate a code from **Settings > Integrations > Runtime pairing**, then enrol:

```bash
read -r -s RELAY_ENROLLMENT_CODE
printf '%s\n' "$RELAY_ENROLLMENT_CODE" | openclaw relay-console enroll \
  --api-url https://YOUR-BACKEND.up.railway.app \
  --label "My OpenClaw bridge"
unset RELAY_ENROLLMENT_CODE
openclaw gateway restart
scripts/manage-openclaw-bridge.sh status
scripts/manage-openclaw-bridge.sh health
```

The health command must pass and Runtime pairing must show the device online.

## Connect the discovered agent

Both bridges publish runtime inventory after they authenticate.

1. In the web client, open **Settings > Integrations > Existing agents**.
2. Click **Scan again** if the runtime profile or OpenClaw agent has not
   appeared.
3. Select one compatible discovered agent and click **Connect selected**.
4. Wait until its state reads **Connected**.
5. Open **Agents** and confirm the connected agent is available.

Relay Console records the connection. It does not copy or delete the runtime's
native agent or files.

## Send the first conversation

1. Open **Chats**.
2. Create a direct chat and select the connected runtime agent.
3. Send: `Reply with exactly: Relay Console connected.`
4. Keep the runtime bridge running.
5. Confirm the agent reply appears in the same chat.

A visible reply proves the client, Railway API, websocket, runtime bridge and
model provider completed one end-to-end turn. If the message remains pending,
check the bridge `health` and `logs` commands, then confirm that Runtime pairing
shows the device online and Existing agents shows the target as Connected.

## Client backend settings

The runtime and all clients must use the same backend:

| Surface | Required setting |
| --- | --- |
| Bridge | `--api-url https://YOUR-BACKEND.up.railway.app` |
| Web | `CLAWCHAT_RAILWAY_ORIGIN` and `NEXT_PUBLIC_RAILWAY_WS_BASE_URL` at build/deploy time |
| macOS | the two origins passed to `Scripts/build-release-app.sh` |
| iOS | `RELAY_CONSOLE_API_BASE_URL` and `RELAY_CONSOLE_WEBSOCKET_BASE_URL` in the owner xcconfig |

The web, macOS and iOS commands are in
[`SELF_HOSTING.md`](../SELF_HOSTING.md#6-configure-a-client). A user signs in to
the same account and workspace from each client; pairing the runtime once makes
it available to that workspace across all three clients.

## Optional integrations

You do not need these for the first conversation:

- Marketplace provider OAuth or API keys;
- Relay Console Sentry, PostHog or analytics settings;
- OpenClaw messaging channels;
- Hermes messaging gateways, skills or browser tools; or
- Relay billing, email or managed runtime features.

Do not paste enrollment codes, device credentials or model-provider keys into
issues, chat messages or repository files.
