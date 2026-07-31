# Relay Console / ClawChat

## Project status

Relay Console is an early-alpha open-source project for AI enthusiasts, developers and tinkerers running Hermes or OpenClaw. It is not currently distributed through the App Store or provided as a hosted service. Users build the macOS and iOS clients from source, run the web interface locally, and deploy and fund their own backend.

Relay Console is an MIT-licensed, self-hosted AI console with native Apple
clients, a browser app and a Railway control plane. The Railway backend is the
source of truth. Browser API requests stay on `/api/v1` and are rewritten to
Railway; realtime traffic uses the configured Railway websocket origin.

Start with [`SELF_HOSTING.md`](SELF_HOSTING.md). This is a technical alpha: you
provide the hosting, credentials, Apple signing and agent runtime. There is no
shared backend or App Store binary. Maintainer production-launch documents are
historical operating material, not the self-host installation path.
The exact Hermes, OpenClaw and paired CLI runtime steps are in
[`docs/RUNTIME_SETUP.md`](docs/RUNTIME_SETUP.md).
Asset licensing and provider trademark boundaries are documented in
[`ASSET_LICENSES.md`](ASSET_LICENSES.md).

## Maintained product surfaces

| Surface | Path | Ownership and release status |
| --- | --- | --- |
| Railway API and control plane | `backend/` | Shipping NestJS service and production data authority. Deploy from this directory so `backend/railway.json` and startup migrations apply. |
| Vercel web client | `web/` | Shipping Next.js client. HTTP stays on `/api/v1`, rewritten with `CLAWCHAT_RAILWAY_ORIGIN`; realtime uses `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`. |
| Native macOS client | `RelayConsoleSwift/` | Canonical desktop implementation and distribution source. |
| Native iPhone and iPad client | `ios/` | Maintained Xcode project and App Store source. |
| Marketing site | `Relay Console landing page/` | Maintained landing-page package. It does not own application API state. |
| Canonical contracts and generated inputs | `packages/` | Shared contracts, web SDK and Marketplace provider catalog. |
| Paired CLI runtime | `claude-runtime/` | Supported local runtime for Claude Code and Codex-style dispatch through Railway. |
| Hermes runtime worker | `hermes-runtime/` | Supported external Python worker and bridge contract. It remains outside the NestJS process and outside the pnpm workspace. |

Detailed ownership, archival and evidence-retention rules are in
[`docs/repository-ownership-and-retention.md`](docs/repository-ownership-and-retention.md).

## Historical and non-shipping surfaces

| Surface | Path | Status |
| --- | --- | --- |
| Electron desktop prototype | `relay-console/` | Archived reference implementation. Native `RelayConsoleSwift/` supersedes it. It is deliberately excluded from `pnpm-workspace.yaml` and normal installation. |
| Root Swift prototype | `ClawChat/`, `ClawChat.xcodeproj/` | Legacy prototype/compatibility snapshot. Do not use it for release builds; maintained mobile work belongs in `ios/`. |
| Agent-loop launch folders | `agent-loop*` | Historical program evidence, not runtime application code. |
| Archived launch evidence | `docs/archive/` | Historical evidence only. It does not determine current launch state. |

## Architecture

```text
macOS / iPhone / iPad / web
             |
      REST /api/v1 + websocket
             |
       Railway backend
       /      |       \
PostgreSQL  Redis   paired runtimes
                    /             \
             claude-runtime   Hermes worker
```

The clients do not substitute a local backend for the Railway API. Provider
catalog and Marketplace release facts originate in
`packages/marketplace-catalog/` and are generated into backend and Apple
snapshots.

For a beginner-friendly explanation of this architecture, its failure modes,
and the evidence that should trigger future scaling work, see the
[`docs/system-design-and-scaling/`](docs/system-design-and-scaling/README.md)
handbook.

## Repository development

Prerequisites are Node.js 20+, pnpm 10, Xcode 16+ for Apple work and Python 3.11+
for the Hermes worker.

Common non-deployment checks:

```bash
pnpm install --frozen-lockfile
pnpm goal:codebase-remediation
pnpm verify:backend:beta
pnpm verify:web:beta:full
swift build --package-path RelayConsoleSwift
```

The supported iOS project is `ios/ClawChat.xcodeproj`. Regenerate it from
`ios/project.yml` with XcodeGen when the project specification changes.

Backend behavior, DTO, entity, migration, runtime-dispatch or persisted
web-consumed changes are not live until deployed from `backend/` and verified
against Railway. Web behavior changes are not live until the production Vercel
deployment and `/api/v1` rewrite are verified.

## Repository controls

- `pnpm goal:codebase-remediation` runs structural, catalog, semantic, asset and
  repository-ownership gates.
- `pnpm repository:ownership:check` validates maintained and archived surface
  declarations.
- `pnpm clean:repository-caches` lists only known disposable build caches.
- `pnpm clean:repository-caches:apply` removes those exact caches; it never
  targets source, evidence, environment files or workspace roots.

Operational configuration and production verification are documented in
[`docs/BETA_OPERATIONS.md`](docs/BETA_OPERATIONS.md) and
[`docs/production-launch-architecture.md`](docs/production-launch-architecture.md).

## Self-hosted web posture

Each installation uses its owner's Railway deployment:

```text
CLAWCHAT_RAILWAY_ORIGIN=https://your-backend.up.railway.app
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://your-backend.up.railway.app
```

The hosts must match and use HTTPS/WSS. Loopback backend targets are not a
supported web deployment. See [`SELF_HOSTING.md`](SELF_HOSTING.md) for the
Railway, web, macOS, iOS and runtime sequence.

## Avatar assets

The public source archive includes six offline fallbacks, not the full avatar
artwork catalogue. Operators may publish the catalogue in any public HTTPS
object store or CDN with an `illustrated/` directory and configure its directory
URL:

```text
# Vercel / Next.js
NEXT_PUBLIC_RELAY_AVATAR_ASSET_BASE_URL=https://assets.example.com/avatars

# macOS launch environment or application Info.plist
RELAY_CONSOLE_AVATAR_ASSET_BASE_URL=https://assets.example.com/avatars

# iOS owner xcconfig
RELAY_CONSOLE_AVATAR_ASSET_BASE_URL = https:/$()/assets.example.com/avatars
```

This URL is public configuration, not a secret. With no avatar asset URL, the
clients continue to work using the bundled fallback set and initials.
