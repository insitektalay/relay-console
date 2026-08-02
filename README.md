# Relay Console

Relay Console is an early-alpha, MIT-licensed, self-hosted console for Hermes
Agent and OpenClaw. This repository contains the native macOS app, native
iPhone and iPad app, web client, and Railway backend, together with the shared
packages and runtime components needed to build and operate them.

The project is intended for technical early adopters. You provide your own
agent runtimes, hosting and credentials, and currently build the clients from
source.

## Current distribution status

| Item | Status |
| --- | --- |
| Public source | Available under the MIT License |
| macOS application | Build from source; no signed public DMG or GitHub Release is available |
| iPhone and iPad application | Build from source; no App Store release is available |
| Web application and backend | Self-host from this repository |
| Railway template | Infrastructure is present in source, but no verified public template URL is available yet |
| Sparkle updates | Supported in source, but no public update is available until a signed DMG, GitHub Release and appcast are published |
| Windows | Not supported yet |

Public source availability does not mean that an installable application
release exists. Do not expect the macOS update checker to offer an update from
this source snapshot.

## Choose how to connect

The macOS app includes automatic local Hermes Agent and OpenClaw discovery and
a first-launch setup assistant.

- For local-only macOS use, Hermes Agent or OpenClaw can run on the same Mac
  and connect directly. Railway is optional for this path.
- For a runtime on another macOS or Linux computer, Mac mini, server or VPS,
  deploy your own Railway backend and install the bridge beside the runtime.
  Railway is required for this remote-machine connection flow and for the web
  and iPhone/iPad clients.
- The bridge plugins are maintained separately in
  [`relay-console-bridge-plugins`](https://github.com/insitektalay/relay-console-bridge-plugins).

Start with [`SELF_HOSTING.md`](SELF_HOSTING.md). Runtime-specific setup is in
[`docs/RUNTIME_SETUP.md`](docs/RUNTIME_SETUP.md).

## Railway deployment status

The repository contains the secure three-service Railway template
infrastructure for the backend, PostgreSQL and Redis. The template still
requires a one-time publication by the repository owner, so this README does
not include an unverified **Deploy on Railway** button. See
[`docs/RAILWAY_TEMPLATE_PUBLISHING.md`](docs/RAILWAY_TEMPLATE_PUBLISHING.md)
for the publication and fresh-account acceptance procedure.

Manual self-hosting instructions are in [`SELF_HOSTING.md`](SELF_HOSTING.md).
For web deployments, browser requests remain on `/api/v1` and are rewritten to
the configured Railway origin; realtime traffic uses the configured Railway
websocket origin.

## Repository map

| Surface | Path |
| --- | --- |
| Native macOS client and local runtime manager | `RelayConsoleSwift/` |
| Native iPhone and iPad client | `ios/` |
| Next.js web client | `web/` |
| NestJS Railway backend | `backend/` |
| Shared contracts, SDK and Marketplace catalog | `packages/` |
| Paired CLI runtime | `claude-runtime/` |
| Hermes runtime worker | `hermes-runtime/` |
| Marketing site | `Relay Console landing page/` |

The supported iOS project is `ios/ClawChat.xcodeproj`. The macOS Swift package
is under `RelayConsoleSwift/`.

## Privacy and telemetry

PostHog product analytics and Sentry crash reporting are optional, opt-in and
disabled until the user consents. Self-hosters do not need either service.
Configuration values are not included in this source snapshot.

- [Telemetry and privacy behavior](RelayConsoleSwift/docs/PUBLIC_BETA_TELEMETRY.md)
- [Telemetry configuration](docs/TELEMETRY_CONFIGURATION.md)
- [iOS privacy disclosures](ios/APP_STORE_PRIVACY_DISCLOSURES.md)
- [Security policy](SECURITY.md)
- [Asset licences and trademark boundaries](ASSET_LICENSES.md)
- [Third-party notices](RelayConsoleSwift/Release/THIRD_PARTY_NOTICES.md)

## Build from source

Prerequisites are Node.js 20+, pnpm 10, Xcode 16+ for Apple work, and Python
3.11+ for the Hermes worker.

```bash
pnpm install --frozen-lockfile
swift build --package-path RelayConsoleSwift
```

For backend and web setup, follow [`SELF_HOSTING.md`](SELF_HOSTING.md). Deploy
the backend from `backend/` so `backend/railway.json` applies and startup
migrations run.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a change. Security
reports should follow [`SECURITY.md`](SECURITY.md). The public export boundary
is documented in [`PUBLIC_RELEASE_SCOPE.md`](PUBLIC_RELEASE_SCOPE.md).

Relay Console is provided under the [MIT License](LICENSE).
