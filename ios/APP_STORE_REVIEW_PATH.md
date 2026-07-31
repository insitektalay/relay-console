# App Store review account and runtime path

Status: **implementation prepared; external account and runtime do not exist yet**.

App Review needs a genuine Relay path. It must not depend on developer
fixtures, a local backend, a simulated agent, a private source checkout or
credentials stored in this repository.

## External setup

1. Create a dedicated synthetic review email account and verify it through the
   production email-verification journey.
2. Give its single review workspace a genuine active Apple sandbox/TestFlight
   or approved review entitlement. Do not use an operator-only entitlement
   override.
3. Enrol the released bridge beside an independently installed Hermes Agent or
   OpenClaw runtime on a dedicated test host. Keep it online throughout review.
4. Add at least one real test agent and a direct thread containing only
   synthetic, non-confidential content.
5. Put the email, password and any review instructions only in App Store
   Connect's review fields. Record the human review contact there.

## Headless preflight

From the repository root, set credentials only in the current shell environment:

```sh
RELAY_REVIEW_EMAIL='…' \
RELAY_REVIEW_PASSWORD='…' \
RELAY_REVIEW_WORKSPACE_ID='…' \
node scripts/app-store-review-preflight.mjs
```

The script is pinned to `https://api.relayconsole.work/api/v1`. It verifies the
account is email-verified, the workspace is read/write, at least one compatible
bridge is online, at least one agent exists, and the Marketplace response carries
its release state. It emits counts and one-way fingerprints, never credentials,
raw account/workspace/device/agent IDs, provider secrets or message content. It
revokes its temporary mobile session on exit.

The default command is read-only apart from login/logout audit/session state. To
exercise a real dispatch deliberately, also set `RELAY_REVIEW_THREAD_ID` and run:

```sh
node scripts/app-store-review-preflight.mjs --exercise-message
```

That explicit mode sends a unique synthetic message with ask-for-approval policy
and waits for a new agent response. Do not run it against a personal or customer
thread.

## Manual frozen-build acceptance

After the headless preflight passes, use the signed TestFlight build to verify
login, workspace loading, Relay subscription state, the same online agent, a message
round trip, runtime offline/online truthfulness, Marketplace release gating,
Restore Purchases, Relay account JSON export through the Files picker, and genuine
account deletion. Inspect the synthetic export for expected profile, account,
conversation, agent, and activity data and for the absence of credential
material. Capture the date, app build,
backend deployment, bridge release, runtime version and reviewer outcome in the
private launch ledger, without copying credentials or private screenshots.

The App Store listing checklist remains open until this complete journey exists
and passes. Repository tests alone cannot create or prove the external account,
subscription, runtime host or App Review access.

Record the completed review path without credentials, account identifiers,
customer content, or screenshots in the results template described by
`docs/relay-cloud/APP_STORE_RELEASE_BINDING_GATE_2026-07-15.md`. Final release
validation binds that result to the processed build and both TestFlight stages.
