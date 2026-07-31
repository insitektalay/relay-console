# Public Release Scope

Relay Console will publish a curated source snapshot under the MIT License. The
private development repository and its Git history will remain private for the
first alpha release.

## Included product surfaces

| Surface | Path | Role |
| --- | --- | --- |
| macOS application | `RelayConsoleSwift/` | Main desktop application and local runtime manager |
| iPhone and iPad application | `ios/` | Native mobile client |
| Browser application | `web/` | Web client and public routes |
| Railway backend | `backend/` | API, websocket service, migrations, jobs, and persisted state |
| Shared packages | `packages/` | Contracts, web SDK, and Marketplace catalog |
| Paired Claude runtime | `claude-runtime/` | User-operated runtime connected to Railway |
| Hermes runtime worker | `hermes-runtime/` | Hermes worker and bridge contract support |
| Web page source | `Relay Console landing page/` | Pages imported by the browser application |

The export will also include the package manifests, lockfiles, patches,
migrations, tests, generation inputs, and scripts required to build or verify
these surfaces.

Asset licensing and third-party trademark boundaries are recorded in
[`ASSET_LICENSES.md`](ASSET_LICENSES.md).

## Separate companion repository

The Hermes and OpenClaw bridge plugins use the separate public
[`relay-console-bridge-plugins`](https://github.com/insitektalay/relay-console-bridge-plugins)
repository. Relay Console will pin a compatible bridge release instead of
copying local bridge state into the main repository.

## Excluded material

The public snapshot will exclude:

- The superseded Electron application under `relay-console/`.
- The root Swift prototype under `ClawChat/` and `ClawChat.xcodeproj/`.
- Package-manager caches, build output, coverage, logs, and runtime state.
- Agent-loop directories, internal task instructions, and private checklists.
- Historical launch programmes, deployment evidence, and staging records.
- Credentials, pairing codes, customer data, private conversations, and local
  machine configuration.
- Assets without confirmed redistribution rights.

Code inside a maintained product surface stays in scope until a focused change
proves that removal preserves behavior. Static unused-code findings alone do
not justify deleting connector or generated Marketplace code.

## Source record

Each public export will record the private source commit used to create it. The
public repository will start with a clean Git history after the publication
audit passes.

References to `api.relayconsole.work` in compatibility manifests and maintainer
release evidence identify the upstream deployment that produced those records.
They do not configure a self-hosted installation; the documented Railway
environment variables and owner configuration control runtime routing.
