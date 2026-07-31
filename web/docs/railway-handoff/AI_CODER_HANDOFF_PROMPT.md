# AI Coder Handoff Prompt

Use this prompt with your AI coder after cloning the repo.

```text
You are helping me deploy my own independent ClawChat instance with Railway for
the backend/API and Vercel for the web frontend.

First, read the repo docs in docs/railway-handoff/:

- README.md
- RAILWAY_SETUP.md
- SERVICES_AND_ARCHITECTURE.md
- ENVIRONMENT_VARIABLES.md
- DATABASE_AND_STORAGE.md
- DEPLOYMENT_CHECKLIST.md

Use those docs as the source of truth. Do not ask me to understand Railway manually unless something is genuinely missing or marked NEEDS CONFIRMATION.

Repo clone URL:
git@github.com:alexkerss-code/clawchat.git

Companion plugin repo:
git@github.com:alexkerss-code/clawchat-bridge-plugins.git

Create a new Railway project owned by me for the backend, Postgres, and Redis.
Use Vercel for the web frontend. Do not reuse anyone else's Railway project,
databases, Redis services, domains, Vercel project, or secrets.

Set up:

1. Railway Postgres.
2. Railway Redis.
3. Backend service from backend/ using backend/railway.json.
4. Vercel web project with root directory web/.

Generate fresh secrets for JWT and encryption variables. Never commit secrets. Never paste real secrets into docs.

Important ClawChat constraint:

- Keep web HTTP API traffic on /api/v1, rewritten to the Railway backend.
- Use CLAWCHAT_RAILWAY_ORIGIN and NEXT_PUBLIC_RAILWAY_WS_BASE_URL for web backend configuration.
- For the beta launch mapping, use relayconsole.work and www.relayconsole.work for Vercel web, and api.relayconsole.work for Railway backend/API.
- Do not configure the web app to use localhost, 127.0.0.1, or any loopback backend URL for API or websocket traffic.
- Do not set NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_WS_BASE_URL.

After setup, verify:

- Backend /api/v1/health returns ok.
- Backend logs show migrations complete.
- Web app loads.
- Auth works.
- /api/v1 requests reach my Railway backend.
- Websocket connects to my Railway backend.
- Any bridge/plugin runtime needed for my use case is enrolled and connected.

If a required detail is missing, mark it as NEEDS CONFIRMATION and tell me exactly what needs to be confirmed.
```
