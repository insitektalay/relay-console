# ClawChat Railway Handoff

This folder is a setup handoff for a third party who wants to clone ClawChat and deploy an independent instance on Railway.

GitHub contains source code only. It does not contain Railway projects, Railway services, production databases, Redis instances, domains, runtime devices, bridge devices, OAuth apps, or secrets. The deployer must create their own Railway project and provide their own environment variables and secrets.

Clone the main repo:

```bash
git clone git@github.com:alexkerss-code/clawchat.git
```

Companion plugin repo:

```bash
git clone git@github.com:alexkerss-code/clawchat-bridge-plugins.git
```

Use this folder before changing anything:

1. Read `SERVICES_AND_ARCHITECTURE.md` to understand what runs where.
2. Read `ENVIRONMENT_VARIABLES.md` and create fresh secrets.
3. Follow `RAILWAY_SETUP.md`.
4. Use `DEPLOYMENT_CHECKLIST.md` to verify the deployment.
5. Give `AI_CODER_HANDOFF_PROMPT.md` to another AI coder if they are doing the setup.

Important constraints:

- Do not reuse Alex's Railway project, service URLs, database URLs, Redis URLs, OAuth apps, API keys, JWT secrets, or encryption keys.
- Keep web HTTP API traffic on `/api/v1`, rewritten to the Railway backend.
- Configure web backend targets with `CLAWCHAT_RAILWAY_ORIGIN` and `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`.
- Do not configure the web app to send API or websocket traffic to a loopback backend.

