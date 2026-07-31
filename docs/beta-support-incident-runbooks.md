# Relay Console Beta Support And Incident Runbooks

These runbooks cover the first beta support and incident cases for account
access, billing, runtime connectivity, bridge pairing, Marketplace connections,
compromise, data lifecycle, outages, and restore. They assume the web app and
backend use the Railway backend as the source of truth.

Classify the affected mode before troubleshooting:

- Relay Local: customer-owned runtime on the same Mac, with no cloud
  entitlement or Railway execution dependency.
- Relay Connect: customer-owned Hermes Agent or OpenClaw plus Relay bridge;
  Relay supports the control plane and bridge, while the customer supports the
  runtime host, runtime authentication, and model-provider account.
- Relay Cloud: Relay-managed Hermes only; Relay supports provisioning, host,
  volume, runtime updates, metering, retention, and recovery. The customer
  still owns the model-provider account and its charges.

Never give Relay Connect runtime-host repair instructions for a managed Cloud
incident, or claim that Relay operates a Connect customer's computer.

## Safety Rules

- Do not ask testers to paste pairing codes, device tokens, bearer tokens,
  OAuth tokens, API keys, or screenshots that reveal them.
- Do not point beta web, API, or websocket traffic at a loopback backend.
- Do not delete production database rows as a rollback step.
- Do not rotate production secrets unless compromise is suspected.
- Record timestamps in UTC and keep incident notes free of raw secrets.
- Backend deploys must run from `backend/` so `backend/railway.json` applies.

## Evidence To Capture

Capture:

- incident start time and reporter
- workspace id and affected user id, if available
- runtime type: Hermes or OpenClaw
- device label, plugin version, and runtime version
- backend Railway origin, with no query strings or credentials
- exact non-secret error message and HTTP status
- whether public `/api/v1/health/live` is healthy and the protected readiness
  check passed through `scripts/check-beta-health.mjs`; never copy the operator
  secret into incident notes
- relevant audit event types and counts
- redacted runtime/plugin log snippets
- redacted browser `web.client.*` console events or a
  `window.clawChatSupportSnapshot?.()` result when the failure is in the web UI

Do not capture:

- full pairing code
- device token
- websocket token
- bearer token
- OAuth client secret, access token, or refresh token
- third-party API key
- browser cookies, local storage, session storage, full URLs with query strings,
  or screenshots that reveal credentials

Useful checks:

```bash
CLAWCHAT_RAILWAY_ORIGIN=https://your-backend.up.railway.app \
CLAWCHAT_WEB_ORIGIN=https://your-web.example \
node scripts/check-beta-health.mjs
```

Use the authenticated audit APIs from an admin browser/session when possible:

```text
GET /api/v1/audit-logs/metrics?workspaceId=<workspace-id>&hours=24
GET /api/v1/audit-logs?workspaceId=<workspace-id>&page=1&pageSize=50
```

These endpoints require workspace-admin authority. Anonymous account and client
network values appear only as non-reversible correlation tokens; do not request
the hashing key or attempt to turn them back into customer identifiers. Auth
events are retained for at most 30 days and other audit events for at most 90
days.

## Frontend Browser Error Evidence

Use this when a tester reports a blank screen, broken UI action, or unexpected
browser error while the Railway backend health checks are otherwise normal.

The beta web app always keeps a local support buffer of the latest 25 redacted
`web.client.error` and `web.client.unhandled_rejection` events. If the tester
explicitly enabled **Share crash and error reports** during first launch or in
Settings > Privacy, the same sanitized diagnostics are sent to Sentry. With the
choice off, no browser error leaves the device. The app never sends these
events to the Relay backend.

Ask the tester to capture:

- UTC time of failure
- browser name/version and whether they are on a desktop-width viewport
- visible page path only, without query string or hash
- copied redacted `web.client.*` console lines, or the result of:

```js
window.clawChatSupportSnapshot?.()
```

The snapshot is expected to contain only `supportModel`, `capturedAt`,
`pagePath`, `eventCount`, and redacted `recentEvents`. Do not ask the tester to
paste cookies, local storage, session storage, bearer tokens, pairing codes,
OAuth/API credentials, or screenshots of credential fields.

Record whether Sentry consent was enabled before the incident. Turning it on
after the failure cannot recover the earlier event from the in-memory buffer;
use the redacted support snapshot for that case.

Escalate to engineering when:

- the snapshot shows repeated `web.client.error` or
  `web.client.unhandled_rejection` events after refresh
- the same error affects more than one tester
- Railway health is green but the same web action consistently fails
- the error text suggests credential exposure, workspace isolation failure, or
  unexpected access to a beta-disabled surface

## Bridge Pairing Failure

### Triage

1. Confirm backend liveness and readiness with `scripts/check-beta-health.mjs`.
2. Confirm the tester's bridge config uses the Railway backend origin, `/api/v1`
   for REST, and the Railway websocket origin.
3. Confirm the tester is using a fresh pairing code. Pairing codes are
   short-lived and one-time use; do not ask the tester to send the code.
4. Review audit metrics for `bridge.enrollment.failed`,
   `bridge.device.auth.failed`, and `bridge.device.paired`.
5. Review Railway logs for `security.rate_limit.exceeded`, websocket auth
   failures, and bridge enrollment errors.
6. Ask the tester for redacted plugin/runtime logs that include timestamp,
   runtime type, plugin version, HTTP status, and error code only.

### Common Causes And Actions

| Symptom | Likely Cause | Action |
| --- | --- | --- |
| Enrollment returns invalid or expired code | Code was reused, mistyped, or expired | Generate a new code in Settings > Integrations and retry once |
| Enrollment succeeds but device never appears online | Runtime/plugin did not authenticate, persist the rotated credential, or connect websocket | Check Railway websocket origin, plugin version, `bridge/device/auth` status, and whether the client atomically saved the returned replacement device token |
| Device becomes revoked after an authentication retry | A consumed device token was replayed, usually by an old plugin or non-atomic credential save | Stop retries, inspect `bridge.device.credential_replay_detected`, upgrade the runtime, and re-pair with a fresh code |
| Device appears online but no agents register | Runtime plugin is connected but not registering external agent ids | Check runtime agent configuration and plugin registration logs |
| Device pairs to the wrong workspace | Tester used a code from another workspace | Revoke the misplaced device and re-pair from the intended workspace |
| Repeated failures from one tracker | Abuse/rate limit or automation loop | Pause retries, review audit/logs, and regenerate only after root cause is understood |

### Recovery

Use the UI under Settings > Integrations when possible.

Supported backend controls:

```text
POST /api/v1/bridge/devices/<device-id>/revoke
POST /api/v1/bridge/workspaces/<workspace-id>/devices/revoke-all
```

Prefer single-device revoke. Use revoke-all only when:

- multiple unknown devices are paired to the workspace
- device token compromise is suspected
- the tester cannot identify the failed device
- support needs to force a clean re-pair after repeated failures

After revocation:

1. Generate a new pairing code.
2. Have the tester reset local bridge credentials using the supported installer
   or plugin reset flow.
3. Re-pair against the Railway backend.
4. Verify `bridge.device.paired` and then a successful websocket registration.
5. Send a simple message to a runtime-backed agent only after pairing is stable.

### Escalation

Escalate to engineering when:

- `/api/v1/health/ready` is degraded
- Railway logs show backend exceptions during enrollment or device auth
- websocket auth succeeds but bridge-control subscription is denied
- a device can act outside its workspace
- a token, pairing code, or third-party credential may have been exposed

Escalation packet:

- incident summary
- UTC timeline
- workspace id
- runtime type and plugin version
- relevant audit event types/counts
- redacted log snippets
- recovery already attempted
- whether any device was revoked

## Marketplace App Removal Incident

Use this when a beta app must be hidden or disabled because of cost, provider
review, unsafe side effects, credential concern, abuse, or broken runtime tool
behavior.

### Immediate Containment

1. Add the app slug to `CLAWCHAT_MARKETPLACE_BLOCKED_APPS`.
2. Remove the app slug from `CLAWCHAT_MARKETPLACE_ALLOWED_APPS` if present.
3. Keep `CLAWCHAT_MARKETPLACE_BETA_MODE=true`.
4. Deploy the backend from `backend/`.
5. Verify catalog list/detail, connection creation, install/update, OAuth start,
   tool requests, and runtime marketplace tool execution reject the app.

Do not claim containment is live until the Railway backend deployment and
verification complete.

### Existing Installs

List installs:

```text
GET /api/v1/workspaces/<workspace-id>/marketplace/installs
```

Unconfigure a ClawChat install:

```text
DELETE /api/v1/workspaces/<workspace-id>/marketplace/installs/<install-id>
```

This marks the install as removed and records
`marketplace.install.unconfigured`. It does not delete runtime files or third
party provider resources.

For OAuth connectors that support local disconnect, use the connector
disconnect route to clear local token usability:

```text
POST /api/v1/workspaces/<workspace-id>/marketplace/connectors/<slug>/connections/<connection-id>/disconnect
POST /api/v1/workspaces/<workspace-id>/marketplace/x/connections/<connection-id>/disconnect
```

If provider-side token revocation is required, use the provider's own admin
console or OAuth app console. Do not paste provider tokens into ClawChat notes.

### Verification

Verify:

- app no longer appears in the beta catalog
- app detail reports beta-unavailable if directly requested
- connection create/update is blocked
- OAuth start is blocked
- install/update is blocked
- marketplace tool requests are blocked
- runtime marketplace tool execution is blocked
- audit logs include any install unconfiguration or OAuth disconnect events

Relevant event types:

- `marketplace.install.unconfigured`
- `marketplace.connection.created`
- `marketplace.connection.updated`
- `marketplace.<slug>.oauth.disconnected`
- `marketplace.x_oauth.disconnected`
- `marketplace.local_repo_docs.auto_apply_blocked`

### Rollback Criteria

Only restore an app to the beta allowlist after all applicable conditions are
true:

- cost owner and quota policy are confirmed
- provider app review or OAuth callback readiness is confirmed
- approval gates for writes/destructive actions are verified
- audit events are verified
- credentials remain encrypted server-side
- runtime tool execution is covered by beta-gate tests
- support has a known recovery path for the app

Rollback steps:

1. Remove the slug from `CLAWCHAT_MARKETPLACE_BLOCKED_APPS`.
2. Add the slug to `CLAWCHAT_MARKETPLACE_ALLOWED_APPS`.
3. Deploy backend from `backend/`.
4. Verify protected readiness with `scripts/check-beta-health.mjs` and the
   operator secret supplied from the credential store.
5. Verify catalog, OAuth/connect, install, and one low-risk read-only tool flow.
6. Ask affected testers to reconnect or reinstall the app through the UI.

Stop and escalate before rollback if legal/privacy impact, provider terms, data
loss, billing ownership, or destructive provider-side cleanup is unclear.

## Login, Verification, And Password-Reset Failure

### Triage

1. Check Railway health and readiness before asking the customer to retry.
2. Record the UTC time, affected account id when known, client kind, HTTP status,
   and sanitized error code. Do not record the password, action link, cookie,
   access token, refresh token, or email-action token.
3. Review the bounded audit events `auth.login.failed`,
   `auth.email_verification.sent`, `auth.email_verification.failed`,
   `auth.password_reset.requested`, `auth.password_reset.email_sent`,
   `auth.password_reset.email_failed`, and `auth.password_reset.completed`.
4. Check transactional-email provider health and Railway configuration without
   printing `RESEND_API_KEY`, action links, or message bodies.
5. Distinguish invalid credentials from email-delivery failure, expired or used
   one-time links, rate limiting, revoked sessions, and a wider Railway outage.

### Recovery

- Use `POST /api/v1/auth/email-verification/resend` for an authenticated,
  unverified customer. Never mark an address verified by editing the database.
- Use `POST /api/v1/auth/password-reset/request`; the response must remain
  non-enumerating whether or not the account exists.
- A customer completes the newest one-time link through
  `POST /api/v1/auth/password-reset/complete`. Successful completion revokes all
  browser, mobile, legacy refresh, and live websocket sessions.
- Revoke a suspicious browser session with
  `POST /api/v1/auth/web/sessions/<session-id>/revoke`, or all browser sessions
  with `POST /api/v1/auth/web/sessions/revoke-all`.
- Escalate instead of bypassing verification, weakening rate limits, disclosing
  whether an email is registered, or setting a customer password.

Close the case only after the customer can authenticate through the normal
flow, the expected audit event exists, and no raw secret entered the support
record. The complete account behavior is documented in
`docs/beta-auth-account-lifecycle.md`.

## Billing And Entitlement Failure

### Triage

1. Read the operator-only `GET /api/v1/operator/billing-observability` snapshot.
   Record aggregate alert codes and counts only. Do not put the operator secret
   in the request URL, terminal history, report, or support record.
2. Read `GET /api/v1/workspaces/<workspace-id>/billing/status` and record only
   provider, plan, status, mode, and period dates.
3. Confirm the customer's email is verified and that they own the workspace.
4. Determine whether the purchase is Stripe or Apple. Do not ask for a full card
   number, Stripe secret, signed Apple transaction, receipt, webhook signature,
   App Store credential, or screenshot containing payment details.
5. For Stripe, correlate `billing.checkout.created`,
   `billing.checkout.completed`, `billing.subscription.reconciled`,
   `billing.invoice.paid`, `billing.payment.attention_required`,
   `billing.dispute.created`, and `billing.charge.refunded` with the provider
   dashboard and idempotent billing-event record.
6. For Apple, correlate `billing.apple.transaction.verified` and
   `billing.apple.notification.reconciled` with App Store Server state.

### Recovery

- Start a new Stripe purchase only through
  `POST /api/v1/workspaces/<workspace-id>/billing/checkout`.
- Send an existing Stripe customer to
  `POST /api/v1/workspaces/<workspace-id>/billing/portal` for payment method,
  cancellation, or invoice management.
- On iPhone or iPad, use the supported Restore Purchases flow. Railway must
  verify the signed transaction before the client finishes it.
- If provider state is correct but Relay is stale, replay or redeliver the exact
  provider event through Stripe or Apple tooling and verify idempotent
  reconciliation. Do not synthesize provider events or edit subscription or
  entitlement rows manually.
- A failed, cancelled, refunded, revoked, or lapsed subscription must follow the
  configured grace/read-only contract. Export and recovery remain available;
  support must not grant permanent write access to hide a billing fault.

Escalate any cross-workspace entitlement, duplicate active provider ownership,
signature-verification failure, or divergence that persists after an authentic
provider-event redelivery. Close only when provider state, Railway billing
status, and the signed Relay entitlement agree.

## Runtime Offline Or Not Responding

1. Confirm Railway health and readiness. A healthy control plane with an offline
   runtime is not a Relay-wide outage.
2. Read the workspace runtime overview:

   ```text
   GET /api/v1/workspaces/<workspace-id>/agent-ops/runtime-overview?dispatchLimit=50&sessionLimit=50&windowHours=24
   ```

3. Check the enrolled-device list, last heartbeat, runtime/plugin versions,
   runtime authentication state, current dispatch, and sanitized failure code.
4. Ask the customer to confirm that their runtime host is powered on and online,
   Hermes Agent or OpenClaw is authenticated and running, and the Relay bridge
   process is connected. Relay support does not sign in to, start, update, or
   repair the customer's runtime host.
5. If the device credential is rejected, revoke that device and follow the
   Bridge Pairing Failure recovery flow. Do not repeatedly reconnect with an old
   credential.
6. Before retrying a message, determine whether the original dispatch is
   pending, active, terminal, or retryable. Never create a second execution just
   to test an uncertain in-flight dispatch.
7. After the bridge reconnects, verify the device heartbeat, agent registration,
   dispatch/backfill state, and one new low-risk message without duplicate
   execution.

Escalate if a connected device cannot register its own agents, a dispatch is
delivered to the wrong workspace/device, reconnection duplicates execution, or
Railway reports an internal bridge coordinator failure.

## Marketplace OAuth Or Connection Failure

### Triage

1. Record the app slug, connection id, workspace id, UTC time, client kind,
   sanitized error/status, and whether the failure occurred at start, callback,
   refresh, health check, action execution, reauthorization, or disconnect.
2. Never collect a callback URL containing query parameters, authorization code,
   OAuth state, PKCE verifier, access/refresh token, client secret, cookie, or
   provider API key.
3. Confirm Railway health, the canonical callback origin, provider configuration,
   granted scopes, connection health, and whether the app is allowed by the
   current Marketplace release gate.
4. Review the connection and audit history for scope mismatch, expired consent,
   provider denial, token refresh failure, rate limiting, or a blocked app.

### Recovery

- Use the app's supported reauthorization flow:

  ```text
  POST /api/v1/workspaces/<workspace-id>/marketplace/connectors/<slug>/connections/<connection-id>/oauth/reauthorize
  POST /api/v1/workspaces/<workspace-id>/marketplace/x/connections/<connection-id>/oauth/reauthorize
  ```

- Disconnect locally through the matching supported connector route when a
  clean reconnection is required. If the provider supports or requires remote
  revocation, the customer must revoke the grant in the provider's own account
  or admin console as well.
- Retry only after confirming the requested scopes and callback configuration;
  do not broaden scopes, disable state/PKCE checks, or expose credentials to make
  a connection pass.
- If one app is unsafe or broadly broken, follow Marketplace App Removal
  Incident containment rather than asking every customer to keep retrying.

Close after a normal connection or reauthorization completes, its health is
ready, the minimum low-risk action succeeds, and no secret appears in logs or
support evidence.

## Compromised Runtime Device

1. Treat the report as a security incident and record the UTC timeline, workspace
   id, device id/label, runtime type, and indicators without copying the device
   credential or host secrets.
2. Immediately revoke the single device with:

   ```text
   POST /api/v1/bridge/devices/<device-id>/revoke
   ```

   Use workspace-wide revoke only when multiple devices are unknown or affected:

   ```text
   POST /api/v1/bridge/workspaces/<workspace-id>/devices/revoke-all
   ```

3. Verify the device websocket disconnects, new device authentication is denied,
   active dispatch ownership is released safely, and the revocation audit event
   is present.
4. Have the customer secure the host and runtime account before issuing a new
   one-time enrollment. A new bridge credential must be written only on that
   host and must not be sent to support.
5. Review messages, tool actions, provider connections, and audit events during
   the exposure window. Revoke affected provider grants and user sessions too if
   the host could access them.
6. Rotate platform-wide JWT or encryption secrets only when evidence shows the
   compromise extends beyond the one device; otherwise scoped revocation is the
   safer containment.

Do not close until the old device remains denied, suspicious dispatches/actions
are accounted for, the host is remediated, and any replacement device completes
a clean enrollment.

## Compromised Marketplace Provider Connection

1. Stop using the connection and record its workspace, app slug, connection id,
   affected time window, and sanitized evidence. Never copy the credential into
   incident notes.
2. Disconnect the Relay-side connection through the supported connector route:

   ```text
   POST /api/v1/workspaces/<workspace-id>/marketplace/connectors/<slug>/connections/<connection-id>/disconnect
   POST /api/v1/workspaces/<workspace-id>/marketplace/x/connections/<connection-id>/disconnect
   ```

3. The customer must revoke the OAuth grant, token, API key, or app password in
   the provider's own security/admin console and rotate any related credential.
   A Relay-side disconnect is not proof of provider-side revocation.
4. Unconfigure affected agent installs if they could still expose a tool surface,
   and review relevant action/audit records for unauthorized use.
5. If a shared Relay OAuth application, connector implementation, or many
   customers are affected, invoke Marketplace App Removal Incident containment
   and keep the app blocked until security review approves restoration.
6. Reconnect only with a newly authorized credential after the provider and
   Relay histories are reconciled.

Escalate suspected credential disclosure, cross-workspace access, unexplained
external side effects, or a provider-wide incident immediately.

## Account Export And Deletion Support

1. Direct an authenticated customer to export through
   `GET /api/v1/auth/account/export`. Do not generate an export from an operator
   database query or send it through support email.
2. Confirm that the export excludes password hashes, session credentials, OAuth
   verifier material, provider credentials, and encrypted secret fields.
3. Account deletion uses `DELETE /api/v1/auth/account` and requires the
   current password plus exact `DELETE` confirmation. Support must never ask the
   customer to provide that password.
4. If deletion is refused, explain the specific supported prerequisite: cancel
   an active Relay Connect or Relay Cloud subscription, or leave/transfer a workspace the user
   does not solely own. Do not bypass ownership or billing safeguards.
5. After successful deletion, verify session closure and the expected
   pseudonymized audit/retention state. Do not promise immediate erasure from
   backups or payment records beyond the published retention policy.
6. Escalate incomplete cascade deletion, export content from another workspace,
   secret-bearing export fields, or a deletion that leaves an authenticating
   session as a security incident.

## Relay Control Plane Or Web Outage

1. Declare an incident when health/readiness, the web origin, authenticated
   websocket smoke, database, Redis, queue, or a critical customer journey is
   degraded. Record UTC start time, accountable owner, affected surfaces, and
   the last known good backend/web versions.
2. Stop unrelated production promotions and Marketplace batches. Do not switch
   the web application to a local or loopback backend.
3. Run the strict health smoke against `https://relayconsole.work` and
   `https://api.relayconsole.work`, then inspect Railway deploy/migration logs,
   database, Redis, queue, websocket authentication, and provider status.
4. Publish a short customer-safe status update that states impact and the next
   update time without exposing customer data, infrastructure secrets, or an
   unverified cause.
5. Roll back application code to the last compatible reviewed release only
   after confirming its schema range can read the current database. Backend
   deployments run from `backend/` so `backend/railway.json` applies. Never
   delete production rows or reverse a migration ad hoc to make a rollback fit.
6. If data integrity is uncertain, stop writes or keep affected features
   read-only while preserving export/recovery access; do not conceal the fault
   by granting broad operator access.
7. Close only after health/readiness, strict web rewrite and authenticated
   websocket smoke, critical journeys, queues, and error rates remain healthy
   for the agreed observation window. Record cause, impact, remediation,
   follow-up owner, and customer communication.

## Backup Restore Or Data-Recovery Incident

1. Freeze destructive changes and identify the exact deployment, backup id,
   encryption-key version, schema/migration range, attachment snapshot, incident
   owner, and restore approver. Never print database URLs, presigned URLs, or the
   backup passphrase.
2. Restore only into an isolated recovery database first. Follow
   `docs/relay-cloud/BACKUP_AND_RESTORE.md` using `npm run cloud:restore` with a
   one-use download URL and explicit deployment confirmation.
3. Verify decryption, migration state, table/row counts, tenant-isolation
   samples, account authentication, entitlement state, bridge-device scope,
   Marketplace/OAuth records, attachments, search/derived data, websocket
   authentication, queues, and one dispatch path without exposing customer
   content in the evidence packet.
4. Compare the restore point with the incident timeline and quantify any data
   outside the recovery point objective. Reconcile provider-side actions and
   billing events that may have occurred after the snapshot before reopening
   writes.
5. Promote or copy recovered data into production only with named human
   approval, a rollback path, customer-impact communication, and a second
   operator verifying the target.
6. Record the completed drill/restore metadata and retain sanitized evidence.
   A successful command alone is not a completed restore exercise.

Escalate any cross-tenant row, missing encryption key, incomplete attachment
set, schema incompatibility, unexplained billing divergence, or uncertainty
about the recovery target. Never test a restore by overwriting the live Railway
database.
