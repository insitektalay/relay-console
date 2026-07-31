# OpenClaw bridge preview

The OpenClaw bridge is a public preview. This repository contains the Railway
API contract; the installable extension lives in the separate MIT-licensed
[`relay-console-bridge-plugins`](https://github.com/insitektalay/relay-console-bridge-plugins)
repository.

Use [`RUNTIME_SETUP.md`](RUNTIME_SETUP.md#option-b-openclaw-preview) for the
complete pinned installation, enrollment, gateway, health and first-message
sequence. The guide pins both the supported OpenClaw release and the bridge
source commit, so it does not depend on an unpublished extension or a
maintainer machine.

The bridge connects outbound to the operator's own Railway origin:

```text
API origin: https://YOUR-BACKEND.up.railway.app
API prefix: /api/v1
Websocket: wss://YOUR-BACKEND.up.railway.app
```

OpenClaw's local runtime endpoints may use loopback inside its own host. Relay
Console API and websocket settings must use the Railway origin above.

The preview supports one-time enrollment, rotating device credentials,
reconnect backfill, runtime-agent discovery and reply postback. The backend
compatibility manifest at
`backend/src/modules/bridge/bridge-compatibility-manifest.json` remains the
source of truth for accepted plugin and runtime versions.
