# Services And Architecture

## Deployable Components In This Repo

| Component | Path | Role | Runs On |
|---|---|---|---|---|
| Backend API | `backend/` | NestJS REST API, websocket gateway, auth, workspace data, bridge API, marketplace, runtime dispatch persistence, scheduled jobs, Bull queues | Railway | Service `clawchat`; has `backend/railway.json` and `backend/Dockerfile` |
| Web app | `web/` | Next.js browser app and public landing/app routes | Vercel | Project `clawchat-web`; root directory `web`; Next.js preset |
| Postgres | Railway managed service | Primary database for backend entities and migrations | Railway | Required |
| Redis | Railway managed service | Bull queue backend and job infrastructure | Railway | Required by backend production environment |
| Claude runtime | `claude-runtime/` | Local TypeScript process that enrolls as a bridge device and executes Claude Code dispatches | Local/another machine | Connects outbound to backend; not a normal Railway web service |
| Hermes runtime worker | `hermes-runtime/` | Python worker wrapping Hermes `AIAgent` for local/dev HTTP worker mode | Local/another machine | Remote production mode is documented as websocket bridge mode |
| iOS app | `ios/`, `ClawChat/` | Native app client | Local/client device | Not a Railway or Vercel service |
| Shared contracts | `packages/contracts/` | Generated/shared API contracts | Build dependency | Used by web workspace |
| Web SDK | `packages/web-sdk/` | TypeScript client SDK | Build dependency | Used by web workspace |

## Production Domain Map

The beta launch domain mapping is:

| Host | Target | Current role |
|---|---|---|
| `relayconsole.work` | Vercel project `clawchat-web` | Canonical web frontend |
| `www.relayconsole.work` | Vercel project `clawchat-web` | Web frontend alias |
| `api.relayconsole.work` | Railway service `clawchat` | Backend REST API and websocket origin |

`clawchat.team` and `www.clawchat.team` may remain attached to the historical
Vercel project during transition, but they are not the beta launch canonical
domains.

As of the LOOP-0035 resume pass, Vercel and Railway have the new domains
registered, but DNS still needs to be changed at the domain provider before
`relayconsole.work` or `api.relayconsole.work` can be considered live.

## Backend

The backend is the Railway source of truth for API, websocket, database state, runtime dispatches, bridge enrollment, marketplace connections, and jobs.

It exposes:

- REST API under `/api/v1`
- Websocket gateway through the same backend origin
- Swagger docs at `/docs`
- Liveness checks at `/api/v1/health` and `/api/v1/health/live`
- Readiness check at `/api/v1/health/ready`, including a sanitized database check

The backend starts with:

```bash
pnpm run railway:start:prod
```

That command runs migrations and then starts `dist/main`.
The Nest app bootstrap does not run a second migration pass; Railway migration
execution is intentionally centralized in `dist/scripts/run-migrations.js`.

## Frontend

The web app is a Next.js 16 app in `web/`.

Important web behavior:

- Browser HTTP API calls should go to `/api/v1`.
- `next.config.mjs` rewrites `/api/v1/:path*` to `CLAWCHAT_RAILWAY_ORIGIN`.
- Realtime uses `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`.
- Production web builds require both backend variables, reject missing values,
  require `https:` for REST and `wss:` for websocket, and require both origins
  to share the same backend host.
- `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_BASE_URL` are retired and cause startup failure if set.

The web app deploys to Vercel project `clawchat-web` with root directory `web`.
The project uses the Next.js framework preset and Node.js 24.x. Production web
environment variables must include:

```bash
CLAWCHAT_RAILWAY_ORIGIN=https://api.relayconsole.work
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://api.relayconsole.work
```

Browser HTTP API calls still go to `/api/v1` and are rewritten by Next.js to the
Railway backend origin above. Do not set `NEXT_PUBLIC_API_BASE_URL` or
`NEXT_PUBLIC_WS_BASE_URL`.

## Database

Postgres is required. TypeORM migrations live in `backend/src/migrations/`.

The backend has many persisted entities under `backend/src/entities/`, including users, workspaces, agents, threads, messages, tasks, runtime dispatches, marketplace installs, bridge devices, audit logs, and tool requests.

## Queue

Redis is required. The backend configures Bull with `REDIS_URL`, `REDIS_PUBLIC_URL`, or Redis host/password variables.

## Websocket

The backend uses `@nestjs/platform-ws` and exposes realtime events from the backend origin. The web app connects to `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`.

## Bridge And Agent-Facing Services

The bridge/device model is backend-centered:

- Devices enroll through `/api/v1/bridge/enroll`.
- Devices authenticate through `/api/v1/bridge/device/auth`.
- Runtime bridges connect to the backend websocket and subscribe/register capabilities.

`claude-runtime/` is a local bridge client for Claude Code. Its config is stored under the operator's home directory, not in Railway.

`hermes-runtime/` documents two modes:

- Local/dev HTTP worker mode, where backend calls `HERMES_WORKER_BASE_URL`.
- Remote bridge mode, where a Hermes bridge runs on the machine with Hermes installed and connects outbound to Railway.

## Relationship To `clawchat-bridge-plugins`

This repo contains the ClawChat backend, web app, clients, and runtime examples. The companion plugin repo:

```bash
git@github.com:alexkerss-code/clawchat-bridge-plugins.git
```

is separate and should be cloned by the operator when setting up bridge/plugin runtimes. It is not a Railway-managed dependency of the backend Dockerfile or the web build in this repo.

NEEDS CONFIRMATION:

- Exact plugin installation/enrollment workflow from `clawchat-bridge-plugins`.
- Whether a given deployment needs Claude, Hermes, OpenClaw, or marketplace tool bridge devices at launch.
