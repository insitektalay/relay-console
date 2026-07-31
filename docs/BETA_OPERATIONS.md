# ClawChat Beta Operations

## Required Checks

- `pnpm run workflow:security:check` and
  `pnpm run test:workflow-security` must pass. Every workflow is verification-
  only, grants only `contents: read`, uses full action commit SHAs, and disables
  checkout credential persistence. The harness signing workflow additionally
  requires the protected `harness-release-signing` environment.
- Web beta readiness must pass `pnpm run verify:web:beta` from the repository
  root with `CLAWCHAT_RAILWAY_ORIGIN` and
  `NEXT_PUBLIC_RAILWAY_WS_BASE_URL` set to the Railway beta origins.
- The web package also exposes targeted checks: `pnpm run test:web`,
  `pnpm run test:web:security`, `pnpm run test:web:marketplace`,
  `pnpm run lint:web:ci`, and `pnpm run audit:web:prod`.
- Web production build, typecheck, lint warning budget, marketplace tests,
  AgentOps tests, security regression tests, and webpack production build are
  wired into `.github/workflows/web-beta-readiness.yml`. The workflow also runs
  the canonical `pnpm --dir web build` path separately so Turbopack build and
  tracing warnings remain visible in CI.
- Backend production build must pass `npm run build`.
- `pnpm run test:production-secret-audit` and
  `pnpm run test:production-secret-provider` must pass. Railway production
  startup runs the same value-free audit before migrations; final release
  promotion additionally requires an exact-commit provider evidence capture.
- Railway deployment health check: anonymous `GET /api/v1/health/live` returns
  exactly `{ "ok": true, "status": "live" }`. Operator readiness is
  `GET /api/v1/health/ready` with `RELAY_OPERATOR_API_SECRET` sent only in the
  `x-relay-operator-secret` header; it returns HTTP 503 with a sanitized
  degraded body when Postgres, Redis, or the message-condensing Bull queue is
  unavailable.
- Railway deployment must run from `backend/` so `backend/railway.json` starts
  migrations before the API. The dedicated Railway migration script is the
  single startup migration runner; the Nest app bootstrap does not run a second
  migration pass.
- Keep `SEED_ON_START=false` for beta and production. Production-like backend
  startup rejects destructive seed flags, and direct seed execution refuses to
  run against production-like Railway environments.
- Before a backend deploy against an existing beta database, verify the
  migration table contains historical destructive migrations `003` through `008`
  or prove their protected tables are empty. Pending destructive historical
  migrations fail closed in production-like Railway environments when protected
  tables contain rows.

## Production Domains

Current beta launch mapping:

- `https://relayconsole.work` - Vercel web frontend.
- `https://www.relayconsole.work` - Vercel web frontend alias, if enabled.
- `https://api.relayconsole.work` - Railway backend/API and websocket origin.

The historical `clawchat.team` Vercel aliases may remain during transition, but
`relayconsole.work` is the beta launch target.

Production web builds must set `CLAWCHAT_RAILWAY_ORIGIN=https://api.relayconsole.work`
and `NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://api.relayconsole.work`. The web build
rejects missing values, path/query/hash suffixes, non-`https:` REST origins,
non-`wss:` websocket origins, and REST/websocket hosts that do not match.

## Web Content Security Policy

The production Next.js 16 App Router CSP is generated for every document
request in `web/proxy.ts`. Proxy creates a per-request cryptographic nonce,
forwards the exact CSP and nonce to dynamic rendering, and returns the same CSP
header to the browser. Next applies the nonce to framework bootstrap, React
Server Components, metadata, and page scripts. The root layout fails closed if
the nonce is absent or malformed.

Required invariants:

- Production `script-src` contains only `'self'`, the current nonce, and
  `'strict-dynamic'`; it never contains `'unsafe-inline'` or `'unsafe-eval'`.
- Development may add `'unsafe-eval'` for React diagnostics but still does not
  add the inline-script bypass.
- `script-src-attr 'none'`, `object-src 'none'`, `frame-ancestors 'none'`,
  `frame-src 'none'`, and `base-uri 'self'` remain required.
- `style-src 'self' 'unsafe-inline'` also governs style attributes because the
  React/Next interface emits inline layout styles. Do not add
  `style-src-attr 'none'`: browsers give that directive precedence and it
  visibly breaks the production interface. Customer-supplied HTML remains
  independently sanitized as described below.
- Sanitized HTML replies still forbid `script`, `iframe`, `img`, event-handler
  attributes, and inline `style` attributes; scoped style blocks remain
  separately sanitized.
- Document responses are dynamic and `private, no-store`; do not cache or
  replay nonce-bearing HTML at a CDN. Static assets and API rewrites remain
  outside the document nonce path.
- `web/security/security-headers-regression.test.ts` verifies nonce entropy and
  uniqueness, exact request/response propagation, strict production sources,
  Railway-only connections, malicious-origin rejection, and layout fail-close.

Railway backend deployments must set `NODE_ENV=production`. Backend startup runs
the production safety assertions for production-like Railway environments even if
`NODE_ENV` is mis-set, and will fail closed rather than skipping secret, CORS,
invite, Redis, marketplace, docs, cookie, logging, and database safety gates.
Before a CLI deployment, stage the exact integrated commit in
`RELAY_RELEASE_COMMIT` and a truthful reviewed
`RELAY_SECRET_LIFECYCLE_JSON` without triggering a separate deployment, then
use that same full commit in the Railway deployment message. After the exact
Vercel production deployment is ready,
`pnpm production-secrets:provider --capture --source-commit <commit>` must
pass. It binds effective in-runtime strength, separation, and lifecycle results
to stable Railway topology and metadata-only Vercel records. Never use
`railway variables` for this evidence and never archive a provider response
containing a value-like field. The full no-value ceremony is in
`docs/operational-security-runbook.md`.

Required DNS records before launch:

- `A relayconsole.work 76.76.21.21`
- `A www.relayconsole.work 76.76.21.21`
- `CNAME api.relayconsole.work kew44hy5.up.railway.app`
- `TXT _railway-verify.api.relayconsole.work railway-verify=9c4939b48957087154f91bb9e8b9f8cc2a7981028c34ede3b5cc2075a56748d6`
  if Railway still reports ownership validation pending

## Monitoring

- Backend logs: use Railway service logs for deploy, migration, request, auth, rate-limit, health/readiness, and runtime errors.
- Uptime: public monitors may poll `GET /api/v1/health/live` on the Railway
  backend and the deployed web URL `/`. Detailed readiness and synthetic
  monitoring require the operator-secret header and must run only in a
  credential-safe monitor that does not log request headers.
- Auth/security audit events: login failures, session revocation, email
  verification, password-reset request/delivery/completion, and billing events
  are recorded without action tokens or payment secrets. Anonymous account and
  network identifiers are non-reversible HMAC tokens using the dedicated
  `AUDIT_IDENTIFIER_HASH_SECRET`; do not expose that key to dashboards or
  support tools. Auth events expire after at most 30 days and other audit events
  after at most 90 days.
- Account lifecycle monitoring: monitor `auth.password_reset.email_failed` and
  transactional-email provider health. Account deletion is self-service and
  requires password reauthentication, exact confirmation, no active Relay Cloud
  subscription, and no non-owned workspace membership.
- Billing and entitlement monitoring: poll the operator-only
  `GET /api/v1/operator/billing-observability` route with the operator secret
  held by the monitoring service. The response contains aggregate subscription,
  cancellation, failed/stuck event, payment-attention, and entitlement-mismatch
  counts. It excludes workspace and provider identifiers, email addresses,
  payload hashes, customer content, and secret values. Alert on any returned
  alert code. Relay treats Stripe and Apple as the source of truth for currency
  revenue because the Relay subscription table does not store price, currency,
  or tax amounts.
- Bridge, runtime, and Marketplace monitoring: poll the operator-only
  `GET /api/v1/operator/operations-observability` route with the same secret.
  It reports aggregate active/recent/stale bridge-device counts, failed or
  stuck bridge events, runtime binding/dispatch health, and OAuth denial or
  refresh-failure counts. It never returns workspace, device, provider
  connection, payload, error-message, customer-content, or secret values.
  Alert on failed/stuck bridge events, stuck runtime dispatches, and OAuth
  refresh failures. A user-managed runtime host being offline is a customer
  availability signal and is reported, but is not by itself a Relay platform
  outage. User-denied OAuth consent is also reported without raising an
  operational alert.
- Rate-limit abuse signals: backend throttling writes redacted `security.rate_limit.exceeded` log events with controller, handler, route, limit, TTL, reset time, and a hashed tracker. The hash lets operators correlate bursts without exposing raw IPs or tokens.
- Frontend errors: the web app always maintains a redacted local support buffer
  with the latest 25 `web.client.error` and
  `web.client.unhandled_rejection` events. It only sends sanitized browser
  errors to Sentry after opt-in, and only when `NEXT_PUBLIC_SENTRY_DSN` is
  configured. Query strings, hash fragments, credentials, email addresses,
  request data, replay, screenshots, performance traces and default browser
  integrations are excluded. `window.clawChatSupportSnapshot()` remains
  available for tester/support capture from DevTools regardless of consent.

### Frontend Browser Error Support Model

For beta incidents where the browser UI fails but Railway health is normal:

1. Ask the tester to note the UTC time, supported desktop browser, and visible page path only.
2. Ask the tester to open DevTools Console and copy redacted `web.client.*` JSON lines, or run:

   ```js
   window.clawChatSupportSnapshot?.();
   ```

3. Confirm the snapshot contains only `supportModel`, `capturedAt`, `pagePath`,
   `eventCount`, and redacted `recentEvents`.
4. Check whether the tester enabled **Share crash and error reports** in
   Settings > Privacy. Sentry evidence is expected only when that choice was
   enabled before the failure.
5. Do not ask for screenshots or pasted console output that includes passwords,
   pairing codes, bearer tokens, OAuth tokens, API keys, cookies, local storage,
   session storage, or full URLs with query strings.
6. Escalate to engineering with the redacted snapshot, Railway health/readiness
   status, and the deploy/build version being tested.

## Runtime Operator Visibility

Workspace owners/admins can inspect generic runtime state through:

```text
GET /api/v1/workspaces/<workspace-id>/agent-ops/runtime-overview?dispatchLimit=50&sessionLimit=50&windowHours=24
```

Use it when triaging Hermes/OpenClaw/Claude runtime binding health, active
runtime sessions, recent dispatches, terminal state counts, and failure buckets
by runtime type/error code. The response is designed for operator screens and
support evidence capture:

- binding rows include runtime type, adapter kind, routing mode, health status,
  capability keys, and sanitized last-error text
- active session rows include agent/thread context and sanitized session errors
- recent dispatch rows include status, latest tool/status/context-usage signals,
  terminal timestamps, and sanitized failure text
- summaries include runtime type counts, binding health counts, terminal states,
  and failure buckets

Do not paste bearer tokens, pairing codes, OAuth/API credentials, or raw runtime
logs into incident notes. The endpoint omits raw runtime `resultMetadata` and
binding `configMetadata`; keep that boundary if building an in-app screen on top
of it.

## Runtime User Controls

The thread UI surfaces runtime participant health events for agents in the
active thread. Failed runtime dispatches show runtime type, error code,
retryability, and sanitized failure details where the runtime provides them.

Active runtime dispatches can be cancelled from the thread UI. Cancellation uses
`POST /api/v1/dispatches/<dispatch-id>/cancel`; the backend verifies workspace
access for the dispatch before delegating to the runtime coordinator. Retry is
available only when the runtime marked the failure retryable and the dispatch
event carries the source user message id, so the web app can submit a new
message through the normal ClawChat message API.

Operators can run the local health smoke script after deploy:

```bash
CLAWCHAT_BETA_HEALTH_STRICT=true \
CLAWCHAT_RAILWAY_ORIGIN=https://api.relayconsole.work \
CLAWCHAT_WEB_ORIGIN=https://relayconsole.work \
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://api.relayconsole.work \
RELAY_OPERATOR_API_SECRET=<secret-from-credential-store> \
node scripts/check-beta-health.mjs
```

The script refuses loopback backend, web, and websocket origins for beta checks.
When `CLAWCHAT_WEB_ORIGIN` is set, it checks both the deployed web root and the
web-origin `/api/v1/health` plus protected `/api/v1/health/ready` rewrites. The
script places the operator secret only in the request header and never in its
JSON evidence. For launch evidence, set `CLAWCHAT_BETA_HEALTH_STRICT=true` or
pass `--strict`; strict mode exits nonzero if the operator secret, web rewrite
checks, or authenticated websocket smoke are skipped.

To add an authenticated websocket smoke, provide a tester-owned smoke account
through environment variables. Do not print these values or commit them:

```bash
CLAWCHAT_BETA_SMOKE_EMAIL=<tester-email> \
CLAWCHAT_BETA_SMOKE_PASSWORD=<tester-password> \
CLAWCHAT_BETA_SMOKE_WORKSPACE_ID=<optional-workspace-id> \
RELAY_OPERATOR_API_SECRET=<operator-secret-from-secret-manager> \
CLAWCHAT_BETA_HEALTH_STRICT=true \
CLAWCHAT_RAILWAY_ORIGIN=https://api.relayconsole.work \
CLAWCHAT_WEB_ORIGIN=https://relayconsole.work \
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://api.relayconsole.work \
node scripts/check-beta-health.mjs
```

If `CLAWCHAT_BETA_SMOKE_WORKSPACE_ID` is omitted, the script logs in through the
web `/api/v1/auth/web/login` rewrite, discovers the first accessible workspace,
requests `/api/v1/auth/ws-ticket`, connects to the Railway websocket with the
short-lived ticket, and waits for the `authenticated` websocket event. The JSON
output reports only statuses, timings, step names, and redacted URLs; it does not
print passwords, cookies, websocket tickets, operator secrets, provider
identifiers, or user email addresses. Strict mode treats a missing operator
secret as a skipped required check. A billing snapshot with failed/stuck events,
payment attention, or entitlement mismatches fails the smoke. The operations
snapshot also fails the smoke on failed/stuck bridge events, stuck runtime
dispatches, or OAuth refresh failures, while preserving the user-managed host
boundary described above.

## Support And Incident Runbooks

Use `docs/beta-support-incident-runbooks.md` for:

- login, email-verification, and password-reset failure triage
- Stripe/Apple billing and Relay entitlement reconciliation
- bridge pairing failure triage, evidence capture, recovery, and escalation
- runtime-offline and non-responding-agent recovery without duplicate execution
- Marketplace OAuth/connection failure and compromised-provider containment
- compromised runtime-device revocation and clean re-enrollment
- marketplace app removal containment, install unconfiguration, verification,
  and rollback criteria
- authenticated export/deletion support without bypassing ownership or billing
- Relay Cloud/web outage communication, compatible rollback, and closure
- isolated backup restore and data-recovery incident handling

Use `docs/beta-auth-account-lifecycle.md` for:

- invite-only signup and invite-code administration
- browser session login, refresh, logout, and revocation behavior
- waitlist, password-reset support, account export, and account deletion request
  behavior

## Rate Limiting And Abuse Review

The backend installs the Nest throttler as a global guard backed by atomic
Redis counters with TTL, shared across Railway instances. WebSocket per-client
and per-socket message counters use the same distributed store. The
Railway-aware tracker accepts Railway's normalized `X-Real-IP` only when the
direct peer is a private/internal proxy; a direct public peer cannot override
its address. It never trusts `X-Forwarded-For` or `CF-Connecting-IP`.
`THROTTLE_TTL` and `THROTTLE_LIMIT` set the global default.

During a Redis outage the backend continues enforcing with an expiring
process-local map capped by `RATE_LIMIT_FALLBACK_CAPACITY` (default 10,000).
This degraded mode is deliberately bounded and logged. Treat the log as an
incident because limits are no longer aggregated across instances until Redis
recovers.

Stricter route-level throttles are applied to:

- account registration, browser registration, login, browser login, email verification, and password-reset requests/completion
- public waitlist signup
- one-time bridge enrollment creation and redemption
- marketplace needed-tool requests
- bridge/runtime marketplace tool execution endpoints

For abuse review during beta:

- review `auth.login.failed`, `auth.register.failed`, password-reset request, bridge enrollment failure, and bridge enrollment creation audit events
- review Railway logs for repeated `security.rate_limit.exceeded` events grouped by controller/handler and hashed tracker
- investigate repeated bridge enrollment failures before increasing pairing limits
- investigate marketplace tool-call bursts before increasing global `THROTTLE_LIMIT`
- do not paste raw IPs, bearer tokens, pairing codes, or device tokens into incident notes

## Database Backups

- Railway Postgres backups must be enabled before inviting external testers.
- Treat beta invite codes, JWT secrets, attachment provenance secrets,
  encryption keys, database credentials, Redis credentials, bridge secrets,
  OAuth client secrets, and webhook secrets as server-only values.

## Verified Database TLS

Production startup, TypeORM migrations, cloud backup/restore, and every
production database rehearsal fail closed unless the database presents a
certificate chained to the explicitly pinned CA and carrying the configured
certificate identity. `DATABASE_URL` must not contain `sslmode`, `sslrootcert`,
or any other SSL query parameter because those parameters can replace the
application's verified TLS policy.

For Railway's stock `postgres-ssl` service:

1. Inspect `/var/lib/postgresql/data/certs/root.crt` inside the Postgres
   service using Railway SSH. Verify its SHA-256 fingerprint through the
   database-service deployment record or another trusted operator channel.
2. Base64-encode the complete PEM without changing it and set the result as
   the backend variable `DATABASE_CA_CERT_BASE64`. The CA is not confidential,
   but its integrity is security-critical. Do not place it in the repository.
3. Inspect the server certificate SAN. The current official Railway image
   issues it to `localhost`, so set `DATABASE_TLS_SERVER_NAME=localhost`.
   If the database image later issues a service-specific SAN, use that exact
   inspected identity instead.
4. Stage both variables without deploying, then deploy the backend from
   `backend/`. A missing, invalid, expired, non-CA, or nearly expired trust
   bundle prevents migrations and API startup.
5. Confirm migrations complete, operator-authenticated readiness is healthy,
   and a production database rehearsal connects. A certificate or identity
   mismatch must fail.

The native `pg_dump`, `psql`, and `pg_restore` paths use libpq
`verify-full`. They resolve the actual Railway database hostname to an address
but present the pinned certificate identity separately, avoiding credentials
in command arguments. During CA rotation, use a bundle containing both the
old and new roots for the overlap window, validate new connections, then
remove the retired root. Treat any unexpected root change as a security
incident rather than disabling verification.

## Beta Surface

Enabled by default:

- Invite-gated signup, signin, logout.
- Workspace creation.
- Basic agents.
- Basic threads/messages.
- Browser session persistence and realtime websocket tickets.
- Email verification and one-time password reset.
- Complete owned-workspace account export and authenticated account deletion.

Desktop support boundary:

- The authenticated Relay Console beta shell is desktop-width only for the
  first external cohort.
- Narrow mobile and tablet viewports show a desktop-beta support gate instead
  of the fixed-width app shell.
- Public login/register pages remain usable on smaller screens so testers can
  request access or authenticate before moving to a supported desktop browser.

Disabled unless explicitly enabled for admins:

- Agent Ops HQ.
- Marketplace/external integrations.
- Local workspace file tools.

Web-hosted Mission Control/local process and repository control is permanently
retired and cannot be enabled. Its former flags, secrets, and host path/profile
variables must be absent from Vercel.

External artifact links are metadata-only and HTTPS-only. Runtime pointer
manifests must use `.artifact.json` and an absolute HTTPS `external_url`
without embedded credentials. Relay shows the destination host and opens the
link with no opener/referrer relationship; it never downloads the destination
through Railway. An unavailable entry with the fixed blocked-link reason
indicates an unsafe producer or legacy row, not a link operators should
manually copy and open.

Public beta web defaults:

```bash
NEXT_PUBLIC_ENABLE_OPERATIONS=false
NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT=false
NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT_REALTIME=false
NEXT_PUBLIC_ENABLE_AGENT_OPS=false
NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS=false
NEXT_PUBLIC_ENABLE_MARKETPLACE=true
NEXT_PUBLIC_ENABLE_LOCAL_WORKSPACE_FILES=false
NEXT_PUBLIC_POSTHOG_PROJECT_ID=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_TELEMETRY_ENVIRONMENT=production
CLAWCHAT_ENABLE_INTERNAL_DEMO_ROUTES=false
```

`NEXT_PUBLIC_POSTHOG_PROJECT_ID` and `NEXT_PUBLIC_SENTRY_DSN` are public SDK
routing identifiers. Never put a PostHog personal API key or Sentry auth token
in `NEXT_PUBLIC_*`. PostHog and Sentry stay inactive until the browser user
completes the first-launch privacy choice; the independent choices default off
and remain reversible in Settings > Privacy.

Agent Ops HQ remains opt-in and owner/admin-only. Signup remains invite-only
with `CLAWCHAT_BETA_SIGNUP_MODE=invite`.
Invite codes are one-use seed codes in production: the backend stores only HMAC
hashes in `beta_invites`, tracks `useCount`, and writes `auth.invite.accepted`
when a seed is consumed.

## Marketplace Beta Gate

If `NEXT_PUBLIC_ENABLE_MARKETPLACE=true` is enabled for public beta, the backend
must keep the marketplace beta gate enabled at the same time:

```bash
CLAWCHAT_MARKETPLACE_BETA_MODE=true
CLAWCHAT_MARKETPLACE_ALLOWED_APPS=github,gitlab,linear,jira,asana,trello,clickup,notion,google-drive,airtable,dropbox,confluence,coda,sentry,posthog,figma,canva
CLAWCHAT_MARKETPLACE_BLOCKED_APPS=x,resend,gmail,outlook,slack,discord,twilio,exa,dataforseo,linkedin,facebook-pages,instagram-graph-api,threads,tiktok,pinterest,reddit,mastodon,bluesky,stripe,shopify,paddle,lemon-squeezy,chargebee,railway,vercel,supabase,hubspot,salesforce,zendesk,intercom,pipedrive,wordpress,webflow,youtube-data-api
```

The first allowlist is limited to apps that are suitable for tester-owned
credentials and do not create ClawChat-paid API spend by default. X, email,
messaging, SMS, paid search/data, social publishing, commerce/payment,
infrastructure/deployment, CRM/support, and provider-review-unclear apps stay
blocked until cost ownership, provider readiness, approval gates, and audit
behavior are verified.

LinkedIn is intentionally blocked in the first default set because the roadmap
requires provider setup/review readiness before it can graduate into the beta
allowlist. Local app ingestion is still a power-user surface and must be
reviewed through the bridge/device auth and local source-host rules before it is
promoted to external testers.
