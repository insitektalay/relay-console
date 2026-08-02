# Self-host Relay Console

Relay Console is an early-alpha source release. You provide the Railway
project, Apple signing and one supported agent runtime. Every installation uses
its own database, cache, domain and secrets.

## One-click Railway deployment

The official template configuration is complete, but Railway requires the
public repository owner to publish it once through the Railway dashboard before
there is a real template URL. No URL has been invented here. The exact composer
fields and acceptance test are in
[`docs/RAILWAY_TEMPLATE_PUBLISHING.md`](docs/RAILWAY_TEMPLATE_PUBLISHING.md).

After that owner action, the user journey is:

1. Click **Deploy on Railway**, sign in and click **Deploy**. No configuration
   fields are required.
2. Wait for the backend, PostgreSQL and Redis services to become healthy.
3. Open the backend service, copy its generated HTTPS domain and use it as
   `CLAWCHAT_RAILWAY_ORIGIN` when building Relay Console Swift, as shown below.
4. Copy the generated `CLAWCHAT_BETA_INVITE_CODES` value from the backend
   Variables view to create the first account.
5. In Relay Console Swift **Settings**, connect the Hermes or OpenClaw
   installation already running on the same Mac. The Swift app is the adapter;
   do not install the bridge-plugin flow for this setup.

Railway generates every installation secret independently while creating the
template. At backend startup, a private HMAC challenge retrieves only that
installation's PostgreSQL CA, the matching Ed25519 descriptor pair is derived
from its one-time Railway seed, and the lifecycle registry is inserted once in
PostgreSQL under an advisory lock. Restarts, redeployments and additional
backend replicas reuse those persisted values. PostgreSQL data and its CA use
the database volume; Redis uses Railway's persistent Redis volume. Server leaf
certificates renew under the stable installation CA without disabling hostname
or chain verification.

The production audit deliberately keeps its existing lifecycle policy. The
persisted registry schedules its first review for 60 days after installation;
an operator must review and, where required, rotate Railway variables before
recording new lifecycle dates. A stale registry blocks a later deployment
rather than silently resetting its own dates. The ten-year PostgreSQL root CA
also never rotates unattended: ordinary leaf renewal is automatic, while root
rotation becomes an explicit operator action in its final 180 days.

The manual procedure below remains available until the template URL is
published and as an operator recovery path.

The first working conversation needs four parts:

1. a Railway backend with PostgreSQL and Redis;
2. one Relay Console client;
3. a Relay Console account and workspace; and
4. one paired runtime from [`docs/RUNTIME_SETUP.md`](docs/RUNTIME_SETUP.md).

Marketplace providers, analytics, Sentry, PostHog, billing, transactional email
and managed runtimes are optional. Leave them disabled for the first setup.

## Prerequisites

- a fork or clone of this public repository;
- a Railway account with a plan that can run three services;
- Node.js 20 and pnpm 10 on the machine used to generate secrets;
- OpenSSL; and
- a public HTTPS origin only if you also plan to deploy the browser client.

Install the Railway CLI and sign in by following Railway's
[`railway` CLI guide](https://docs.railway.com/cli). The dashboard can perform
the project steps, but the CLI makes certificate retrieval reproducible.

## 1. Create a new Railway project

1. In Railway, choose **New Project**.
2. Choose **Deploy from GitHub repo** and select your fork.
3. Name the new service `backend`.
4. In the backend service settings, set **Root Directory** to `/backend`.
5. Set **Config File Path** to `/backend/railway.json` if Railway does not
   detect it. Do not override the Dockerfile or start command.
6. Generate a Railway public domain for the backend service. Record the full
   origin, such as `https://example-production.up.railway.app`.
7. Keep the initial backend deployment stopped or failed until the database,
   Redis and variables below exist. A fail-closed initial deployment is
   expected.

`backend/railway.json` selects `backend/Dockerfile`, runs the production secret
audit, applies database migrations, starts the API and checks
`/api/v1/health/live`.

## 2. Add PostgreSQL and Redis

From the project canvas, choose **New**, then add:

- **Database > PostgreSQL**, named `Postgres`; and
- **Database > Redis**, named `Redis`.

Wait for both services to deploy. Railway's PostgreSQL template already uses
Railway's public
[`postgres-ssl`](https://github.com/railwayapp-templates/postgres-ssl) image.
You do not create a fourth service or supply an unpublished image. If an older
project has a custom service named `postgres-ssl`, replace it with the current
Railway PostgreSQL template and name that service `Postgres`. The reference
variables and commands in this guide then work without changes.

Railway creates the database and cache passwords. The backend receives their
connection URLs through service references:

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

If you choose different service names, replace `Postgres` and `Redis` in both
references and in the commands below.

## 3. Retrieve and verify the PostgreSQL CA

Railway's PostgreSQL image creates its CA and server certificate on the
persistent database volume. The current image stores them under
`/var/lib/postgresql/data/certs/` and gives the server certificate the DNS
identity `localhost`.

Link the CLI to the new project and select its production environment:

```bash
railway login
railway link
```

Retrieve the public CA and server certificate from your own `Postgres` service:

```bash
railway ssh -s Postgres 'cat /var/lib/postgresql/data/certs/root.crt' \
  > railway-postgres-root.crt
railway ssh -s Postgres 'cat /var/lib/postgresql/data/certs/server.crt' \
  > railway-postgres-server.crt
```

Railway may prompt you to register an SSH key. You can also right-click the
Postgres service, choose **Copy SSH Command**, open that shell and run the two
`cat` commands.

Verify that the server certificate chains to the retrieved CA and inspect its
exact identity:

```bash
openssl verify \
  -CAfile railway-postgres-root.crt \
  railway-postgres-server.crt
openssl x509 \
  -in railway-postgres-server.crt \
  -noout -subject -issuer -fingerprint -sha256 -ext subjectAltName
```

The first command must report `OK`. The subject alternative name from the
current Railway image is `DNS:localhost`, so the backend setting is:

```dotenv
DATABASE_TLS_SERVER_NAME=localhost
```

Use the identity printed by `openssl` if Railway changes its image. Do not add
`sslmode` or certificate parameters to `DATABASE_URL`; the backend owns the
verified TLS policy.

## 4. Generate every required backend variable

Choose the final web HTTPS origin before generating the file. It can be a
Vercel project domain or a domain you control. Run this command from the
repository root:

```bash
node scripts/generate-self-host-railway-env.mjs \
  --backend-origin https://YOUR-BACKEND.up.railway.app \
  --web-origin https://YOUR-WEB.example \
  --database-ca ./railway-postgres-root.crt \
  --output backend/.env.railway.generated
```

The script validates the CA, creates independent secrets and an Ed25519 key
pair, writes the complete secret-lifecycle registry, and gives the output file
mode `0600`. The generated file includes every variable required for a core
self-hosted deployment. [`backend/railway.variables.example`](backend/railway.variables.example)
lists the names without usable values.

Open the backend service's **Variables** tab, choose **Raw Editor**, and paste
the generated file. Confirm that `DATABASE_URL` and `REDIS_URL` remain Railway
reference variables. Save the staged changes and deploy them.

Railway supplies `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`,
`RAILWAY_SERVICE_ID`, `RAILWAY_DEPLOYMENT_ID`, `RAILWAY_SERVICE_NAME`,
`RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_PUBLIC_DOMAIN` and
`RAILWAY_GIT_COMMIT_SHA` to GitHub-backed deployments. Do not copy IDs from
another project or add maintainer values for those names.

Keep the generated invite code. You need it to create the first account. Delete
the local generated file and the two downloaded certificates after Railway has
saved the variables:

```bash
rm backend/.env.railway.generated \
  railway-postgres-root.crt \
  railway-postgres-server.crt
```

The generated file disables these optional systems:

- Stripe and Apple billing;
- managed Railway runtimes; and
- transactional email.

Provider OAuth and API credentials are required only when you enable the
matching Marketplace integration. Sentry and PostHog are client-side optional
settings and do not belong in the backend variable set.

## 5. Deploy, migrate and verify the backend

Deploy the backend from its GitHub source. Do not replace the configured start
command:

```text
pnpm run security:audit:production && node dist/scripts/run-migrations.js && node dist/main
```

The migration runner creates a fresh schema in filename order, records each
migration in the `migrations` table, and then starts NestJS. Check the Railway
deployment log for one of these messages:

```text
Fresh database bootstrap ran <number> migrations in filename order
Ran <number> migrations
No migrations are pending
```

A failed secret audit or migration stops the deployment. Fix the named setting
instead of bypassing the guard.

Verify the public liveness endpoint:

```bash
curl --fail --silent --show-error \
  https://YOUR-BACKEND.up.railway.app/api/v1/health/live
```

The expected body is:

```json
{"ok":true,"status":"live"}
```

The backend is ready only after Railway marks the deployment healthy and this
request succeeds.

## 6. Configure a client

All clients must use the same Railway backend. They do not need Sentry,
PostHog, analytics or a Relay-maintainer account.

### Web

Deploy `web/` to a Next.js host. Set:

```dotenv
CLAWCHAT_RAILWAY_ORIGIN=https://YOUR-BACKEND.up.railway.app
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://YOUR-BACKEND.up.railway.app
```

Browser requests stay on `/api/v1`; Next.js rewrites them to Railway. Realtime
traffic connects to the matching WSS origin. If the deployed web origin differs
from `CORS_ORIGINS`, update that backend variable and redeploy the backend.

Open `/app`, create an account with the generated invite code, and sign in.

### macOS

From `RelayConsoleSwift/`:

```bash
CLAWCHAT_RAILWAY_ORIGIN=https://YOUR-BACKEND.up.railway.app \
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://YOUR-BACKEND.up.railway.app \
Scripts/build-release-app.sh
```

The builder embeds both origins in the app. Open the app yourself, create or
sign in to the same account, and select the workspace created during signup.

### iPhone and iPad

Install Xcode 16+ and XcodeGen. Copy
`ios/Config/RelayConsoleOwner.xcconfig.example` to the ignored owner config,
then set:

```text
RELAY_CONSOLE_API_BASE_URL = https:/$()/YOUR-BACKEND.up.railway.app/api/v1
RELAY_CONSOLE_WEBSOCKET_BASE_URL = wss:/$()/YOUR-BACKEND.up.railway.app
```

Also set an Apple development team and a bundle identifier you control. Then:

```bash
cd ios
xcodegen generate
```

Build and install the app on your device from Xcode. Relay Console does not
ship an App Store binary in this source release.

## 7. Pair a runtime and send the first message

Follow [`docs/RUNTIME_SETUP.md`](docs/RUNTIME_SETUP.md). The Hermes path gives
the shortest public bridge setup. OpenClaw remains a preview alternative. That
guide covers runtime installation, pairing, connection checks and the first
conversation.

## Clean-room completion checklist

- [ ] The Railway project belongs to the new operator.
- [ ] `backend`, `Postgres` and `Redis` show healthy deployments.
- [ ] The PostgreSQL server certificate verifies against the retrieved CA.
- [ ] The backend variable set came from the public generator script.
- [ ] Backend startup ran the production audit and migrations.
- [ ] `/api/v1/health/live` returns `{"ok":true,"status":"live"}`.
- [ ] One client signs in against the operator's Railway domain.
- [ ] One supported runtime bridge appears online in Runtime pairing.
- [ ] A message sent to the connected runtime produces a visible AI reply.

The repository validates the presence and consistency of these instructions
with:

```bash
pnpm test:public-setup-docs
```
