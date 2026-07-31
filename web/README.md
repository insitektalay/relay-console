# ClawChat Web

ClawChat web runs against the Railway backend only. The frontend is deployed on
Vercel, but the backend target must stay on Railway.

Current beta production mapping:

- `https://relayconsole.work` - Vercel web frontend
- `https://www.relayconsole.work` - Vercel web frontend alias, if enabled
- `https://api.relayconsole.work` - Railway backend/API and websocket origin

The historical `clawchat.team` Vercel aliases may exist during transition, but
`relayconsole.work` is the beta launch target.

## Backend Rules

- Do not point API traffic at `localhost`, `127.0.0.1`, or any other local backend.
- Do not use `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_WS_BASE_URL` in this app.
- HTTP requests go through `/api/v1`, which Next.js rewrites to `CLAWCHAT_RAILWAY_ORIGIN`.
- Realtime connections use `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`.
- If something breaks, fix Railway configuration or deployment. Do not switch to a local backend.

## Environment

Copy `.env.example` and set Railway values only:

```bash
CLAWCHAT_RAILWAY_ORIGIN=https://api.relayconsole.work
NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://api.relayconsole.work
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
NEXT_PUBLIC_TELEMETRY_ENVIRONMENT=development
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
CLAWCHAT_ENABLE_INTERNAL_DEMO_ROUTES=false
```

Web-hosted Mission Control process and repository controls were permanently
removed under security ADR-042. Do not configure the retired Mission Control
UI/API flags, administrative secret, OpenClaw webhook secret, or local
profile/path variables; the production build rejects them.

The PostHog project ID and Sentry DSN are public client routing identifiers, not
administrative secrets. Keep any PostHog personal API key and Sentry auth token
out of `NEXT_PUBLIC_*`. Both browser SDKs remain inactive until the user makes
the first-launch privacy choice, and either category can be disabled later.
For production source-map symbolication, set the build-only
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` values together in
Vercel. The build uploads source maps and removes them from the deployed output;
these values are never exposed to browser code. See
[`../docs/TELEMETRY_CONFIGURATION.md`](../docs/TELEMETRY_CONFIGURATION.md) for
the complete cross-platform setup and verification procedure.

If the marketplace is enabled for public beta, the Railway backend must also run
the marketplace beta gate with the first reviewed default set:

```bash
CLAWCHAT_MARKETPLACE_BETA_MODE=true
CLAWCHAT_MARKETPLACE_ALLOWED_APPS=github,gitlab,linear,jira,asana,trello,clickup,notion,google-drive,airtable,dropbox,confluence,coda,sentry,posthog,figma,canva
CLAWCHAT_MARKETPLACE_BLOCKED_APPS=x,resend,gmail,outlook,slack,discord,twilio,exa,dataforseo,linkedin,facebook-pages,instagram-graph-api,threads,tiktok,pinterest,reddit,mastodon,bluesky,stripe,shopify,paddle,lemon-squeezy,chargebee,railway,vercel,supabase,hubspot,salesforce,zendesk,intercom,pipedrive,wordpress,webflow,youtube-data-api
```

For public beta deployments, `/` is the public landing page and `/app` is the
authenticated application entry point. Agent Ops HQ, Operations, local
workspace file tools, and internal demo routes stay off unless explicitly
reviewed and enabled for workspace owners/admins. Web-hosted Mission Control
cannot be enabled. Marketplace may be enabled only with the backend
marketplace beta gate above.

Beta launch planning lives in
[`docs/beta-launch-roadmap.md`](docs/beta-launch-roadmap.md). It covers the
browser beta surface, bridge plugin onboarding, marketplace app gating, and the
release checks needed before external testers are invited.

## Development

Run the frontend locally:

```bash
npm run dev
```

The local ClawChat web app is served at `https://localhost:3033`. The dev
script creates ignored local cert/key files in `certificates/`, preferring
mkcert-signed certificates that macOS can trust.
