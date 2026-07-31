# Deployment Checklist

## Clone And Inspect

- [ ] Clone `git@github.com:alexkerss-code/clawchat.git`.
- [ ] Run `pnpm install` from repo root.
- [ ] Read `docs/railway-handoff/README.md`.
- [ ] Read `docs/railway-handoff/SERVICES_AND_ARCHITECTURE.md`.
- [ ] Read `docs/railway-handoff/ENVIRONMENT_VARIABLES.md`.
- [ ] Confirm the beta domain map:
  `relayconsole.work` and `www.relayconsole.work` on Vercel web,
  `api.relayconsole.work` on Railway backend.

## Railway Project

- [ ] Create a new Railway project owned by the deploying user.
- [ ] Add Railway Postgres.
- [ ] Add Railway Redis.
- [ ] Add backend service connected to the GitHub repo.
- [ ] Set backend root directory to `backend`.
- [ ] Confirm backend uses `backend/railway.json`.

## Backend Env Vars

- [ ] Set `NODE_ENV=production`.
- [ ] Set `CORS_ORIGINS=https://relayconsole.work,https://www.relayconsole.work`.
- [ ] Set `DATABASE_URL` from Railway Postgres.
- [ ] Set `REDIS_URL` from Railway Redis.
- [ ] Generate and set `JWT_SECRET`.
- [ ] Generate and set `JWT_REFRESH_SECRET`.
- [ ] Generate and set `JWT_WS_SECRET`.
- [ ] Set `JWT_ISSUER=https://api.relayconsole.work/api/v1` exactly; do not
      use a Railway deployment hostname or trailing slash.
- [ ] Generate and set `APP_ENCRYPTION_KEY` as `base64:<base64-encoded-32-random-bytes>`.
- [ ] Set `APP_ENCRYPTION_KEY_VERSION=v1`.
- [ ] Generate and set a distinct `CLAWCHAT_BETA_INVITE_HASH_SECRET` before the
      first deployment; do not reuse any JWT or encryption key.
- [ ] Set `CLAWCHAT_BETA_INVITE_CODES` to high-entropy one-use invite seed
      codes; do not use placeholders or short values.
- [ ] For an existing database, keep the current JWT/encryption keys unchanged
      for this deployment and confirm startup migrates configured legacy invite
      hashes before rotating authentication keys.
- [ ] Keep `SEED_ON_START=false` or unset. Production-like startup rejects
      destructive demo seeding.

## Backend Deploy

- [ ] Deploy backend from `backend/`.
- [ ] Before deploying against an existing beta database, verify migrations
      `003` through `008` are already present in the Railway `migrations` table
      or prove their protected target tables are empty.
- [ ] Confirm logs show migrations completing.
- [ ] Confirm logs show `ClawChat backend listening on port ...`.
- [ ] Confirm no production environment assertion errors.
- [ ] Confirm no Postgres connection errors.
- [ ] Confirm no Redis connection errors.
- [ ] Add Railway custom domain `api.relayconsole.work` to backend service
  `clawchat`.
- [ ] At the DNS provider, add Railway traffic record:
  `CNAME api.relayconsole.work kew44hy5.up.railway.app`.
- [ ] At the DNS provider, add Railway ownership verification if Railway still
  reports ownership validation pending:
  `TXT _railway-verify.api.relayconsole.work railway-verify=9c4939b48957087154f91bb9e8b9f8cc2a7981028c34ede3b5cc2075a56748d6`.
- [ ] Open `https://api.relayconsole.work/api/v1/health`.
- [ ] Open `https://api.relayconsole.work/api/v1/health/ready`.
- [ ] Treat unresolved `api.relayconsole.work` DNS as a launch blocker for web
  beta traffic; do not point production web builds at an old Railway service
  hostname as a fallback.
- [ ] Run `CLAWCHAT_RAILWAY_ORIGIN=https://api.relayconsole.work CLAWCHAT_WEB_ORIGIN=https://relayconsole.work NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://api.relayconsole.work node scripts/check-beta-health.mjs` from repo root after DNS resolves. This checks direct backend health/readiness plus the deployed web `/api/v1` rewrite.
- [ ] If a smoke account is available, rerun the same command with `CLAWCHAT_BETA_SMOKE_EMAIL`, `CLAWCHAT_BETA_SMOKE_PASSWORD`, and optional `CLAWCHAT_BETA_SMOKE_WORKSPACE_ID` set to verify browser login, websocket ticket issuance, and the authenticated Railway websocket event.

Expected backend success sign:

```json
{
  "ok": true,
  "status": "live",
  "service": "clawchat-backend",
  "checkedAt": "..."
}
```

Expected ready success sign:

```json
{
  "ok": true,
  "status": "ready",
  "service": "clawchat-backend",
  "checks": {
    "database": { "ok": true }
  }
}
```

If Postgres is unavailable, `/api/v1/health/ready` should return HTTP 503 with
`"ok": false` and a sanitized `database_unavailable` check.

## Web Deploy

- [ ] Use Vercel project `clawchat-web`; do not create a Railway web service.
- [ ] Confirm Vercel root directory is `web`.
- [ ] Confirm Vercel framework preset is Next.js.
- [ ] Confirm Vercel Node.js version is 24.x.
- [ ] Set `CLAWCHAT_RAILWAY_ORIGIN=https://api.relayconsole.work`.
- [ ] Set `NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://api.relayconsole.work`.
- [ ] Confirm `CLAWCHAT_RAILWAY_ORIGIN` uses `https:`,
  `NEXT_PUBLIC_RAILWAY_WS_BASE_URL` uses `wss:`, both values are origins only,
  and both target the same backend host.
- [ ] Keep `NEXT_PUBLIC_ENABLE_AGENT_OPS=false` unless Agent Ops HQ is reviewed for external testers; when enabled it is workspace owner/admin only.
- [ ] Keep `NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS=false` for public beta so mock mode and event injection controls are not exposed.
- [ ] Keep `NEXT_PUBLIC_ENABLE_OPERATIONS=false` and `NEXT_PUBLIC_ENABLE_LOCAL_WORKSPACE_FILES=false` for public beta unless explicitly reviewed.
- [ ] If `NEXT_PUBLIC_ENABLE_MARKETPLACE=true`, confirm the Railway backend has `CLAWCHAT_MARKETPLACE_BETA_MODE=true` plus the reviewed allowlist/blocklist.
- [ ] Confirm Railway Marketplace catalog failures show the web error/retry state; the retired seeded demo catalog must not be present.
- [ ] Remove every retired Mission Control UI/API flag, secret, OpenClaw webhook secret, and local profile/path variable from Vercel; the build must fail if any remains.
- [ ] Keep `CLAWCHAT_ENABLE_INTERNAL_DEMO_ROUTES=false` for public beta.
- [ ] Do not set `NEXT_PUBLIC_API_BASE_URL`.
- [ ] Do not set `NEXT_PUBLIC_WS_BASE_URL`.
- [ ] Add `relayconsole.work` and `www.relayconsole.work` to Vercel project
  `clawchat-web`.
- [ ] At the DNS provider, set `relayconsole.work` to Vercel's required apex
  record: `A relayconsole.work 76.76.21.21`.
- [ ] At the DNS provider, set `www.relayconsole.work` to Vercel's required
  alias record: `A www.relayconsole.work 76.76.21.21`.
- [ ] Deploy web through Vercel.

Expected web success signs:

- [ ] `https://relayconsole.work/` loads the public landing page.
- [ ] `https://relayconsole.work/app` loads the authenticated app shell.
- [ ] Browser API requests use `/api/v1/...`.
- [ ] Backend receives requests from the deployed web origin.
- [ ] Websocket connects to the Railway backend origin.

## Critical Flows

- [ ] Register or log in with a beta invite code.
- [ ] Confirm auth cookies/session work after page refresh.
- [ ] Load workspace data.
- [ ] Create or inspect agents/teams/threads as applicable.
- [ ] Send a message in a thread.
- [ ] Confirm realtime updates arrive over websocket.
- [ ] Confirm backend logs remain clean during the above.
- [ ] If marketplace is enabled, open Marketplace and verify catalog loads.
- [ ] If bridge/runtime is needed, enroll a bridge device and confirm heartbeat/registration.

## Common Failure Points

- Backend fails startup because required production env vars are missing.
- `CORS_ORIGINS` does not include `https://relayconsole.work` and any
  intentionally supported alias such as `https://www.relayconsole.work`.
- `APP_ENCRYPTION_KEY` is not exactly 32 bytes after decoding. Prefer a `base64:`-prefixed 32-byte random key.
- Redis variable points to the wrong Railway Redis URL or lacks password.
- Web accidentally sets retired `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_WS_BASE_URL`.
- Web production build is missing `CLAWCHAT_RAILWAY_ORIGIN` or
  `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`, or those values have different hosts.
- Web points to the old Railway service domain after `api.relayconsole.work` is
  live, or points to a loopback backend.
- Vercel deployment is ready but `relayconsole.work` still resolves to the old
  DNS target instead of Vercel.
- `api.relayconsole.work` does not resolve to Railway, causing web `/api/v1`
  rewrites to fail.
- Marketplace OAuth callbacks fail because `PUBLIC_API_ORIGIN` or `CLAWCHAT_WEB_ORIGIN` is not set.
- Bridge/runtime agents do not appear because no local bridge device is enrolled and connected.
