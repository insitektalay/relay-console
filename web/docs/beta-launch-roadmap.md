# ClawChat Browser Beta Launch Roadmap

Last reviewed: 2026-06-19
Scope: ClawChat web beta, Railway backend, Hermes Agent/OpenClaw bridge plugins

## Goal

Launch ClawChat as a real browser-based beta that external testers can sign up for and use with their own Hermes Agent or OpenClaw runtime.

This is not a stripped-down demo. The beta should expose as much of the working product as is safe and supportable:

- browser landing page and authenticated web app
- invite-gated account creation
- workspace creation
- agents, teams, chats, realtime messaging, wrap-ups, and docs
- bridge pairing for Hermes Agent and OpenClaw
- a limited marketplace where testers can connect apps that do not create ClawChat-paid usage

## Hard Boundaries

- The web app remains Railway-backed.
- Browser API traffic stays on `/api/v1`, rewritten to `CLAWCHAT_RAILWAY_ORIGIN`.
- Browser websocket traffic uses `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`.
- No beta flow should tell testers to point the web app at a loopback or local backend.
- Backend behavior changes must be deployed to Railway from `backend/` before the feature is described as usable.
- The bridge plugin repo must be public before external beta users are asked to install it.

## Existing Repo Facts

- `README.md` already describes `/` as the public landing page and `/app` as the authenticated app.
- `.env.example` already uses the Railway backend variables and has `NEXT_PUBLIC_ENABLE_MARKETPLACE=true`; Marketplace membership is always loaded from Railway.
- `lib/config.ts` and `next.config.mjs` reject retired public API/websocket base
  URL variables; production web builds also require explicit Railway REST and
  websocket origins with matching hosts.
- `app/api/beta-signup/route.ts` saves waitlist signups through the Railway backend waitlist endpoint.
- `../../docs/BETA_OPERATIONS.md` exists, but it is conservative and says marketplace/external integrations are disabled unless explicitly reviewed.
- `../../docs/open-source-release-roadmap.md` exists, but it targets an MIT/source release path rather than this hosted browser beta.
- `../../docs/production-launch-architecture.md` is historical and says it predates later bridge auth hardening.
- `../../docs/openclaw-bridge-beta-preview.md` documents the current manual OpenClaw preview install/pairing flow.
- `../../docs/openclaw-clawchat-extension-install-prompt.md` provides the lower-level AI-coder prompt for configuring a fresh OpenClaw install.
- `https://github.com/insitektalay/relay-console-bridge-plugins` is public and cloneable. It was inspected for this roadmap at commit `21ddaeb`.
- The backend marketplace catalog currently contains 49 curated provider packs plus local app ingestion support.

## Beta Product Surface

### Default enabled for public beta

- Public landing page and beta request form.
- Authenticated `/app` browser shell.
- Authenticated shell access is desktop-width only for the first external
  cohort; narrow mobile/tablet viewports show a desktop-beta support gate.
- Invite-code registration and login.
- Workspace creation and workspace switching.
- Agent roster and agent setup for OpenClaw, Hermes, and existing runtime types that are production-safe.
- Direct, team, department, meeting, and agent-to-agent chat flows that work against Railway state.
- Realtime websocket updates.
- Wrap-up/reset flows where backend structured job dependencies are configured.
- Agent documentation and installed marketplace pack docs.
- Agent Ops HQ stays disabled by default; if enabled for beta, it is visible
  only to workspace owners/admins after auth, data isolation, and feature-flag
  behavior are verified for external users.
- Marketplace UI only after app-level beta allowlisting is enforced server-side.

### Default disabled or admin-only

- Internal Mission Control.
- Internal Operations and bridge-control setup pages that expose low-level controls.
- Local workspace file tools.
- Internal demo routes.
- Any connector or app that uses ClawChat-owned paid quota, credentials, or API spend.
- Any connector whose OAuth app, callback, provider review, or quota policy is not ready for unrelated testers.

## Marketplace Beta Policy

The beta should not remove the marketplace idea. It should turn the marketplace into a reviewed allowlist.

### Include an app when all are true

- The tester uses their own account, OAuth grant, API key, app password, or self-funded provider plan.
- ClawChat does not pay per call, per post, per message, per search, or per quota unit.
- Credentials stay server-side in encrypted marketplace connection storage.
- The app has clear approval gates for external writes, publishing, deleting, sending, billing, deployment, or admin actions.
- The backend can block installation, connection, OAuth start, and runtime tool execution for apps outside the beta allowlist.

### Exclude or hide an app when any are true

- ClawChat would pay for API usage, including platform-owned paid APIs, SMS, email send volume, paid search/data APIs, or high-cost quotas.
- The provider requires a production app review that is not complete.
- The connector depends on shared operator credentials.
- The connector can create meaningful external side effects but approval policy or audit behavior is not verified.
- The connector is technically present in the catalog but not operationally supportable for beta.

### Immediate app decisions

- X should be excluded for beta unless every tester brings their own X API access and the cost/rate-limit story is explicit.
- LinkedIn can be a beta candidate if it uses user-owned OAuth and the provider app/review state is ready.
- Email, messaging, paid search/data, SMS, and social publishing apps need per-app cost ownership review before they appear.
- Commerce/payment and infrastructure/deployment apps should stay hidden or admin-only until approval, audit, and blast-radius checks pass.
- Local app marketplace ingestion can remain a power-user feature only if bridge/device auth and local source-host permissions are clear.

### First cohort default decision

The first public-beta marketplace defaults are:

- `CLAWCHAT_MARKETPLACE_BETA_MODE=true`
- `CLAWCHAT_MARKETPLACE_ALLOWED_APPS=github,gitlab,linear,jira,asana,trello,clickup,notion,google-drive,airtable,dropbox,confluence,coda,sentry,posthog,figma,canva`
- `CLAWCHAT_MARKETPLACE_BLOCKED_APPS=x,resend,gmail,outlook,slack,discord,twilio,exa,dataforseo,linkedin,facebook-pages,instagram-graph-api,threads,tiktok,pinterest,reddit,mastodon,bluesky,stripe,shopify,paddle,lemon-squeezy,chargebee,railway,vercel,supabase,hubspot,salesforce,zendesk,intercom,pipedrive,wordpress,webflow,youtube-data-api`

This allowlist favors tester-owned productivity, development, work-management,
document, design, and observability accounts with no default ClawChat-paid API
spend. LinkedIn is held out until provider setup and review readiness are
confirmed. CRM/support, social publishing, email/messaging/SMS,
commerce/payment, infrastructure/deployment, paid data/search, and other
high-blast-radius apps stay blocked until cost ownership, approval behavior, and
audit behavior are verified.

### Required implementation

Add a backend-enforced marketplace beta gate, not only a frontend filter.

Recommended shape:

- `CLAWCHAT_MARKETPLACE_BETA_MODE=true`
- `CLAWCHAT_MARKETPLACE_ALLOWED_APPS=github,gitlab,linear,jira,asana,trello,clickup,notion,google-drive,airtable,dropbox,confluence,coda,sentry,posthog,figma,canva`
- `CLAWCHAT_MARKETPLACE_BLOCKED_APPS=x,resend,gmail,outlook,slack,discord,twilio,exa,dataforseo,linkedin,facebook-pages,instagram-graph-api,threads,tiktok,pinterest,reddit,mastodon,bluesky,stripe,shopify,paddle,lemon-squeezy,chargebee,railway,vercel,supabase,hubspot,salesforce,zendesk,intercom,pipedrive,wordpress,webflow,youtube-data-api`
- server-side filtering in catalog list/detail
- server-side enforcement before connection create/update, OAuth start, install/update, pack refresh, tool requests, and runtime marketplace tool execution
- UI copy for unavailable apps that says the app is not included in the current beta
- tests proving a blocked app cannot be reached by direct API calls

Because this changes backend API behavior and runtime dispatch behavior, it must be deployed to Railway from `backend/` before marketplace beta access is considered live.

## Bridge Plugin Repo Status

Repo: `https://github.com/insitektalay/relay-console-bridge-plugins`
Observed commit: `21ddaeb`

### Already present

- Top-level repo docs: `README.md`, `docs/INSTALL.md`, `docs/SECURITY.md`, `docs/AI_CODER_HANDOFF.md`, and `HANDOFF_PROMPT.md`.
- Contract docs:
  - `contracts/bridge-plugin-contract.md`
  - `contracts/hermes-agent-runtime.md`
  - `contracts/openclaw-agent-api.md`
- Secret hygiene:
  - `.gitignore`
  - `scripts/verify-sanitized.sh`
  - `.github/workflows/sanity.yml` running the sanitization scan
- Hermes bridge source:
  - `plugins/hermes-agent-bridge/src/main.py`
  - `plugins/hermes-agent-bridge/plugin.json`
  - `plugins/hermes-agent-bridge/config.example.json`
  - tests for dispatch normalization, reconnect backfill, run locking, response delivery, runtime controls, marketplace runtime tools, local repo docs, local app runtime recovery, and secret-sensitive paths
- OpenClaw bridge source/reference:
  - `plugins/openclaw-bridge/plugin.json`
  - `plugins/openclaw-bridge/examples/`
  - `plugins/openclaw-bridge/openclaw-extension/` source snapshot
  - OpenClaw channel plugin id `clawchat`
  - package name `@openclaw/clawchat`
  - support for bridge device auth, websocket registration, `agent.dispatch`, replies, structured prompts/jobs, attachments, library/workspace controls, and local repo docs

### Hermes capability status

The Hermes plugin is much more complete than a simple bridge stub. The source already includes:

- `enroll`, `run`, and `status` CLI commands inside `main.py`
- one-time enrollment redemption against `/api/v1/bridge/enroll`
- local config persisted under Hermes home with `0600` permissions where supported
- device auth against `/api/v1/bridge/device/auth`
- websocket authentication
- `register_hermes_agent`
- `hermes.run.dispatch`
- `hermes.run.cancel`
- reconnect backfill through `GET /api/v1/bridge/runtime-dispatches/pending?externalAgentIds=...`
- local dispatch dedupe state
- terminal-event retry/outbox behavior
- runtime event acknowledgement handling
- marketplace tool proxying
- Hermes marketplace skill install support
- local repo docs read/write support
- local app Agent API setup/request support
- structured job support
- local app runtime recovery support
- secret-looking field redaction

The current gap is packaging and public onboarding, not core Hermes bridge functionality.

### OpenClaw capability status

The OpenClaw side is currently closer to a source snapshot and contract handoff than a finished public installer.

The `openclaw-extension` code already supports:

- OpenClaw channel plugin registration
- account config under `channels.clawchat`
- bridge device auth
- websocket authentication to ClawChat
- `register_bridge_agent`
- `agent.dispatch`
- message postback to `/api/v1/bridge/messages`
- runtime dispatch event postback
- structured prompt and structured job pathways
- local media attachment handling
- library and agent workspace control
- local repo docs reading

Remaining preview limitations:

- a script that installs/enables the extension with OpenClaw's supported plugin mechanism
- a pairing-code redemption helper for OpenClaw
- a verification command that proves the plugin is enabled, configured, authenticated, and registering agents
- tests or CI for the OpenClaw extension outside a live OpenClaw checkout

### Public-readiness gaps

These are the repo-level gaps before we should point outside testers at it:

- No `LICENSE` file is present at the repo root.
- The README still says the repo is intended for an AI coding agent and a fresh ClawChat checkout. It needs a beta-user path first.
- `docs/INSTALL.md` is accurate for internal handoff but not yet easy for a normal tester.
- `scripts/install-hermes-agent-bridge.sh` only copies Hermes files into a supplied Hermes source checkout. It does not discover Hermes, install dependencies, run enrollment, write config through a guided flow, or support `--dry-run`.
- OpenClaw has a manual preview guide, but no equivalent installer script.
- There is no top-level one-shot installer such as `install.sh --runtime hermes|openclaw`.
- There is no uninstall/reset script.
- There is no troubleshooting guide for auth failures, websocket failures, no registered agents, missing backfill endpoint, stale device credentials, or provider/runtime version mismatch.
- The default Hermes device label in source is `"Hermes bridge / UK PC"`. That should become host-derived or generic before public beta.
- The docs do not yet present the security model in tester-friendly language.
- The docs mention local OpenClaw targets such as `http://localhost:3052/api/openclaw/*`; that is valid only for local runtime/tool traffic. Public docs must explicitly say ClawChat backend API and websocket traffic always go to the Railway origin.

## Bridge Plugin Onboarding

External testers need a simple way to install the bridge plugin, but the install path should still be inspectable.

### Public repo requirements

Before beta invites go out, the bridge plugin repo needs to be made presentable as a standalone public beta dependency:

- add a clear root `LICENSE`
- rewrite the README so the first path is for beta testers, not AI-coder handoff
- document Hermes Agent and OpenClaw install paths separately
- document uninstall and credential reset
- document what files are written locally
- document what network endpoints are contacted
- document which commands may be run
- make the installer readable, idempotent, and safe to rerun
- support `--dry-run`
- never log bridge device tokens or bearer values
- include tests or verification fixtures for bridge auth, websocket connection, dispatch receive, event postback, and reconnect/backfill where supported

### Current install shape

Current Hermes install is a source-copy flow:

```bash
git clone https://github.com/insitektalay/relay-console-bridge-plugins.git
cd clawchat-bridge-plugins
scripts/install-hermes-agent-bridge.sh /path/to/hermes-agent
```

Then the user must run checks from the Hermes checkout:

```bash
venv/bin/python -m py_compile clawchat_bridge/main.py
venv/bin/python -m pytest -q tests/clawchat_bridge
```

The copied Hermes bridge CLI then supports the real enrollment path:

```bash
hermes-clawchat-bridge enroll \
  --api-url https://api.relayconsole.work \
  --code <ONE_TIME_PAIRING_CODE> \
  --agent <HERMES_EXTERNAL_AGENT_ID> \
  --device-label "<MACHINE LABEL>"
```

Run/status:

```bash
hermes-clawchat-bridge status
hermes-clawchat-bridge run
```

This is usable by a technical internal tester. It is not yet the outside-world beta installer.

### Target one-shot install shape

The public website can offer a one-shot command, but it should sit next to a manual install link.

Candidate command shape:

```bash
curl -fsSL https://raw.githubusercontent.com/insitektalay/relay-console-bridge-plugins/main/install.sh | bash -s -- --runtime hermes --backend https://api.relayconsole.work --api-prefix /api/v1
```

Manual alternative:

```bash
git clone https://github.com/insitektalay/relay-console-bridge-plugins.git
cd clawchat-bridge-plugins
./install.sh --runtime hermes --backend https://api.relayconsole.work --api-prefix /api/v1 --dry-run
./install.sh --runtime hermes --backend https://api.relayconsole.work --api-prefix /api/v1
```

OpenClaw variant:

```bash
curl -fsSL https://raw.githubusercontent.com/insitektalay/relay-console-bridge-plugins/main/install.sh | bash -s -- --runtime openclaw --backend https://api.relayconsole.work --api-prefix /api/v1
```

The installer should not embed workspace IDs, pairing codes, device IDs, or device tokens. Those belong to the user's signed-in ClawChat session and the one-time bridge enrollment flow.

### Installer responsibilities

- detect supported runtime: Hermes Agent or OpenClaw
- accept an explicit runtime path when auto-detection fails
- install dependencies for the selected plugin
- install or enable the plugin using the runtime's official plugin mechanism
- ask for or accept a one-time bridge pairing code
- redeem the code against the Railway backend bridge enrollment endpoint
- write returned device credentials to the selected runtime's plugin config
- set the backend origin and API prefix
- restart or reload the bridge plugin if the runtime supports it
- verify websocket authentication
- verify agent registration or explain why no agents were registered
- print a final status summary with no secrets
- support `--dry-run`
- support `--no-start` for users who want to inspect before launching
- support `uninstall` or `reset-credentials`

### Installer acceptance checks

Hermes installer done means:

- installs the bridge into a Hermes Agent checkout without manual file copying
- ensures `aiohttp` and any Hermes bridge dependencies are available
- exposes or verifies `hermes-clawchat-bridge`
- runs `py_compile`
- can run the included bridge tests when requested
- redeems a pairing code
- writes config with no token leakage
- `status` redacts `deviceToken`
- `run` authenticates and registers the configured Hermes external agent IDs

OpenClaw installer done means:

- installs/enables `plugins/openclaw-bridge/openclaw-extension` through OpenClaw's plugin mechanism
- preserves existing OpenClaw config
- writes `channels.clawchat` with Railway `apiUrl`, `workspaceId`, `devicePublicId`, `deviceToken`, optional `structuredPromptCommand`, and optional `repoMappings`
- verifies `openclaw plugins list` / `inspect` / `doctor` or the equivalent supported commands
- authenticates to the Railway backend
- registers configured OpenClaw agent IDs
- shows the bridge device online in ClawChat

### In-app pairing flow

The web app should give testers a clear pairing path:

1. Sign in.
2. Choose or create a workspace.
3. Open bridge/runtime setup.
4. Generate a short-lived pairing code.
5. Run the installer or paste the code into the already-installed plugin.
6. Wait for device status to show online.
7. Create or map agents.
8. Send a test message and confirm runtime events arrive.

## Launch Readiness Gates

### Gate 1: Product decisions

- Public beta feature flags are fail-closed by default:
  `NEXT_PUBLIC_ENABLE_OPERATIONS=false`,
  `NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT=false`,
  `NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT_REALTIME=false`,
  `NEXT_PUBLIC_ENABLE_AGENT_OPS=false`,
  `NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS=false`,
  `NEXT_PUBLIC_ENABLE_MARKETPLACE=true`, and
  `NEXT_PUBLIC_ENABLE_LOCAL_WORKSPACE_FILES=false`.
- Web-hosted Mission Control host process/repository control is removed, not
  feature-gated; its retired variables must be absent from Vercel.
- Agent Ops HQ is not beta-visible by default; if enabled later it is
  owner/admin-only in the web shell.
- The first marketplace allowlist is the reviewed default set above and must be
  paired with `CLAWCHAT_MARKETPLACE_BETA_MODE=true` in production.
- Beta signup is invite-only with `CLAWCHAT_BETA_SIGNUP_MODE=invite`.
- Decide the support channel and response expectations.
- Decide privacy, data retention, and deletion language for beta.

### Gate 2: Web and backend deployment

- Web build passes.
- Web typecheck passes.
- Web lint passes.
- Backend build passes.
- Backend tests covering auth, bridge, marketplace gating, and runtime dispatch pass.
- Railway backend health endpoint passes.
- Railway Postgres backups are enabled.
- Redis and websocket behavior are verified.
- CORS origins match deployed web origin.
- Web production env has only approved public variables.
- `/` loads public landing page.
- `/app` loads authenticated shell.
- Browser requests use `/api/v1`.
- Websocket connects to the Railway backend origin.

### Gate 3: Auth and account lifecycle

- Invite-code signup works.
- Login and refresh survive browser reload.
- Logout revokes session as expected.
- Waitlist signup is persisted through the backend.
- Password reset support path is clear.
- Account export/deletion request behavior is clear.
- Admin can issue, rotate, and revoke beta invite codes through the
  Railway-backed env runbook in `../../docs/beta-auth-account-lifecycle.md`.

### Gate 4: Bridge and runtime

- Hermes bridge plugin installs from the public repo through the beta installer, not only the internal copy script.
- OpenClaw bridge plugin installs from the public repo through the beta installer or a clearly documented OpenClaw-native install flow.
- One-time enrollment code creation and redemption works.
- Device credentials are scoped to a workspace and can be revoked.
- Plugin reconnect/backfill behavior is verified for Hermes.
- Runtime dispatch receives a request and posts events back.
- Failed plugin auth gives an actionable error in the app. Thread runtime
  failure cards now show runtime type, error code, retryability, and safe retry
  when the runtime failure identifies the source user message.
- Runtime participant health is visible in active thread UI, and active runtime
  dispatches can be cancelled through the authorized dispatch cancel endpoint.
- The app never asks testers to configure a local backend URL.

### Gate 5: Marketplace

- Backend allowlist/denylist is implemented and deployed.
- Blocked app catalog entries are hidden or marked unavailable.
- Direct blocked app API calls fail.
- OAuth start is blocked for unavailable apps.
- Install is blocked for unavailable apps.
- Runtime marketplace tools are blocked for unavailable apps.
- X and other ClawChat-paid connectors are excluded.
- LinkedIn and any other included apps are verified with real tester-owned credentials.
- Approval-required actions are visible and audited.

### Gate 6: Safety and operations

- Do not claim end-to-end encryption unless the architecture changes to enforce it.
- State plainly that the hosted service processes workspace content to provide orchestration.
- The beta client maintains a redacted 25-event local error buffer and exposes
  `window.clawChatSupportSnapshot?.()` for support evidence capture. PostHog
  product analytics and Sentry error reporting are independent, off-by-default
  first-launch choices. Autocapture, replay, heatmaps, form values, request
  data, performance traces and authored content are excluded.
- Add uptime checks for the web URL and backend health endpoint. Backend liveness/readiness endpoints and `scripts/check-beta-health.mjs` now cover direct backend health, deployed web `/api/v1` rewrites, and optional authenticated websocket smoke when a tester-owned smoke account is provided through environment variables.
- Add runtime-aware operator visibility for bindings, active sessions, recent dispatches, terminal states, and failure buckets. Workspace admins now have `GET /api/v1/workspaces/{workspaceId}/agent-ops/runtime-overview` with SDK/contracts coverage and redacted operator fields.
- Add rate-limit and abuse review for signup, login, bridge enrollment, and marketplace tool calls. Backend throttling now covers these surfaces with regression coverage and redacted `security.rate_limit.exceeded` log events.
- Add a support escalation runbook for bridge pairing failures. See `../../docs/beta-support-incident-runbooks.md`.
- Add an incident rollback plan for marketplace app removal. See `../../docs/beta-support-incident-runbooks.md`.

## Suggested First Beta Milestones

### Milestone A: Beta launch plan accepted

Done when:

- this roadmap is reviewed
- feature flag decisions are recorded
- first marketplace allowlist is chosen
- plugin repo/publication owner is assigned

### Milestone B: Bridge plugin public install path

Done when:

- bridge repo is public
- bridge repo has a license and beta-user README
- installer supports Hermes and OpenClaw choices, or Hermes is declared first-class and OpenClaw is explicitly marked manual/preview
- manual install path is documented for both Hermes and OpenClaw
- installer dry-run works
- pairing code flow is verified against Railway
- install docs include uninstall/reset and troubleshooting

### Milestone C: Marketplace beta gate

Done when:

- backend marketplace allowlist exists
- blocked app routes fail server-side
- web marketplace reflects beta availability
- backend is deployed to Railway
- smoke tests prove X is unavailable and an allowed app works

### Milestone D: External beta release candidate

Done when:

- Railway backend and web deploys are green
- backups and health checks are active
- invite signup works
- one external machine pairs a Hermes plugin
- one external machine pairs an OpenClaw plugin
- a tester can create a workspace, connect a bridge, send a message, and use one allowed marketplace app

## First Ten Work Items

1. Confirm beta feature flags for web production.
2. Add a root license and beta-user README to `insitektalay/relay-console-bridge-plugins`.
3. Add a top-level installer script to the bridge plugin repo with `--runtime`, `--backend`, `--api-prefix`, `--dry-run`, and explicit runtime path options.
4. Add a bridge plugin install page or modal in ClawChat that links to the public repo and shows the one-shot command.
5. Implement backend marketplace beta allowlist/denylist enforcement.
6. Add web marketplace unavailable states for apps excluded from beta.
7. Choose and verify the first allowed app list, including LinkedIn only if provider setup is actually ready.
8. Run Railway backend deployment from `backend/` after backend marketplace gating changes.
9. Run full web/backend release checks and record results.
10. Invite the first external tester and walk through signup, bridge pairing, first message, and one allowed marketplace flow.

## Open Questions

- Should `insitektalay/relay-console-bridge-plugins` be the canonical public repo, or should it be transferred/mirrored under the ClawChat organization before beta?
- What license should the bridge plugin repo use?
- Which beta users get Hermes first, OpenClaw first, or both?
- Should the first one-shot installer support both runtimes on day one, or ship Hermes first and mark OpenClaw as manual/preview?
- Should Agent Ops HQ be beta-visible on day one?
- Which blocked marketplace apps can graduate after provider setup, cost
  ownership, approval gates, and audit behavior are verified?
- Is the web app staying on the current web host or moving to Railway as a separate service?
- What is the support channel: email, GitHub issues, Discord/Slack, or an in-app support link?
- What is the policy for revoking a tester's bridge device after the beta?

## Not Launch-Ready Until

- the bridge plugin repo is public and installable
- the bridge plugin repo has public-ready README, license, install, uninstall/reset, and troubleshooting docs
- the marketplace beta gate is backend-enforced
- paid/operator-funded apps are hidden or blocked
- Railway backend deployment is current after backend changes
- at least one clean external-machine bridge pairing succeeds
- testers have a clear support path when pairing or runtime dispatch fails
