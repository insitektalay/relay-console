# ClawChat Operational Security Runbook

## Deployment baseline

- keep production and staging as separate Railway projects
- use distinct Postgres databases per environment
- use distinct strong `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_WS_SECRET`,
  `APP_ENCRYPTION_KEY`, `ATTACHMENT_PROVENANCE_SECRET`, and
  `ATTACHMENT_SIGNING_SECRET`; use a separate
  `CLAWCHAT_BETA_INVITE_HASH_SECRET` for persisted invite hashes
- restrict Railway operator access to the smallest possible team
- never reuse staging secrets in production
- treat `backend/security/production-secret-policy.json` as the reviewed
  production Railway/Vercel identity and variable-name policy; changes require
  security review

## Required environment variables

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_WS_SECRET`
- `APP_ENCRYPTION_KEY_VERSION`
- `APP_ENCRYPTION_KEY` as `base64:<base64-encoded-32-random-bytes>`
- `ATTACHMENT_PROVENANCE_SECRET` as a dedicated non-JWT/non-encryption secret
- `ATTACHMENT_SIGNING_SECRET` as a different dedicated non-JWT secret for cloud
  attachment upload/download signatures
- `CLAWCHAT_BETA_INVITE_HASH_SECRET` as a dedicated invite HMAC key so JWT
  rotation cannot reset one-use invite consumption
- `RUNTIME_MIGRATION_ENCRYPTION_KEY` as dedicated high-diversity material of
  at least 32 bytes; do not reuse the application, runtime-credential, JWT, or
  provider keys
- optional `CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS` only during a controlled
  invite-hash key rotation
- optional `APP_ENCRYPTION_KEYS` when rotating encryption keys, for example `v1:base64:<old-key>,v2:base64:<new-key>`
- `RELAY_SECRET_LIFECYCLE_JSON` as a non-secret
  `relay.secret-lifecycle.v1` registry. Its `materials` keys must exactly match
  the audit inventory, including retained invite-hash/encryption material and
  configured provider credentials. Each entry contains only `version`,
  `lastRotatedAt`, `lastReviewedAt`, and `nextReviewAt`.

The lifecycle registry must not contain a value, hash, fingerprint, credential
length, free-form note, or unknown field. Reviews are accepted for at most 90
days, recorded rotations for at most 400 days, and the next review must be at
least one day in the future. A lifecycle timestamp is evidence of the actual
operator/provider event; never invent one to make deployment pass. Use the
provider activity log or perform the appropriate rollover when history cannot
be established.

The audit automatically treats suffix-anchored secret keys, passwords, private
keys, encryption keys, master keys, API/access keys, and tokens as material.
Encryption, master, private, and password families require at least 32 bytes;
provider-issued tokens and API/client secrets require at least 16 bytes. A new
secret-shaped production variable therefore also requires an exact lifecycle
record before startup can pass.

Separation is by effective root material, not merely the displayed encoding:
raw, base64, and base64url forms of application/retained encryption keys are
compared internally without being emitted. Every invite seed code is compared
individually and codes must be unique.

## Production deployment secret gate

The production image runs `pnpm run security:audit:production` before
migrations and application startup. Missing, weak, placeholder, reused,
structurally invalid, untracked, stale, future-dated, or wrong-Railway material
exits non-zero. It also verifies the connection-descriptor key pair, retained
invite-hash keys, every versioned encryption key, enabled-feature provider
credentials, and the exact project/environment/service/deployment identity.
The emitted attestation is value-free.

Deployment identity always includes an exact 40-character lowercase source
commit. The audit uses the first non-empty `RAILWAY_GIT_COMMIT_SHA` or
`RELAY_RELEASE_COMMIT`; a missing or malformed value stops startup before
migrations. Never set the explicit binding to the checkout's old `HEAD` when
the uploaded source contains uncommitted changes.

For a CLI release, start from the clean integrated commit and run from
`backend/`. Stage the non-secret commit binding without triggering a separate
deployment, update the lifecycle registry from standard input, then include the
same full commit in the deployment message:

```sh
railway variable set --environment production --service clawchat \
  --skip-deploys RELAY_RELEASE_COMMIT=<full-40-character-commit>
railway variable set --environment production --service clawchat \
  --skip-deploys --stdin RELAY_SECRET_LIFECYCLE_JSON < <reviewed-registry.json>
railway up --detach --message "Relay production <full-40-character-commit>"
```

Do not place either credential values or the Vercel token on a command line.
After the matching Vercel production deployment is ready, capture the combined
provider record from the repository root:

```sh
pnpm production-secrets:provider --capture \
  --source-commit <full-40-character-commit> \
  --output <private-release-evidence-path>.json
```

The command uses Railway SSH to execute the already-deployed value-free audit;
it never calls Railway's variable export. It requests Vercel environment
metadata with decryption disabled, rejects any response containing a
value/secret/token/credential field, and accepts only production-scoped
`sensitive` records that predate the exact ready deployment. The two required
Vercel names are `CLAWCHAT_RAILWAY_ORIGIN` and
`NEXT_PUBLIC_RAILWAY_WS_BASE_URL`; secret-shaped, Mission Control, OpenClaw,
and retired direct-backend variables are forbidden. A failed capture blocks
release promotion.

Revalidate an archived record with:

```sh
pnpm production-secrets:provider --validate <evidence.json> \
  --source-commit <full-40-character-commit>
```

## Logging and review

- audit logs are available through `GET /audit-logs?workspaceId=...`
- workspace security counters are available through `GET /audit-logs/metrics?workspaceId=...`
- treat `security.cross_workspace_access.denied` as a launch-blocking signal
- redact secrets and tokens from application logs and operator screenshots
- archive only the strict provider-evidence JSON; never archive provider API
  responses or Railway/Vercel environment exports

## Browser cookies and CSRF

- browser access and refresh cookies are host-only, `HttpOnly`,
  `SameSite=Lax`, `Secure` in production, and scoped to `/`
- the readable `clawchat_web_csrf` cookie is a random double-submit value, not
  an authentication credential or reusable server secret
- browser registration, login, and refresh must first obtain the CSRF cookie
  from `GET /api/v1/auth/csrf` and return the same value in
  `x-csrf-token`
- every unsafe cookie-authenticated request must carry the matching pair;
  bearer-authenticated native/API requests remain outside this browser-only
  protocol
- browser access JWTs are cookie-only and must resolve to an active browser
  session; presenting one as a bearer token must fail, while mobile/API tokens
  are bearer-only
- every access/refresh JWT has a unique token ID; refresh hashes rotate with an
  atomic previous-hash condition, and detected reuse revokes the browser/mobile
  session or clears the legacy refresh slot
- simultaneous refreshes are coalesced within one web tab; a reuse-revoked
  session requires the user to sign in again
- every sid-bearing native access request resolves a non-revoked
  `mobile_sessions` row; device revocation, logout, password reset, and account
  deletion therefore invalidate access immediately rather than waiting for JWT
  expiry
- sid-less legacy native JWTs are accepted only while the old single refresh
  slot exists; login or the first valid refresh clears that slot and moves the
  client to a sid-bearing session transactionally
- authenticated browser/mobile sockets retain their exact session ID; logout,
  manual revoke, password change/reset, account deletion, refresh rejection,
  and reuse detection close the matching realtime connection after revocation
- reconnect authentication rechecks the non-revoked web/mobile session row;
  never treat an established socket as authority independent of its session
- a missing or mismatched pair must return HTTP 403 before controller logic
  runs; never weaken this gate to recover from a client integration failure

## Incident response

### Revoke one browser session

- call `POST /auth/web/sessions/:sessionId/revoke`
- affected websocket clients are disconnected immediately

### Revoke all browser sessions for one user

- call `POST /auth/web/sessions/revoke-all`

### Revoke one paired bridge device

- call `POST /bridge/devices/:id/revoke`

### Revoke all paired bridge devices for one workspace

- call `POST /bridge/workspaces/:id/devices/revoke-all`

## Key rotation

### Encryption keys

1. add the new key to `APP_ENCRYPTION_KEYS` while keeping existing versions available
2. switch `APP_ENCRYPTION_KEY_VERSION` to the new version
3. restart the backend
4. re-save sensitive credentials so they are written with the new key version

### JWT secrets

1. confirm the dedicated invite-hash key is configured and that the backend has
   completed legacy invite-hash migration before changing `JWT_SECRET`
2. rotate `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `JWT_WS_SECRET` independently
3. rotate `ATTACHMENT_PROVENANCE_SECRET` and `ATTACHMENT_SIGNING_SECRET` through
   their own controlled procedures; do not reuse any JWT value
4. restart the backend and revoke browser sessions and bridge devices if
   compromise is suspected

### Invite-hash key

1. add the new `CLAWCHAT_BETA_INVITE_HASH_SECRET` and put the old invite-hash
   key in `CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS`
2. restart the backend without changing JWT keys; startup migrates every
   configured invite hash before accepting traffic
3. verify consumed configured invites remain rejected and issue replacements
   for any pending database-only invite that cannot be presented during the
   migration window
4. remove `CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS` and restart

## Backups and restore drills

- enable automated Postgres backups in Railway
- test a restore into staging on a scheduled cadence
- verify audit logs, bridge devices, and encrypted connection records after restore
