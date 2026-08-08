# Relay Console architecture guide

Last reviewed: 2026-08-08

This guide explains the architecture in the repository snapshot reviewed at
`b3bd272ff7`. It is written for a reader who wants to understand which part
does what, where it runs, and how the parts relate.

## The short version

Relay Console has three main layers:

1. **Clients**: the macOS Swift app, the web browser app, and the iPhone/iPad
   app. They display data and send user actions.
2. **Railway control plane**: the shared NestJS backend, PostgreSQL, Redis, and
   WebSocket endpoint. It is the authority for shared accounts, workspaces,
   chats, agents, runtime bindings, Marketplace state, permissions, and
   dispatch records.
3. **Runtime hosts**: a Mac, Linux computer, Mac mini, or supported VPS that
   runs Hermes Agent, OpenClaw, or a paired CLI runtime. Runtime work happens
   on this host, not in the browser.

The most important distinction is this:

> Railway coordinates and stores the work. A runtime host performs agent work.

```text
                         user interfaces
       +----------------+----------------+----------------+
       | macOS Swift    | web browser    | iPhone/iPad    |
       | local + cloud  | Vercel         | native client  |
       +----------------+----------------+----------------+
                 HTTPS REST + authenticated WebSocket
                                  |
                                  v
       +---------------------------------------------------+
       | Railway control plane                              |
       | NestJS API + WebSocket gateway                     |
       | PostgreSQL source of truth + Redis queues/state    |
       | runtime dispatch + bridge coordination             |
       | Marketplace catalog, connections, policy, tools    |
       +---------------------------------------------------+
                 | outbound bridge or local adapter
                 v
       +---------------------------------------------------+
       | Runtime host                                      |
       | Hermes Agent / OpenClaw / Claude or Codex CLI     |
       | native profiles, agents, workspaces, credentials  |
       +---------------------------------------------------+

       External provider APIs are called through the Railway Marketplace
       connector path. Provider credentials are not supplied to clients.
```

## What runs where

| Component | Repository path | Main job | Runs on | Is it the shared source of truth? |
| --- | --- | --- | --- | --- |
| macOS Relay Console | `RelayConsoleSwift/` | Native desktop UI, local data, local harness management, cloud sync, bridge and Marketplace UI | User's Mac | No. Local SQLite is local state; Railway is authoritative for shared state. |
| Web app | `web/` | Browser UI | Vercel/browser | No. Vercel serves the UI and rewrites API requests. |
| iPhone/iPad app | `ios/` | Mobile UI | User's Apple device | No. It uses Railway APIs and realtime events. |
| Railway backend | `backend/` | API, authentication, permissions, dispatch, bridge coordination, Marketplace execution, jobs | Railway | Yes, for shared control-plane data. |
| PostgreSQL | Railway service | Durable backend data | Railway | Yes. |
| Redis | Railway service | Bull queues, rate limits, one-time realtime state, runtime coordination | Railway | No. It is shared operational state, not the main data store. |
| Hermes runtime worker | `hermes-runtime/` | Python wrapper around Hermes `AIAgent` | Local or a private Railway worker in the worker mode | No. It is an execution worker. |
| Paired CLI runtime | `claude-runtime/` | Runs Claude Code or Codex CLI in configured repositories | Mac or another operator machine | No. |
| Electron Relay Console | `relay-console/` | Earlier desktop implementation and reference behaviour for the Swift port | Desktop machine | No. It is not the main client described by the current product model. |
| Bridge plugins | Companion repository, not this repository | Connect Hermes/OpenClaw on a host to Railway over an outbound WebSocket | Runtime host | No. |

The backend module list shows that authentication, runtime, bridge, Hermes,
Marketplace, workspace, chat, jobs, and cloud-commercial features are all
deployed together in one modular NestJS service. This is a modular monolith,
not a collection of independent public microservices. See
[`backend/src/app.module.ts`](../../backend/src/app.module.ts).

## The three client applications

### macOS Relay Console Swift

`RelayConsoleSwift/` is the native macOS application. It has more local
responsibility than the other clients:

- local SQLite data and migrations;
- local profile, workspace, chat, agent, and dispatch state;
- direct local Hermes and OpenClaw installation and health flows;
- native macOS settings and Keychain use;
- cloud sign-in, sync, runtime-host pairing, and bridge management;
- Marketplace catalog, connection, install, and brokered-tool views.

The executable and libraries are declared in
[`RelayConsoleSwift/Package.swift`](../../RelayConsoleSwift/Package.swift).
The local data and harness boundaries are visible in
[`LocalDataService.swift`](../../RelayConsoleSwift/Sources/RelayConsoleCore/LocalDataService.swift)
and
[`HarnessInstallManager.swift`](../../RelayConsoleSwift/Sources/RelayConsoleCore/HarnessInstallManager.swift).

The Swift package also declares helper executables such as
`RelayHostService` and `RelayMarketplaceToolBridge`. These are local helper
processes for host and Marketplace work. They are not additional client apps,
and they are not Railway services.

The Swift app can therefore appear to work in two ways:

- **Local-first mode**: the Mac keeps local data and can manage a harness on
  the same Mac.
- **Linked Relay mode**: the Mac signs in to Railway, syncs selected shared
  data, and reaches remote runtime hosts through the Railway control plane.

These are two operating modes of one client. They are not two different
backends.

### Web browser app

The web app is a Next.js app in `web/`. Vercel serves the pages. Browser API
requests use `/api/v1`; Next.js rewrites them to the Railway origin. Browser
realtime uses the Railway WebSocket origin.

The required configuration is:

```text
CLAWCHAT_RAILWAY_ORIGIN=https://<railway-api-origin>
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://<same-railway-host>
```

The two origins must use HTTPS/WSS and the same host. The web app rejects the
retired API variables and local backend targets. See
[`web/next.config.mjs`](../../web/next.config.mjs) and
[`web/lib/config.ts`](../../web/lib/config.ts).

The browser does not install Hermes or OpenClaw. It asks Railway to read data,
create dispatches, receive realtime events, and coordinate an already paired
runtime host.

### iPhone and iPad app

The supported mobile project is under `ios/`. It uses the Railway REST API and
WebSocket. `APIEndpoints.swift` contains the shared endpoint list, including
auth, workspaces, chats, agents, Marketplace, bridge devices, runtime hosts,
and settings-related operations. `WebSocketClient.swift` applies the live
runtime and chat event stream to the mobile store.

The mobile app is a client, not a runtime host. It does not run Hermes or
OpenClaw locally. It also does not replace Railway with a local server.

## Railway: the shared control plane

Railway hosts the backend service defined by
[`backend/railway.json`](../../backend/railway.json). The backend exposes REST
under `/api/v1` and a WebSocket endpoint on the same public backend origin.
The production start command runs migrations before the backend starts.

The backend is responsible for:

- account authentication and session control;
- workspace membership and authorization;
- agents, threads, messages, tasks, approvals, and audit records;
- runtime bindings and dispatch records;
- bridge enrollment, bridge credentials, capabilities, and presence;
- Marketplace catalog, provider connections, installations, policy, and tool
  requests;
- scheduled jobs and Bull queues;
- realtime event delivery.

PostgreSQL stores the durable records. Redis supports queues and shared
operational controls. A Redis value is not the replacement for a PostgreSQL
record.

The browser is hosted by Vercel, but Vercel is not the authority for Relay
data. The same Railway control plane is used by the macOS, web, and iPhone/iPad
clients.

## Runtime terms and relationships

These terms are easy to mix up:

| Term | Meaning | What it is not |
| --- | --- | --- |
| Harness | Hermes Agent or OpenClaw software | Not a Relay agent record |
| Runtime host | The Mac, Linux machine, Mac mini, or VPS that runs the harness | Not the same as a bridge device |
| Bridge device | The authenticated outbound connection from a host to Railway | Not the native Hermes/OpenClaw process |
| Native agent | A Hermes profile or OpenClaw agent on the host | Not the same as a Relay workspace |
| Relay agent | The canonical agent shown in clients | Not a display-name-only alias |
| Runtime binding | The link from a Relay agent to a runtime type, host, and native external ID | Not a Marketplace connection |
| Runtime dispatch | One persisted unit of agent work | Not the entire chat thread |

The central routing chain is:

```text
Relay agent ID
  -> runtime binding
  -> exact runtime host
  -> Hermes profile or OpenClaw external ID
  -> native runtime execution
  -> events back through Railway
  -> persisted Relay message and realtime update
```

The backend entities make these boundaries explicit. A runtime host has a
platform, host kind, supported runtimes, capabilities, and bridge association.
A runtime observation records a native agent found on that host. A runtime
binding maps the selected Relay agent to the execution target. See
[`relay-runtime.entity.ts`](../../backend/src/entities/relay-runtime.entity.ts)
and
[`runtime-binding.entity.ts`](../../backend/src/entities/runtime-binding.entity.ts).

### Same-Mac execution

The macOS app can install or locate Hermes/OpenClaw and call its local adapters.
This is the shortest path:

```text
macOS Swift -> local adapter -> Hermes/OpenClaw on the same Mac
```

The local app still has cloud services for sign-in, sync, shared data, and
Marketplace operations when the workspace is linked.

### Remote execution through a bridge

For a runtime on another Mac, Linux computer, Mac mini, or VPS, the host runs
the companion bridge/plugin beside Hermes or OpenClaw:

```text
client -> Railway -> outbound bridge WebSocket -> local harness
```

The bridge enrolls with Railway, receives a device credential, authenticates a
WebSocket, advertises capabilities, receives dispatches, and sends runtime
events back. The bridge makes an outbound connection. Railway does not need to
open an inbound connection to the customer's machine.

The logical protocol is intended to be the same across host operating systems.
The installation and process supervisor can differ. The source records host
kind, platform, bridge version, runtime version, and capabilities, so Railway
can apply compatibility rules. The exact current plugin installation matrix
for every Linux distribution, macOS version, and VPS image is not in this
repository. The companion plugin repository is a separate dependency; see the
[companion plugin repository](https://github.com/insitektalay/relay-console-bridge-plugins).

### Hermes versus OpenClaw

Both are runtime types behind the same Relay runtime-binding model.

- **Hermes** supports the Hermes worker path and the Hermes bridge path. Its
  adapter supports streamed text, session continuity, tool activity, and
  cancellation when the selected path provides those capabilities.
- **OpenClaw** is currently modeled as a bridge-backed runtime. Its adapter
  resolves a native OpenClaw external agent ID and reports reduced realtime
  capabilities compared with Hermes in the current source.

The user-facing agent record is therefore similar for both runtimes, but the
native identity and execution protocol are different.

### Hermes worker versus Hermes bridge

`hermes-runtime/` is not the bridge plugin. It is a separate Python HTTP
worker around Hermes `AIAgent`. The backend calls it with a shared secret and
streaming endpoints. The same README also documents remote bridge mode.

This creates two possible Hermes execution paths in the source:

```text
backend -> private Hermes HTTP worker -> Hermes
backend -> outbound bridge WebSocket -> Hermes on a customer host
```

Do not assume both paths are active in the same deployment. The current launch
checklist says managed Relay runtime hosting is deferred, while the bridge path
is part of the customer-operated runtime model. Confirm the deployed Railway
configuration before treating the worker as live.

### Claude/Codex paired CLI runtime

`claude-runtime/` is a different runtime path. It enrolls as a bridge device
and runs Claude Code or Codex CLI inside operator-configured repositories. It
is not Hermes and it is not OpenClaw. It uses a safe `repoKey` mapping so
Railway sends an identifier rather than a filesystem path. See
[`claude-runtime/README.md`](../../claude-runtime/README.md).

## Marketplace architecture

Marketplace has four separate ideas:

1. **Catalog application**: the description of a provider or local app. The
   shared manifests live in `packages/marketplace-catalog/`. Railway is the
   authority for cloud catalog state. Swift can bundle a validated snapshot
   for local-only workspaces.
2. **Provider connection**: a workspace's OAuth or API-key connection to that
   provider. It has a status, selected capabilities, and encrypted secret
   material. It is scoped to a workspace.
3. **Marketplace install**: the assignment of an app to a specific Relay agent,
   including its role, selected capabilities, documentation pack, and install
   state.
4. **Runtime tool mount**: the bounded tool surface generated from the active
   install and connection. The runtime sees approved Relay wrapper tools, not
   raw provider credentials or an unrestricted provider API.

The relationship is:

```text
catalog app
  + workspace provider connection
  + agent-specific Marketplace install
  -> policy-checked broker tools
  -> runtime dispatch can call those tools through Railway
```

Therefore:

- installing an app does not authenticate the provider;
- authenticating a provider does not automatically install it for every agent;
- a connected provider is not a runtime host;
- a Marketplace tool call is not the same as an agent runtime dispatch;
- Railway owns the provider credential and execution authority for the normal
  external-provider path.

The backend entity definitions for this relationship are
[`marketplace-connection.entity.ts`](../../backend/src/entities/marketplace-connection.entity.ts)
and
[`marketplace-install.entity.ts`](../../backend/src/entities/marketplace-install.entity.ts).
The Marketplace controller separates catalog, connection, installation, OAuth,
and tool-request operations under the workspace API.

There is also a `local_repo` Marketplace source type. It uses a paired source
host and reviewed local documentation or app API metadata. It is not the same
as an external provider OAuth connection.

## Settings: what each group controls

Settings looks large because it combines local preferences, account controls,
runtime controls, and workspace controls. These are different scopes.

| Settings area | Scope | Main records or services affected |
| --- | --- | --- |
| Account | User profile | Account identity, display name, avatar, email |
| Subscription/Billing | Account/workspace | Entitlement and payment state in Railway |
| Security | Account and sessions | Password, browser/mobile sessions, revocation |
| Privacy | Client and account | Optional analytics/crash consent and data export/deletion |
| Appearance | Local client | Theme and presentation choices; does not change agent execution |
| Workspace and Team | Workspace | Workspace name, members, teams, permissions |
| Integrations/Applications | Workspace | Marketplace catalog, provider connections, installs, tool policies |
| Harnesses | Local Mac or linked runtime host | Hermes/OpenClaw installation, authentication, startup, health |
| Runtime | Workspace/runtime authority | Runtime hosts, bridge devices, native-agent observations, provisioning targets, live activity |
| Relay/Cloud | Account + local/cloud link | Sign-in, sync link, offline retention, bridge devices, cloud diagnostics |
| Existing agents | Workspace/runtime authority | Connect or disconnect agents discovered on a native harness |
| Updates | macOS client and Railway release | Signed app update checks and backend compatibility checks |

The Swift settings model groups these panels under General, Relay, Privacy &
Security, and Runtimes. See
[`AppViewModel.swift`](../../RelayConsoleSwift/Sources/RelayConsoleApp/AppViewModel.swift).
The web settings model exposes a smaller browser-oriented set: account,
subscription, security, privacy, harnesses, existing agents, and runtime. See
[`settings-navigation-pane.tsx`](../../web/components/app-shell/views/settings-navigation-pane.tsx).

The most useful scope rule is:

- If a setting changes **what this Mac looks like**, it is local.
- If it changes **who can use the workspace**, it is a Railway account/workspace
  setting.
- If it changes **where an agent runs**, it is a runtime binding or runtime-host
  setting.
- If it changes **which external service an agent may call**, it is a
  Marketplace connection/install/policy setting.

## Common user journeys

### Local Mac conversation

1. The Swift app loads local state.
2. A local Hermes or OpenClaw harness is installed or discovered.
3. A Relay agent is bound to the native profile or agent ID.
4. The Swift app sends work through its local adapter.
5. The local result is stored in local data. If the workspace is linked,
   supported shared state is synchronized with Railway.

### Web or iPhone conversation with a remote runtime

1. The client signs in to Railway.
2. The client loads the workspace, agent, thread, and binding from Railway.
3. The client creates a persisted runtime dispatch.
4. Railway resolves the binding to one runtime host.
5. The bridge on that host receives the dispatch and calls Hermes or OpenClaw.
6. Runtime events return through Railway WebSocket.
7. Railway stores the terminal result and broadcasts the message to clients.

### Marketplace-assisted agent work

1. An administrator selects a catalog app.
2. The workspace creates or authorizes a provider connection.
3. The app is installed for a selected agent.
4. Railway compiles a bounded tool surface from the connection, install, and
   policy.
5. The runtime receives the approved tool descriptions.
6. A tool call returns to Railway, which checks policy and calls the provider.
7. The provider result returns to the runtime and is recorded in the Relay
   activity path.

## What is not proven by this repository

The source explains the intended contracts, but it does not by itself prove:

- the current live Railway deployment, replica count, or private services;
- which bridge plugin version is installed on a particular Mac, Linux host, or
  VPS;
- successful authentication for every Marketplace provider;
- that every catalog entry is live. The repository records only a small set of
  personally verified application connections in
  [`docs/verified-application-connections/README.md`](../verified-application-connections/README.md);
- that the Hermes worker mode is enabled in the current shared deployment;
- that all clients have identical feature coverage. They share backend
  contracts, but local macOS features are broader.

Use the deployed Railway configuration and the bridge device record to answer
questions about one real installation. Do not infer live status from the
existence of source files or a catalog entry.

## Source map for further reading

- Overall component map: [`README.md`](../../README.md)
- Current hosting and scaling model:
  [`docs/system-design-and-scaling/01-current-architecture.md`](../system-design-and-scaling/01-current-architecture.md)
- Runtime and bridge setup:
  [`docs/RUNTIME_SETUP.md`](../RUNTIME_SETUP.md)
- Runtime setup and deployment components:
  [`SELF_HOSTING.md`](../../SELF_HOSTING.md)
- Marketplace catalog rules:
  [`packages/marketplace-catalog/README.md`](../../packages/marketplace-catalog/README.md)
- Verified provider connections:
  [`docs/verified-application-connections/README.md`](../verified-application-connections/README.md)
