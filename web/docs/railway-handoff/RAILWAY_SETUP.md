# Railway Backend And Vercel Web Setup

These instructions are based on the beta launch deployment split:

- Railway runs the backend/API service, Postgres, and Redis.
- Vercel runs the web frontend.
- The web frontend still uses the Railway backend as the source of truth through
  `/api/v1` rewrites and the Railway websocket origin.

Production and preview web runtimes preserve the browser `Origin` header across
the `/api/v1` Railway rewrite. Request `Host` and forwarded-host values never
alter that behavior. Only the framework's exact development runtime mode may
remove Origin for the server-side rewrite; this does not introduce or select a
local backend.

## 1. Clone And Install

```bash
git clone git@github.com:alexkerss-code/clawchat.git
cd clawchat
pnpm install
```

Package manager: `pnpm@10.29.2` from root `package.json`.

## 2. Railway Backend Project

1. In Railway, create a new project.
2. Add a Postgres service.
3. Add a Redis service.
4. Add a backend service from the GitHub repo.

Do not create a Railway web service for the beta frontend. Use Vercel project
`clawchat-web` with root directory `web`.

## 3. Backend Service

Create a Railway service connected to the GitHub repo.

Backend settings:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Builder | Dockerfile, via `backend/railway.json` |
| Dockerfile path | `Dockerfile` relative to `backend` |
| Build command | Railway uses `backend/Dockerfile`; Dockerfile runs a frozen pnpm install and `pnpm run build` |
| Start command | `pnpm run railway:start:prod` from `backend/railway.json` |
| App port | Backend reads `PORT` or defaults to `3000`; Dockerfile exposes `3000`; Railway should inject `PORT` |
| API prefix | `api/v1` unless `API_PREFIX` is changed |
| Health check path | `/api/v1/health` |

`backend/railway.json`:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "pnpm run railway:start:prod"
  }
}
```

Backend deployment notes:

- Run/deploy from `backend/` so `backend/railway.json` applies.
- `pnpm run railway:start:prod` runs `node dist/scripts/run-migrations.js && node dist/main`.
- `dist/main` does not run a second migration pass; the dedicated migration
  script is the single Railway startup migration runner.
- Set `NODE_ENV=production` for Railway production.
- Set `CORS_ORIGINS=https://relayconsole.work,https://www.relayconsole.work`
  for beta launch, plus any intentional temporary transition aliases.
- Connect backend to Railway Postgres with `DATABASE_URL` or the individual `DATABASE_*` variables.
- Connect backend to Railway Redis with `REDIS_URL`, `REDIS_PUBLIC_URL`, or individual Redis variables.

## 4. Postgres Service

Use Railway Postgres. The backend uses TypeORM and Postgres.

Recommended backend variable:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Alternative supported variables are `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, and `DATABASE_PASSWORD`.

## 5. Redis Service

Use Railway Redis. The backend uses Bull queues through `@nestjs/bull`.

Recommended backend variable:

```bash
REDIS_URL=${{Redis.REDIS_URL}}
```

Supported alternatives include `REDIS_PUBLIC_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER`, and `REDIS_PASSWORD`. Railway-style aliases `REDISHOST`, `REDISPORT`, `REDISUSER`, and `REDISPASSWORD` are also read by the backend.

## 6. Vercel Web Frontend

The web app lives in `web/` and is a Next.js 16 app deployed on Vercel project
`clawchat-web`.

Actual web scripts:

```json
{
  "build": "next build",
  "start": "next start --hostname localhost --port 3033"
}
```

Vercel project settings:

| Setting | Value |
|---|---|
| Root directory | `web` |
| Framework preset | Next.js |
| Node.js version | 24.x |
| Build command | `npm run build` or `next build`, as configured by Vercel |
| Production domains | `relayconsole.work`, `www.relayconsole.work` |

Required web backend configuration:

```bash
CLAWCHAT_RAILWAY_ORIGIN=https://api.relayconsole.work
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://api.relayconsole.work
```

Both values are required for production web builds. `CLAWCHAT_RAILWAY_ORIGIN`
must use `https:`, `NEXT_PUBLIC_RAILWAY_WS_BASE_URL` must use `wss:`, both
values must be origins only, and both must target the same backend host. Do not
set `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_WS_BASE_URL`. The app throws if
either retired variable is set.

Domain records still need to be managed at the domain provider:

```text
A relayconsole.work 76.76.21.21
A www.relayconsole.work 76.76.21.21
CNAME api.relayconsole.work kew44hy5.up.railway.app
TXT _railway-verify.api.relayconsole.work railway-verify=9c4939b48957087154f91bb9e8b9f8cc2a7981028c34ede3b5cc2075a56748d6
```

The TXT record is needed only while Railway reports custom-domain ownership
validation pending.

## 7. Runtime And Bridge Components

Do not create Railway services for local runtime bridges unless the operator explicitly wants that and has reviewed the runtime requirements.

- `claude-runtime/` is a local machine TypeScript runtime that connects outward to the Railway backend over REST and websocket.
- `hermes-runtime/` is a Python HTTP worker for local/dev Hermes usage; production remote Hermes use is documented as websocket bridge mode.
- The companion repo `clawchat-bridge-plugins` is expected to contain bridge/plugin code used on the machine where bridge runtimes run.

## 8. Verify Backend

After backend deploy:

```bash
curl https://api.relayconsole.work/api/v1/health
curl https://api.relayconsole.work/api/v1/health/ready
```

Expected JSON:

```json
{
  "ok": true,
  "status": "live",
  "service": "clawchat-backend",
  "checkedAt": "..."
}
```

Also check Railway logs for:

- migrations completed
- `ClawChat backend listening on port ...`
- no production environment assertion failures
- no Postgres or Redis connection errors

If `api.relayconsole.work` DNS is not live, treat that as a launch blocker for
web beta traffic. Do not configure the production web build to use an old
Railway service hostname as a fallback.
