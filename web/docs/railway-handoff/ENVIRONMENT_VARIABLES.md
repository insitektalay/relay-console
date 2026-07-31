# Environment Variables

This table is built from code usage in `backend/`, `web/`, `claude-runtime/`, `hermes-runtime/`, and `packages/`, plus checked-in `.env.example` files. Use placeholder values only. Do not copy secrets from an existing deployment.

Required count for the current Vercel web + Railway backend deployment,
assuming `DATABASE_URL` and `REDIS_URL` are used: **26**.

## Minimal Required Production Variables

Backend required in production:

- `NODE_ENV`
- `CORS_ORIGINS`
- `DATABASE_URL`
- `DATABASE_CA_CERT_BASE64`
- `DATABASE_TLS_SERVER_NAME`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_WS_SECRET`
- `JWT_ISSUER`
- `APP_ENCRYPTION_KEY`
- `APP_ENCRYPTION_KEY_VERSION`
- `ATTACHMENT_PROVENANCE_SECRET`
- `ATTACHMENT_SIGNING_SECRET`
- `CONNECTION_DESCRIPTOR_PRIVATE_KEY`
- `CONNECTION_DESCRIPTOR_PUBLIC_KEY`
- `RELAY_OPERATOR_API_SECRET`
- `AUDIT_IDENTIFIER_HASH_SECRET`
- `CLAWCHAT_BETA_INVITE_HASH_SECRET`
- `CLAWCHAT_BETA_INVITE_CODES`
- `CLAWCHAT_BETA_SIGNUP_MODE`
- `CLAWCHAT_MARKETPLACE_BETA_MODE`
- `CLAWCHAT_MARKETPLACE_ALLOWED_APPS`
- `CLAWCHAT_MARKETPLACE_BLOCKED_APPS`

Web required:

- `CLAWCHAT_RAILWAY_ORIGIN`
- `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`

Production web builds fail closed unless both web values are present. The REST
origin must use `https:`, the websocket origin must use `wss:`, both values must
be origins only, and both must target the same backend host.

Web-hosted Mission Control is retired under security ADR-042. Do not configure
`NEXT_PUBLIC_ENABLE_MISSION_CONTROL`,
`CLAWCHAT_ENABLE_MISSION_CONTROL_API`, `MISSION_CONTROL_ADMIN_SECRET`,
`OPENCLAW_WEBHOOK_SECRET`, `MISSION_CONTROL_PROFILE`,
`MISSION_CONTROL_REPOS_ROOT`, `MISSION_CONTROL_EXECUTION_REPOS_ROOT`, or
`MISSION_CONTROL_WSL_DISTRO`. The web build fails if any retired server
variable is present, while the public environment allowlist rejects the
retired public flag.

Current beta production domain values:

```bash
CORS_ORIGINS=https://relayconsole.work,https://www.relayconsole.work
PUBLIC_API_ORIGIN=https://api.relayconsole.work
BACKEND_PUBLIC_ORIGIN=https://api.relayconsole.work
CLAWCHAT_WEB_ORIGIN=https://relayconsole.work
PUBLIC_WEB_ORIGIN=https://relayconsole.work
FRONTEND_ORIGIN=https://relayconsole.work
CLAWCHAT_RAILWAY_ORIGIN=https://api.relayconsole.work
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://api.relayconsole.work
```

## Complete Variable Table

| Variable | Required/Optional | Where used | What it does | Example placeholder | Create own value? |
|---|---|---|---|---|---|
| `NODE_ENV` | Required for production | Backend, web | Enables production safety checks and production cookie/DB SSL behavior | `production` | Yes |
| `PORT` | Railway-provided | Backend, web service platform | Port the backend listens on; backend defaults to `3000` | `${{PORT}}` | Railway creates |
| `API_PREFIX` | Optional | Backend `main.ts` | REST API prefix | `api/v1` | Usually no |
| `CORS_ORIGINS` | Required for backend production | Backend `main.ts`, production assertion | Comma-separated allowed browser origins | `https://relayconsole.work,https://www.relayconsole.work` | Yes |
| `DATABASE_URL` | Required unless using individual DB vars | Backend TypeORM | Postgres connection URL | `${{Postgres.DATABASE_URL}}` | Railway creates |
| `DATABASE_CA_CERT_BASE64` | Required for production | Backend TypeORM, migrations, backup/restore, production rehearsals | Canonical base64 of the complete PEM root CA bundle pinned for the database; startup rejects malformed, non-CA, expired, oversized, or missing values | `base64-of-database-root-ca-pem` | Copy from the database service |
| `DATABASE_TLS_SERVER_NAME` | Required for production | Backend TypeORM, migrations, backup/restore, production rehearsals | Exact DNS/IP identity expected in the database server certificate; wildcards are rejected. Railway's stock `postgres-ssl` image currently uses `localhost` even when clients connect through its private service hostname. | `localhost` | Set from the inspected server certificate |
| `DATABASE_HOST` | Alternative to `DATABASE_URL` | Backend TypeORM, seed | Postgres host | `${{Postgres.PGHOST}}` | Railway creates |
| `DATABASE_PORT` | Alternative to `DATABASE_URL` | Backend TypeORM, seed | Postgres port | `${{Postgres.PGPORT}}` | Railway creates |
| `DATABASE_NAME` | Alternative to `DATABASE_URL` | Backend TypeORM, seed | Postgres database name | `${{Postgres.PGDATABASE}}` | Railway creates |
| `DATABASE_USER` | Alternative to `DATABASE_URL` | Backend TypeORM, seed | Postgres user | `${{Postgres.PGUSER}}` | Railway creates |
| `DATABASE_PASSWORD` | Alternative to `DATABASE_URL` | Backend TypeORM, seed | Postgres password | `${{Postgres.PGPASSWORD}}` | Railway creates |
| `REDIS_URL` | Required unless using individual Redis vars | Backend Bull and distributed security state | Redis connection URL for queues, one-use WebSocket tickets, and cross-instance rate limits | `${{Redis.REDIS_URL}}` | Railway creates |
| `REDIS_PUBLIC_URL` | Optional alternative | Backend Bull and distributed security state | Alternate Redis URL | `${{Redis.REDIS_PUBLIC_URL}}` | Railway creates |
| `REDIS_HOST` | Alternative to `REDIS_URL` | Backend Bull and distributed security state | Redis host | `${{Redis.REDISHOST}}` | Railway creates |
| `REDIS_PORT` | Alternative to `REDIS_URL` | Backend Bull | Redis port | `${{Redis.REDISPORT}}` | Railway creates |
| `REDIS_USER` | Optional Redis auth | Backend Bull | Redis username | `default` | Railway/user |
| `REDIS_PASSWORD` | Required with host-style Redis config in production | Backend Bull, production assertion | Redis password | `${{Redis.REDISPASSWORD}}` | Railway creates |
| `REDISHOST` | Optional Railway alias | Backend Bull | Redis host alias | `${{Redis.REDISHOST}}` | Railway creates |
| `REDISPORT` | Optional Railway alias | Backend Bull | Redis port alias | `${{Redis.REDISPORT}}` | Railway creates |
| `REDISUSER` | Optional Railway alias | Backend Bull | Redis user alias | `${{Redis.REDISUSER}}` | Railway creates |
| `REDISPASSWORD` | Optional Railway alias | Backend Bull | Redis password alias | `${{Redis.REDISPASSWORD}}` | Railway creates |
| `JWT_SECRET` | Required for backend production | Backend auth, bridge | Access token signing secret | `generate-a-long-random-secret` | Yes |
| `JWT_EXPIRES_IN` | Optional | Backend auth | Access token lifetime | `15m` | Yes |
| `JWT_REFRESH_SECRET` | Required for backend production | Backend auth | Refresh token signing secret | `generate-a-different-long-random-secret` | Yes |
| `JWT_REFRESH_EXPIRES_IN` | Optional | Backend auth | Refresh token lifetime | `30d` | Yes |
| `JWT_WS_SECRET` | Required for backend production | Backend auth/websocket/bridge | Websocket ticket signing secret | `generate-a-third-long-random-secret` | Yes |
| `JWT_ISSUER` | Required for backend production | Every backend JWT issuer and verifier | Canonical credential issuer; must be exactly the public Railway API prefix so tokens cannot cross deployment or credential-family boundaries | `https://api.relayconsole.work/api/v1` | No |
| `APP_ENCRYPTION_KEY_VERSION` | Required for backend production | Backend encryption service | Active version label for encrypted stored credentials | `v1` | Yes |
| `APP_ENCRYPTION_KEY` | Required for backend production | Backend encryption service | 32-byte key for AES-256-GCM stored secret encryption; use `base64:` for generated random bytes or `utf8:` for an exact 32-byte text key | `base64:base64-encoded-32-byte-key` | Yes |
| `APP_ENCRYPTION_KEYS` | Optional | Backend encryption service | Versioned key ring for rotations; keep old versions until stored credentials are re-saved | `v1:base64:old-base64-32-byte-key,v2:base64:new-base64-32-byte-key` | Yes if rotating |
| `ATTACHMENT_PROVENANCE_SECRET` | Required for backend production | Message attachment provenance | Signs provenance supplied by independently installed runtimes; must be at least 32 high-entropy bytes and distinct from every JWT/encryption/signing secret | `generate-distinct-attachment-provenance-secret` | Yes |
| `ATTACHMENT_SIGNING_SECRET` | Required for backend production | Relay Sync cloud attachments | Signs cloud attachment upload/download claims; must be at least 32 high-entropy bytes and must never reuse a JWT secret | `generate-distinct-attachment-download-signing-secret` | Yes |
| `CONNECTION_DESCRIPTOR_PRIVATE_KEY` | Required for backend production | Relay Cloud connection descriptors | Base64 DER PKCS#8 Ed25519 private key used to sign connection descriptors | `base64-pkcs8-ed25519-private-key` | Yes |
| `CONNECTION_DESCRIPTOR_PUBLIC_KEY` | Required for backend production | Relay Cloud clients | Base64 DER SPKI Ed25519 public key paired with the descriptor signing key | `base64-spki-ed25519-public-key` | Yes |
| `CONNECTION_DESCRIPTOR_KEY_ID` | Optional | Relay Cloud connection descriptors | Stable identifier for the active descriptor-signing key | `deployment-v1` | Yes |
| `RELAY_OPERATOR_API_SECRET` | Required for backend production | Operator-only billing/support endpoints | Authenticates bounded operator endpoints; must be at least 32 high-entropy bytes and distinct from application secrets | `generate-distinct-operator-secret` | Yes |
| `AUDIT_IDENTIFIER_HASH_SECRET` | Required for backend production | Audit privacy boundary | Dedicated HMAC key for anonymous account and client-network correlation tokens. It must be at least 32 high-entropy bytes, distinct from every other secret, and available only to the backend. Rotation intentionally ends cross-key correlation. | `generate-distinct-audit-identifier-secret` | Yes |
| `CLAWCHAT_BETA_INVITE_HASH_SECRET` | Required for backend production | Backend invite authentication | Dedicated HMAC key for persisted one-use invite hashes. It must be at least 32 high-entropy bytes and distinct from JWT, encryption, signing, and operator secrets so JWT rotation cannot reset invite consumption. | `generate-distinct-invite-hash-secret` | Yes |
| `RELAY_AUTH_AUDIT_RETENTION_DAYS` | Optional, maximum 30 | Backend retention job | Authentication audit retention in days. Defaults to 30; production rejects zero, fractional, negative, or greater values. | `30` | No |
| `RELAY_AUDIT_RETENTION_DAYS` | Optional, maximum 90 | Backend retention job | General audit retention in days. Defaults to 90; production rejects zero, fractional, negative, or greater values. | `90` | No |
| `CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS` | Optional only during controlled rotation | Backend invite startup migration and redemption | Comma-separated previous invite-hash keys. Keep only for the migration window; configured invite hashes migrate before traffic is accepted, and a legacy database-only invite migrates on first presentation. Every entry is strength- and uniqueness-validated. | `previous-invite-hash-secret` | Yes if rotating |
| `CLAWCHAT_BETA_INVITE_CODES` | Required for backend production | Backend auth, production assertion | Comma-separated high-entropy one-use invite seed codes when invite mode is enabled. The backend stores HMAC hashes in `beta_invites` and rejects reuse after `useCount >= maxUses`. | `replace-with-private-code` | Yes |
| `CLAWCHAT_BETA_SIGNUP_MODE` | Required for backend production | Backend auth, production assertion | Must remain `invite` for the current launch posture | `invite` | Yes |
| `CLAWCHAT_MARKETPLACE_BETA_MODE` | Required for backend production | Marketplace launch gate | Must be true so only the frozen release manifest can become connect-eligible | `true` | Yes |
| `CLAWCHAT_MARKETPLACE_ALLOWED_APPS` | Required for backend production | Marketplace launch gate | Explicit comma-separated allowlist; an empty value is invalid because the production validator requires the key to be non-empty | `github,linear` | Yes |
| `CLAWCHAT_MARKETPLACE_BLOCKED_APPS` | Required for backend production | Marketplace launch gate | Explicit comma-separated blocklist for disabled or unaccepted applications | `x,linkedin` | Yes |
| `BRIDGE_ACCESS_EXPIRES_IN` | Optional | Backend bridge | Bridge access token lifetime | `12h` | Yes |
| `BRIDGE_WS_EXPIRES_IN` | Optional | Backend bridge | Bridge websocket token lifetime | `12h` | Yes |
| `BRIDGE_ACCESS_EXPIRED_GRACE_IN` | Optional | Backend bridge | Expired bridge token grace window | `30d` | Yes |
| `THROTTLE_TTL` | Optional | Backend throttler | Global rate-limit TTL in seconds; high-risk auth, waitlist, bridge enrollment, and marketplace tool routes also have stricter code-level decorators | `60` | Yes |
| `THROTTLE_LIMIT` | Optional | Backend throttler | Global requests allowed per TTL; high-risk route caps are intentionally lower in code | `100` | Yes |
| `RATE_LIMIT_FALLBACK_CAPACITY` | Optional | Backend HTTP/WebSocket throttler | Maximum expiring process-local buckets retained during a Redis outage; distributed enforcement resumes when Redis returns | `10000` | Usually no |
| `REQUEST_BODY_LIMIT` | Optional | Backend `main.ts` | JSON/body parser size limit | `10mb` | Yes |
| `SEED_ON_START` | Optional | Backend `main.ts` | Must stay `false` or unset for beta/prod; production-like startup rejects destructive demo seeding | `false` | Yes |
| `SEED_DEMO_PASSWORD` | Optional | Backend seed | Password for seeded demo users | `replace-with-demo-password` | Yes if seeding |
| `CLAWCHAT_RAILWAY_ORIGIN` | Required for Vercel web | Web `next.config.mjs`, beta signup route | Railway backend HTTPS origin for `/api/v1` rewrites; must be an origin only and share the websocket host | `https://api.relayconsole.work` | Yes |
| `NEXT_PUBLIC_RAILWAY_WS_BASE_URL` | Required for Vercel web realtime | Web `next.config.mjs`, `lib/config.ts` | Public backend `wss:` websocket origin; must be an origin only and share the REST host | `wss://api.relayconsole.work` | Yes |
| `NEXT_PUBLIC_ENABLE_OPERATIONS` | Optional | Web config allowlist | Enables Operations UI surface | `false` | Yes |
| `NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT` | Optional | Web config allowlist | Enables condensed team chat UI | `false` | Yes |
| `NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT_REALTIME` | Optional | Web config allowlist | Enables condensed team chat realtime behavior | `false` | Yes |
| `NEXT_PUBLIC_ENABLE_AGENT_OPS` | Optional | Web config allowlist | Enables Agent Ops UI for workspace owners/admins | `false` | Yes |
| `NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS` | Optional/internal only | Web AgentOps UI | Enables AgentOps mock mode and event injection controls; keep `false` for public beta | `false` | Yes |
| `NEXT_PUBLIC_ENABLE_MARKETPLACE` | Optional | Web config allowlist | Enables Marketplace UI | `true` | Yes |
| `NEXT_PUBLIC_ENABLE_LOCAL_WORKSPACE_FILES` | Optional | Web config allowlist | Enables browser local workspace file UI | `false` | Yes |
| `NEXT_PUBLIC_POSTHOG_PROJECT_ID` | Optional | Web opt-in telemetry | Public PostHog project routing identifier; inert until the user opts in | `phc_public_project_id` | Yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional | Web opt-in telemetry | HTTPS PostHog ingestion host | `https://eu.i.posthog.com` | Yes |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Web opt-in error reporting | Public Sentry browser DSN; never use a Sentry auth token here | `https://public-id@o0.ingest.sentry.io/0` | Yes |
| `NEXT_PUBLIC_TELEMETRY_ENVIRONMENT` | Optional | Web opt-in telemetry | Non-sensitive deployment label attached to diagnostics | `production` | Yes |
| `SENTRY_AUTH_TOKEN` | Recommended for production web builds | Web build only | Secret CI token used to upload browser source maps; never exposed to client code and must be set with `SENTRY_ORG` and `SENTRY_PROJECT` | `secret-build-token` | Yes |
| `SENTRY_ORG` | Required when `SENTRY_AUTH_TOKEN` is set | Web build only | Sentry organization slug for source-map upload | `relay` | Yes |
| `SENTRY_PROJECT` | Required when `SENTRY_AUTH_TOKEN` is set | Web build only | Sentry web project slug for source-map upload | `relay-web` | Yes |
| `CLAWCHAT_ENABLE_INTERNAL_DEMO_ROUTES` | Optional | Web proxy | Opens internal demo/landing routes when `true` | `false` | Yes |
| `OPENCLAW_HOME` | Optional/local | Backend agent/workspace services | Overrides OpenClaw home path for local OpenClaw integration | `NEEDS CONFIRMATION` | Yes if used |
| `WSL_DISTRO_NAME` | Optional/local | Web runtime detection | WSL environment detection | `Ubuntu-22.04` | No |
| `WSL_INTEROP` | Optional/local | Web runtime detection | WSL environment detection | `NEEDS CONFIRMATION` | No |
| `RESEND_API_KEY` | Optional unless beta signup email is used | Web beta signup route | Sends beta signup email | `re_xxxxxxxxx` | Yes |
| `BETA_SIGNUP_TO_EMAIL` | Required if `RESEND_API_KEY` is set in production | Web beta signup route | Explicit destination email for beta signup messages; there is no personal fallback | `founder@example.com` | Yes |
| `BETA_SIGNUP_FROM_EMAIL` | Optional | Web beta signup route | From email for beta signup messages | `ClawChat <onboarding@example.com>` | Yes |
| `PUBLIC_API_ORIGIN` | Optional unless marketplace OAuth callbacks are used | Backend marketplace OAuth | Public backend origin for OAuth callback URLs | `https://api.relayconsole.work` | Yes |
| `BACKEND_PUBLIC_ORIGIN` | Optional alternative | Backend marketplace OAuth | Alternative public backend origin | `https://api.relayconsole.work` | Yes |
| `RAILWAY_PUBLIC_DOMAIN` | Optional fallback | Backend marketplace OAuth | Railway domain fallback used to derive public backend origin | `your-backend.up.railway.app` | Railway creates |
| `CLAWCHAT_WEB_ORIGIN` | Optional unless marketplace OAuth redirect-to-web is used | Backend marketplace OAuth | Public web origin for frontend redirects | `https://relayconsole.work` | Yes |
| `PUBLIC_WEB_ORIGIN` | Optional alternative | Backend marketplace OAuth | Alternative public web origin | `https://relayconsole.work` | Yes |
| `FRONTEND_ORIGIN` | Optional alternative | Backend marketplace OAuth | Alternative public web origin | `https://relayconsole.work` | Yes |
| `MICROSOFT_AUTHORITY_MODE` | Optional unless Outlook OAuth is used | Backend Outlook connector | Microsoft authority mode | `single_tenant` | Yes |
| `MICROSOFT_TENANT_ID` | Required if `MICROSOFT_AUTHORITY_MODE=single_tenant` | Backend Outlook connector | Entra tenant ID | `00000000-0000-0000-0000-000000000000` | Yes |
| `HERMES_WORKER_BASE_URL` | Optional unless using backend-to-Hermes HTTP worker | Backend Hermes worker client | HTTP worker base URL | `https://your-hermes-worker.example.com` | Yes if used |
| `HERMES_WORKER_SHARED_SECRET` | Required if HTTP Hermes worker is used | Backend Hermes worker client, Hermes worker | Bearer secret shared with Hermes worker | `generate-hermes-shared-secret` | Yes |
| `HERMES_HOME` | Required for Hermes worker process | Hermes Python worker | Isolated Hermes home directory | `/srv/hermes` | Yes |
| `HERMES_WORKER_HOST` | Optional for Hermes worker process | Hermes Python worker | Worker bind host | `0.0.0.0` | Yes |
| `HERMES_WORKER_PORT` | Optional for Hermes worker process | Hermes Python worker | Worker bind port | `8765` | Yes |
| `HERMES_WORKER_LOG_LEVEL` | Optional for Hermes worker process | Hermes Python worker | Logging level | `INFO` | Yes |
| `HERMES_WORKER_FAKE_MODE` | Optional/dev only | Hermes Python worker tests | Fake agent mode for testing worker behavior | `0` | Yes |
| `CLAUDE_CODE_LOCAL_CONTROL_TIMEOUT_MS` | Optional/local | Backend Claude service | Local Claude control timeout | `120000` | Yes |
| `CLAUDE_CODE_LOCAL_CONTROL_MAX_TURNS` | Optional/local | Backend Claude service | Local Claude control max turns | `8` | Yes |
| `CLAUDE_CODE_ANALYTICS_MODEL` | Optional | Backend thread analysis | Claude model for analytics | `sonnet` | Yes |
| `CLAUDE_CODE_ANALYTICS_TIMEOUT_MS` | Optional | Backend thread analysis | Analytics hard timeout | `180000` | Yes |
| `CLAUDE_CODE_ANALYTICS_SOFT_TIMEOUT_MS` | Optional | Backend thread analysis | Analytics soft timeout | `120000` | Yes |
| `CLAUDE_CODE_ANALYTICS_MAX_TURNS` | Optional | Backend thread analysis | Analytics max turns | `8` | Yes |
| `CONDENSED_TEAM_CHAT_SUMMARIZATION_ENABLED` | Optional | Backend message condensing | Enables backend condensed summary generation | `false` | Yes |
| `CONDENSED_TEAM_CHAT_REALTIME_ENABLED` | Optional | Backend message condensing, web flag exists separately | Enables realtime condensed behavior | `false` | Yes |
| `STRUCTURED_JOBS_DEFAULT_MODEL` | Optional | Backend structured jobs | Default model for structured runtime jobs | `gpt-5.1` | Yes |
| `STRUCTURED_JOBS_TIMEOUT_MS` | Optional | Backend structured jobs | Default structured job timeout | `180000` | Yes |
| `CONDENSED_SUMMARY_STRUCTURED_JOB_MODEL` | Optional | Backend message structured summary | Model override for condensed summaries | `gpt-5.1` | Yes |
| `CONDENSED_SUMMARY_STRUCTURED_JOB_TIMEOUT_MS` | Optional | Backend message structured summary | Timeout override for condensed summaries | `180000` | Yes |
| `WRAP_UP_STRUCTURED_JOB_MODEL` | Optional | Backend thread wrap-up | Model override for wrap-up jobs | `gpt-5.1` | Yes |
| `WRAP_UP_STRUCTURED_JOB_TIMEOUT_MS` | Optional | Backend thread wrap-up | Timeout override for wrap-up jobs | `180000` | Yes |
| `CONTRACT_GENERATE_STRICT` | Optional/dev | Contracts generation script | Strict generated contract checks when `1` | `1` | Yes |
| `NEXT_PUBLIC_API_BASE_URL` | Forbidden | Web config | Retired variable; app throws if set | Do not set | No |
| `NEXT_PUBLIC_WS_BASE_URL` | Forbidden | Web config | Retired variable; app throws if set | Do not set | No |

Manual DNS still required for beta launch:

- `A relayconsole.work 76.76.21.21`
- `A www.relayconsole.work 76.76.21.21`
- `CNAME api.relayconsole.work kew44hy5.up.railway.app`
- `TXT _railway-verify.api.relayconsole.work railway-verify=9c4939b48957087154f91bb9e8b9f8cc2a7981028c34ede3b5cc2075a56748d6`
  if Railway still reports ownership validation pending

Remaining confirmation items:

- Which optional marketplace OAuth connectors must be configured at launch.
- Exact production bridge/plugin env vars from `clawchat-bridge-plugins`.
