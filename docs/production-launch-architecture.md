# ClawChat Production Launch Architecture

Historical note: this document is the pre-launch architecture audit and migration plan. It intentionally describes the old shared-secret model and other pre-hardening gaps that have since been removed from the codebase.

## Status

Draft intended for this repository as of 2026-03-28.

This document turns the current codebase into a concrete production architecture plan for launching ClawChat as a public product.

It is written against the current repository shape:

- `web/`: Next.js browser client
- `backend/`: NestJS API, auth, realtime, bridge, reporting, storage
- `ios/`: iOS client
- `packages/`: shared contracts and web SDK

---

## Executive Summary

ClawChat needs authentication even if users cannot directly message each other.

The reason is simple: once ClawChat is hosted on Railway, the hosted service becomes the control plane that must decide:

- which human user is signed in
- which workspace belongs to them
- which local Open Core installation is paired to that workspace
- which browser, device, plugin, thread, report, and API call is allowed to access which data

The current repository already has a usable base for browser sessions:

- password login and registration
- hashed passwords
- JWT access and refresh flows
- browser cookie sessions
- CSRF protection
- short-lived websocket tickets

However, at the start of this launch-hardening plan the repository was not yet
safe for public multi-user launch.

The main launch blockers tracked by this plan were:

1. The legacy bridge layer relied on one shared `x-bridge-secret`.
2. The legacy browser flow stored the bridge secret in `localStorage`.
3. Some backend ownership and membership checks are incomplete.
4. Websocket subscriptions are not yet access-controlled per workspace/thread.
5. Connection credentials are stored server-side without application-level encryption at rest.

The recommended production model is:

- keep standard account authentication
- keep Railway-hosted backend as the control plane
- require each Open Core plugin to create an outbound, authenticated connection to the backend
- bind every plugin connection to a specific workspace and user-approved device record
- enforce authorization on every HTTP and realtime path
- treat message content as server-readable in v1 unless ClawChat explicitly chooses a high-complexity end-to-end encrypted mode

This is not the same as "Telegram secret chats everywhere", and that is important. Telegram's default model is not universal end-to-end encryption. Secret chats are a separate mode with meaningful product tradeoffs.

---

## Current-State Assessment

### What the repo already does well

- Browser auth exists in `backend/src/modules/auth`.
- Passwords are hashed with bcrypt.
- Browser sessions can use secure cookies and CSRF.
- Web sessions can be revoked.
- Realtime websocket tickets are short-lived.
- Workspaces already have an `ownerId`.
- The web app already talks to a hosted websocket endpoint.

### What is unsafe for public launch

#### 1. Global bridge secret

Status as of 2026-06-19: product code now uses one-time bridge enrollment,
per-device credentials, and bridge-device bearer/websocket tokens. Keep this
section as historical rationale and as a regression target.

The legacy bridge controller accepted a single shared secret:

- `backend/src/modules/bridge/bridge.controller.ts`

This is fine for one operator running their own system. It is not acceptable once unrelated customers share one hosted backend.

Problems:

- one secret can grant cross-customer bridge access if leaked
- the browser is asked to know the secret
- the secret is stored locally in the browser
- the secret becomes effectively an admin backdoor for bridge routes

#### 2. Browser-side secret persistence

Status as of 2026-06-19: no active web UI bridge-secret localStorage flow remains
in the product source. Browser-side credential storage still has its own broader
hardening item later in the beta backlog.

The legacy web app stored the bridge secret in `localStorage`:

- `web/components/clawchat-web-app.tsx`
- `web/hooks/use-persistent-selection.ts`

This means any XSS can steal it, browser extensions can inspect it, and it persists beyond a session.

#### 3. Incomplete workspace authorization

`WorkspaceService.findOne` currently accepts `userId` but does not enforce ownership:

- `backend/src/modules/workspace/workspace.service.ts`

Some controller routes call it as if it were an authorization check.

#### 4. Incomplete thread and message authorization

Thread and message access still need hard ownership/membership verification:

- `backend/src/modules/thread/thread.controller.ts`
- `backend/src/modules/thread/thread.service.ts`
- `backend/src/modules/message/message.controller.ts`
- `backend/src/modules/message/message.service.ts`

#### 5. Realtime subscription authorization gaps

The realtime gateway accepts workspace and thread subscriptions after socket auth, but does not verify that the socket is actually authorized for the requested scope:

- `backend/src/gateways/events.gateway.ts`

#### 6. Permission system exists but is not yet the enforcement layer

There is a permission policy module, but it is not the primary source of truth for access control yet:

- `backend/src/modules/permissions`

#### 7. Sensitive connection credentials need application-level encryption

Current backend connection-secret storage uses application-level AES-256-GCM before values are written to Postgres:

- `backend/src/entities/openclaw-connection.entity.ts`
- `backend/src/entities/marketplace-connection.entity.ts`
- `backend/src/entities/marketplace-oauth-state.entity.ts`
- `backend/src/entities/paperclip-connection.entity.ts`
- `backend/src/modules/security/encryption.service.ts`

Each encrypted value stores ciphertext, IV, auth tag, and key version with secret columns excluded from default selects. Launch operations still require a strong server-only `APP_ENCRYPTION_KEY`, a matching `APP_ENCRYPTION_KEY_VERSION`, and key-ring retention through `APP_ENCRYPTION_KEYS` during rotations.

---

## Production Goals

### Primary goals

- safe public multi-user launch
- simple onboarding for non-technical users
- secure binding between browser account and local Open Core plugin
- least-privilege access to workspaces and threads
- no inbound port exposure on the customer machine
- auditable control plane
- support for multiple user devices

### Non-goals for first public launch

- full Telegram-style end-to-end encryption for all stored content
- zero-knowledge server architecture
- anonymous or phone-number-based identity
- peer-to-peer direct browser-to-Open-Core networking

These can be future roadmap items, but they should not block a secure v1.

---

## Recommended Trust Model

ClawChat needs a clear statement of trust boundaries.

### Recommended v1 trust model

- The ClawChat backend is trusted to process and store workspace metadata, messages, reports, tasks, and bridge coordination data.
- Open Core plugins are trusted only for the workspaces they are explicitly enrolled into.
- Browsers are trusted only as user interfaces, not as secret stores.
- The backend never trusts the browser to assert workspace access by itself.
- The backend never trusts a global shared bridge secret.

### Plain-English product statement for v1

"ClawChat encrypts data in transit and protects data at rest, but the hosted service can process workspace content to provide orchestration, reports, sync, and management features."

That statement is materially different from:

"Only your devices can read your messages."

Do not claim the second one unless the architecture truly enforces it.

---

## Target Production Architecture

## High-Level Topology

```text
Browser / iOS app
    |
    | HTTPS + secure cookies / bearer for mobile
    v
ClawChat API + Realtime (Railway)
    |
    | Postgres
    v
Database

User machine running Open Core + ClawChat plugin
    |
    | outbound TLS websocket / HTTPS only
    v
ClawChat API + Realtime (Railway)
```

Key principle:

- the customer machine makes outbound connections to Railway
- Railway never needs to call `localhost` on the customer's machine
- no inbound public port needs to be exposed on the customer machine

This is the right production networking model.

---

## Authentication Architecture

### Human user authentication

Keep and harden the current account system.

#### Recommended model

- email + password for v1
- bcrypt or Argon2id password hashing
- httpOnly secure cookies for browser sessions
- rotating refresh tokens
- short-lived access tokens
- session table for revocation
- optional TOTP 2FA after launch

#### Browser auth recommendation

Prefer browser cookie sessions as the primary web auth model.

Status as of 2026-06-19: the web SDK uses cookie-session auth for browser
login, refresh, logout, websocket-ticket issuance, and browser registration.
Browser registration now uses `/auth/web/register` so access and refresh tokens
are written to httpOnly cookies by the backend and are not returned to
JavaScript. A static web regression test blocks token-shaped Web Storage keys
and legacy `/auth/register` usage from browser source.

Target state:

- browser uses cookie session only
- access cookie is httpOnly + secure + sameSite
- refresh cookie is httpOnly + secure + sameSite
- CSRF remains enabled
- `localStorage` should not contain bearer tokens or bridge credentials

#### Mobile auth recommendation

Mobile can continue to use token-based auth if needed, but the token lifecycle should still be revocable server-side.

---

## Device and Plugin Authentication

This is the most important architecture change in the repository.

### Current problem

The plugin and browser are effectively sharing one global bridge secret.

### Target model

Each installed plugin becomes a first-class device identity.

Introduce a new entity:

- `BridgeDevice`

Suggested fields:

- `id`
- `workspaceId`
- `createdByUserId`
- `label`
- `devicePublicId`
- `deviceSecretHash` or `devicePublicKey`
- `status` (`pending`, `active`, `revoked`)
- `lastSeenAt`
- `capabilities`
- `openCoreVersion`
- `pluginVersion`
- `createdAt`
- `updatedAt`

Introduce a second short-lived entity:

- `BridgeEnrollment`

Suggested fields:

- `id`
- `workspaceId`
- `createdByUserId`
- `oneTimeCodeHash`
- `expiresAt`
- `usedAt`
- `deviceLabel`
- `status`

### Enrollment flow

#### Recommended flow for pairing a local plugin to a workspace

1. User signs in to ClawChat in the browser.
2. User chooses a workspace.
3. Browser requests a short-lived bridge enrollment from the backend.
4. Backend creates a one-time enrollment code or token valid for a few minutes.
5. User pastes that code into the Open Core plugin, or the plugin reads it through a local pairing flow.
6. Plugin exchanges the one-time code for a device credential.
7. Backend creates a `BridgeDevice` bound to that specific workspace.
8. Plugin stores its device credential locally in the Open Core/plugin config.
9. Plugin opens an authenticated outbound websocket to Railway.
10. Backend authorizes the plugin only for that workspace and that device.

### Important properties

- no browser-visible bridge master secret
- no global bridge secret
- one device can be revoked without breaking others
- one workspace can have more than one paired machine if desired
- device audit trail becomes possible

### Credential format options

#### Simpler v1

- random device token
- store only a hash server-side
- plugin presents token on connect

#### Better long-term

- device keypair
- plugin signs a server challenge
- backend stores public key only

Recommendation:

- use random device tokens first
- move to asymmetric device keys later if required

---

## Realtime / Bridge Connectivity

### Recommended model

The plugin should maintain an outbound authenticated websocket connection to the backend.

This websocket should be used for:

- bridge control messages
- sync triggers
- library reads/writes
- agent workspace reads/writes
- task dispatch
- typing or status events if needed

### Why outbound websocket is preferred

- works behind NAT and home routers
- works on laptops without port forwarding
- no inbound attack surface on customer machine
- easy to reconnect
- good fit for "local Open Core talks to hosted control plane"

### Connection lifecycle

1. Plugin starts.
2. Plugin loads device credential from local secure storage.
3. Plugin authenticates to backend.
4. Backend returns an authorized session scoped to one workspace/device.
5. Plugin subscribes only to that workspace's bridge-control channel.
6. Plugin periodically heartbeats.
7. Backend marks `lastSeenAt`.
8. Revoked devices are disconnected immediately.

### Websocket authorization rules

The gateway must not allow:

- arbitrary workspace subscriptions
- arbitrary thread subscriptions
- arbitrary bridge-control subscriptions

The gateway should validate every requested subscription against:

- current authenticated user
- current authenticated web session
- workspace membership
- bridge device scope

---

## Authorization Model

Authentication answers "who are you?"

Authorization answers "what can you access?"

ClawChat needs both.

### Immediate repository changes

#### 1. Make workspace ownership checks real

Fix `WorkspaceService.findOne(id, userId)` so it actually enforces ownership or membership.

Target behavior:

- if workspace does not exist, return 404
- if workspace exists but user is not authorized, return 403

#### 2. Add workspace membership abstraction

Today workspaces are effectively single-owner.

Create:

- `WorkspaceMemberEntity`

Suggested fields:

- `id`
- `workspaceId`
- `userId`
- `role` (`owner`, `admin`, `member`, `viewer`)
- `createdAt`
- `updatedAt`

For v1, owner-only workspaces can still exist, but the authorization layer should be written as membership-based from the start.

#### 3. Enforce workspace guard everywhere

Every route that accepts `workspaceId`, directly or indirectly, should validate access.

This includes:

- workspaces
- threads
- messages
- tasks
- reports
- approvals
- org routes
- capacity routes
- library routes
- agent workspace routes
- websocket subscriptions

#### 4. Enforce thread access through workspace membership

Thread access should not rely on "if you know the thread id".

Target rule:

- user can access thread only if they have access to the thread's workspace

If future private sub-threads exist, add thread-level membership on top of workspace access.

#### 5. Treat permission policies as scoped privileges, not identity

The current permission policy system should sit on top of workspace membership, not replace it.

Recommended layers:

- layer 1: authenticated principal exists
- layer 2: principal is a member of workspace
- layer 3: principal role/policy permits the action

---

## Data Storage Architecture

### Postgres remains the system of record

Store in Postgres:

- users
- sessions
- workspaces
- workspace members
- bridge devices
- bridge enrollments
- threads
- messages
- tasks
- reports
- audit logs
- encrypted third-party credentials

### Add audit logging

Create an append-only audit log table for security-relevant actions.

Suggested events:

- login success/failure
- password change
- session revoke
- bridge enrollment created/used/expired
- bridge device paired/revoked
- workspace export requested
- connection created/updated/deleted
- sensitive file operations against Open Core
- permission changes

This matters for incident response and enterprise credibility.

### Rate limiting and abuse review

The backend uses the Nest throttler as a global guard. `THROTTLE_TTL` and
`THROTTLE_LIMIT` define the global default, while stricter route-level limits
protect public signup/login, waitlist signup, bridge enrollment creation and
redemption, marketplace needed-tool requests, and bridge/runtime marketplace
tool execution.

Throttling emits a redacted `security.rate_limit.exceeded` Railway log event
with controller, handler, route, limit, TTL, reset time, and a hashed tracker so
operators can correlate bursts without exposing raw IP addresses or tokens.

### Operational health checks

Backend liveness is exposed at `/api/v1/health` and `/api/v1/health/live`.
Both anonymous routes return only the same constant liveness result. Backend
readiness is operator-authenticated at `/api/v1/health/ready` and includes a
sanitized database, Redis, and message-condensing Bull queue check. Web uptime
should be monitored with `GET /` until a dedicated web health route is
introduced.
`scripts/check-beta-health.mjs` verifies the backend live/ready endpoints,
deployed web `/api/v1` rewrites, and authenticated websocket smoke while
refusing loopback backend origins for beta checks. It sends the operator secret
only as a request header. Launch evidence should run it with
`CLAWCHAT_BETA_HEALTH_STRICT=true` or `--strict` so a missing operator secret,
skipped web rewrite, or skipped authenticated websocket check fails.

---

## Secret Management

### Server secrets

Production Railway services must have unique, strong values for:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_WS_SECRET`
- `ATTACHMENT_PROVENANCE_SECRET`
- `ATTACHMENT_SIGNING_SECRET`
- `CLAWCHAT_BETA_INVITE_HASH_SECRET`
- database credentials
- application encryption key
- any third-party API keys

Do not allow production fallback defaults such as `bridge-secret-key`. Do not
reuse JWT or encryption keys for attachment provenance/signing or persisted
invite hashes; one-use invite state must survive JWT rotation.

### Encrypt third-party credentials at rest

Values like OpenClaw API keys, marketplace app credentials, OAuth token bundles, OAuth client secrets, and Paperclip bearer tokens are encrypted before they are written to the database.

Current approach:

- application-level AES-256-GCM
- root encryption key loaded from environment
- explicit `base64:` or `utf8:` key parsing for 32-byte keys
- key version stored with ciphertext
- optional `APP_ENCRYPTION_KEYS` key ring for old-version decrypts during rotation

Stored field pattern:

- `*Ciphertext`
- `*Iv`
- `*AuthTag`
- `*KeyVersion`

Regression coverage:

- `backend/src/modules/security/encryption.service.spec.ts`
- `backend/src/modules/security/credential-storage-regression.spec.ts`

Avoid:

- storing plaintext API keys in Postgres
- storing decryptable secrets in logs

### Browser secret policy

Do not store these in `localStorage`:

- bridge credentials
- enrollment tokens
- long-lived bearer tokens
- raw third-party API keys

`localStorage` may still be acceptable for low-risk UI state such as selected workspace id or draft display preferences.

---

## Message Encryption Strategy

This is where product positioning and engineering reality need to stay aligned.

### Baseline protections ClawChat should always have

- TLS for all browser/API/plugin traffic
- secure cookies
- CSRF for cookie sessions
- encrypted secrets at rest
- database backups encrypted by infrastructure provider
- least-privilege access to production systems
- audit logs

### Option A: Server-trusted SaaS encryption

This is the recommended v1.

Properties:

- messages encrypted in transit
- data protected at rest
- backend can read and process content
- supports search, reports, analytics, summaries, orchestration, moderation, support tooling
- easiest to build and operate

Tradeoff:

- ClawChat servers can access plaintext content

### Option B: End-to-end encryption for message content

This is possible, but it materially changes the product.

Properties:

- only user devices can decrypt content
- server stores ciphertext
- server cannot read content

Tradeoffs:

- server-side search becomes difficult or impossible
- reporting and analytics become much harder
- AI orchestration on server-side plaintext becomes impossible unless decrypted client-side
- support/debugging becomes harder
- key recovery becomes a product problem
- multi-device sync becomes significantly more complex

### Recommended decision

For ClawChat v1, do not promise full end-to-end encryption for all conversations and stored artifacts.

Instead:

- build a solid server-trusted SaaS security model first
- be explicit about it
- optionally design a future "high security workspace mode" with stricter limitations

---

## Telegram Comparison

Telegram is often misunderstood.

### What Telegram actually does

Telegram uses two different models:

#### 1. Cloud chats

- default Telegram chats are not standard end-to-end encrypted across all devices
- Telegram servers can process cloud chat data
- cloud chats are designed for multi-device sync and server-side availability

#### 2. Secret chats

- secret chats are Telegram's end-to-end encrypted mode
- keys are established directly between devices
- secret chats are device-specific
- secret chats are not the same as normal Telegram cloud chats
- secret chats trade convenience for stronger privacy properties

### Why this matters for ClawChat

If ClawChat wants:

- browser access
- multi-device access
- server-side reports
- task orchestration
- thread summaries
- moderation and support
- workspace-level administration

then ClawChat behaves more like a cloud-control system than a pure secret-chat messenger.

The closest Telegram analogy for ClawChat v1 is:

- cloud chats with strong account security and transport protection

not:

- secret chats everywhere

### If ClawChat ever wants Telegram-style secret-chat properties

Expect these limitations:

- likely no browser-only recovery without key re-entry
- difficult multi-device sync
- limited or no server-side search
- limited server-generated reports unless computed on a trusted client
- much more difficult backup and support model

### Practical conclusion

Do not say "we should do exactly what Telegram does".

Instead say:

- "We should choose consciously between a server-trusted cloud architecture and an end-to-end encrypted architecture, because Telegram itself splits those models."

That is the accurate design lesson.

---

## Concrete Repository Change Plan

## Phase 0: Launch Blockers

These items should be completed before any public launch.

### 0.1 Remove shared bridge secret from the product model

Replace:

- `x-bridge-secret`
- browser-stored bridge secret
- global bridge-auth assumptions

With:

- per-workspace bridge enrollment
- per-device bridge credentials

Primary files likely affected:

- `backend/src/modules/bridge/bridge.controller.ts`
- `backend/src/modules/bridge/bridge.service.ts`
- `backend/src/gateways/events.gateway.ts`
- `packages/web-sdk/src/index.ts`
- `web/components/clawchat-web-app.tsx`

### 0.2 Fix workspace ownership/membership checks

Primary files:

- `backend/src/modules/workspace/workspace.service.ts`
- `backend/src/modules/workspace/workspace.controller.ts`
- `backend/src/common/guards/workspace-member.guard.ts`

### 0.3 Lock down thread/message authorization

Primary files:

- `backend/src/modules/thread/thread.controller.ts`
- `backend/src/modules/thread/thread.service.ts`
- `backend/src/modules/message/message.controller.ts`
- `backend/src/modules/message/message.service.ts`

### 0.4 Lock down websocket subscriptions

Primary files:

- `backend/src/gateways/events.gateway.ts`

### 0.5 Remove browser-side storage of sensitive credentials

Primary files:

- `packages/web-sdk/src/index.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `web/hooks/use-persistent-selection.ts`
- `web/components/clawchat-web-app.tsx`
- `web/security/client-storage-regression.test.ts`

### 0.6 Encrypt stored third-party credentials

Primary files:

- `backend/src/entities/openclaw-connection.entity.ts`
- `backend/src/entities/marketplace-connection.entity.ts`
- `backend/src/entities/marketplace-oauth-state.entity.ts`
- `backend/src/entities/paperclip-connection.entity.ts`
- `backend/src/modules/bridge/bridge.service.ts`
- `backend/src/modules/marketplace/marketplace.service.ts`
- `backend/src/modules/marketplace/connectors/connector-oauth.service.ts`
- `backend/src/modules/marketplace/connectors/connector-credential.service.ts`
- `backend/src/modules/marketplace/x-marketplace.service.ts`
- `backend/src/modules/paperclip/paperclip-connection.service.ts`
- `backend/src/modules/security/encryption.service.ts`
- `backend/src/modules/security/credential-storage-regression.spec.ts`

---

## Phase 1: Membership and Device Model

### Backend additions

Add entities:

- `WorkspaceMemberEntity`
- `BridgeDeviceEntity`
- `BridgeEnrollmentEntity`
- `AuditLogEntity`

Add modules/services:

- `workspace-membership`
- `bridge-enrollment`
- `device-auth`
- `audit-log`

### New backend routes

Suggested routes:

- `POST /workspaces/:id/bridge-enrollments`
- `POST /bridge/enroll`
- `POST /bridge/device/auth`
- `POST /bridge/devices/:id/revoke`
- `GET /workspaces/:id/bridge-devices`

### Authorization rules

- only workspace owner/admin can create bridge enrollments
- only active enrollment can mint device credential
- each device is bound to exactly one workspace
- each device action is checked against its workspace scope

---

## Phase 2: Browser and Plugin Onboarding

### Browser UX

Replace the current bridge secret input with:

- "Pair local Open Core"
- generate one-time code
- show expiry countdown
- show paired devices
- show connection health
- allow revoke/re-pair

### Plugin UX

Minimal pairing UX:

- paste one-time code
- confirm workspace name
- save device credential locally
- start outbound sync

### Local plugin storage

Store locally:

- device credential
- optional local encryption key material if future E2EE exists
- plugin config

Do not require the user to manually edit a global server secret.

---

## Phase 3: Operational Security

### Railway deployment baseline

- production and staging environments separated
- distinct databases
- distinct JWT secrets
- distinct encryption keys
- restricted operator access
- log redaction for secrets and tokens
- automated backups
- restore drills

### Monitoring

Add:

- auth failure metrics
- bridge enrollment failure metrics
- websocket disconnect rates
- unusual cross-workspace access attempts
- audit log review path

### Incident response

Be able to:

- revoke one web session
- revoke all sessions for one user
- revoke one bridge device
- revoke all bridge devices for one workspace
- rotate encryption keys
- rotate JWT secrets

---

## Phase 4: Optional Advanced Encryption Mode

Do this only after the base SaaS model is stable.

### If ClawChat wants higher privacy mode later

Create an optional workspace mode:

- `securityMode = hosted_trusted | client_encrypted`

#### `hosted_trusted`

- normal SaaS mode
- backend can read content
- all current product features available

#### `client_encrypted`

- message content encrypted client-side
- server stores ciphertext
- reduced feature set clearly documented

Possible limitations in `client_encrypted`:

- no server-side full-text search
- limited reporting
- no server-generated summaries from plaintext
- harder device recovery

This should be treated as a different product mode, not a transparent implementation detail.

---

## Recommended Data Classification

### Class 1: Public/low sensitivity

- avatars
- workspace display names
- UI preferences

### Class 2: Internal workspace metadata

- thread titles
- task states
- agent labels
- org charts

### Class 3: Sensitive business content

- messages
- reports
- notes
- approvals
- incidents

### Class 4: Secrets

- bridge device credentials
- API keys
- enrollment tokens
- reset tokens
- encryption keys

Storage rules:

- Class 4 must never be stored plaintext in browser storage
- Class 4 must be encrypted or hashed appropriately server-side
- Class 3 should have stricter logging and export controls

---

## Suggested API and Entity Additions

## New entities

- `workspace_members`
- `bridge_devices`
- `bridge_enrollments`
- `audit_logs`

## Suggested fields summary

### `workspace_members`

- `workspaceId`
- `userId`
- `role`

### `bridge_devices`

- `workspaceId`
- `createdByUserId`
- `label`
- `devicePublicId`
- `credentialHash`
- `status`
- `lastSeenAt`
- `pluginVersion`
- `openCoreVersion`

### `bridge_enrollments`

- `workspaceId`
- `createdByUserId`
- `codeHash`
- `expiresAt`
- `usedAt`
- `status`

### `audit_logs`

- `actorType`
- `actorId`
- `workspaceId`
- `eventType`
- `resourceType`
- `resourceId`
- `ipAddress`
- `userAgent`
- `metadata`

---

## Concrete Coding Backlog

## Priority A

- enforce workspace ownership in `WorkspaceService.findOne`
- audit every controller route that accepts `workspaceId`
- audit every controller/service route that accepts `threadId`
- audit websocket subscription authorization
- remove bridge secret UI from web app
- add bridge enrollment + device credentials
- add encrypted storage for Open Core connection secrets

## Priority B

- browser auth moved away from `localStorage` bearer persistence
- add workspace membership table
- add audit log table and service
- add bridge device management UI
- add admin revocation flows

## Priority C

- add 2FA
- add login alerts for new devices
- add optional encrypted workspace mode
- add enterprise key management integrations

---

## Testing Strategy

### Security-critical automated tests

- user A cannot read user B workspace
- user A cannot subscribe to user B workspace realtime channel
- user A cannot read user B thread by id
- revoked web session is disconnected
- revoked bridge device cannot reconnect
- expired enrollment code cannot be redeemed
- bridge device for workspace A cannot act on workspace B
- encrypted secret columns round-trip correctly

### Manual testing

- pair a machine from browser
- revoke a single paired machine
- reconnect plugin after restart
- rotate session cookies
- simulate stolen browser session
- simulate leaked bridge token

---

## Migration Order

Recommended order of implementation:

1. Fix authorization bugs first.
2. Add workspace membership abstraction.
3. Add bridge enrollment and per-device credentials.
4. Remove shared bridge secret from UI, SDK, and backend.
5. Encrypt sensitive server-side stored credentials.
6. Harden observability, revocation, and audit logging.
7. Consider advanced encryption modes later.

This order reduces launch risk fastest.

---

## Recommended Product-Security Positioning

For the public website, docs, and onboarding copy, use language like:

- "Your workspace is isolated by account and workspace permissions."
- "Your local Open Core connects outbound to ClawChat through a paired plugin."
- "Sensitive credentials are protected and sessions/devices can be revoked."
- "ClawChat encrypts data in transit and secures it at rest."

Avoid saying:

- "Only you can read your messages"
- "Telegram-style end-to-end encryption"
- "Zero-knowledge"

unless the architecture has been changed enough to make those claims true.

---

## Final Recommendation

ClawChat should launch first as a secure, server-trusted control plane for local Open Core installations.

That means:

- real user auth
- real workspace authorization
- real per-device plugin identity
- no global bridge secret
- no browser-stored sensitive bridge credentials
- encrypted server-side stored secrets
- explicit trust model

This is the shortest path to a credible, production-safe public launch.

Telegram is useful as a comparison only if the distinction is kept clear:

- Telegram cloud chats prioritize sync and server mediation
- Telegram secret chats prioritize end-to-end privacy and accept product limits

ClawChat should make that choice deliberately instead of assuming both are possible at once without tradeoffs.
