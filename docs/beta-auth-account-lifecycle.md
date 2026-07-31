# Beta Auth And Account Lifecycle

## Public Beta Posture

- Signup is invite-only with `CLAWCHAT_BETA_SIGNUP_MODE=invite`.
- Invite seed codes live in `CLAWCHAT_BETA_INVITE_CODES` as a comma-separated
  backend environment variable. On first successful use, the backend creates a
  hashed `beta_invites` record and consumes it as a one-use invite.
- Persisted invite hashes use the separate
  `CLAWCHAT_BETA_INVITE_HASH_SECRET`, never a JWT or encryption key, so rotating
  authentication keys cannot reset one-use invite consumption.
- The web app uses cookie sessions through `/api/v1/auth/web/register`,
  `/api/v1/auth/web/login`, `/api/v1/auth/web/refresh`, and
  `/api/v1/auth/web/logout`.
- Browser registration, login, and refresh require a matching random
  `clawchat_web_csrf` cookie and `x-csrf-token` header before a session can be
  created or rotated. Every other unsafe request carrying a browser access or
  refresh cookie has the same double-submit requirement.
- The legacy mobile refresh endpoint verifies the refresh JWT before rotating
  refresh-token state.
- New native registration and login always create a `mobile_sessions` row and
  issue sid-bearing access/refresh JWTs. Every sid-bearing mobile access request
  must resolve that same non-revoked row, so logout, manual revocation, password
  reset, and account deletion take effect on the next authenticated request.

## Supported Beta Paths

| Need | Supported path | Evidence |
| --- | --- | --- |
| Invite-code signup | `POST /api/v1/auth/web/register` with `inviteCode` | `AuthService.registerWeb` and `AuthService.register` enforce invite-only signup through bounded `beta_invites` records. Raw seed codes are never stored in the database. |
| Browser login/refresh | `POST /api/v1/auth/web/login`, `POST /api/v1/auth/web/refresh` | The web SDK first obtains a CSRF cookie from `GET /api/v1/auth/csrf`, returns the same value in `x-csrf-token`, and then creates or rotates the cookie session. Sessions are stored in `web_sessions` and refresh rotation updates the session hash. |
| Logout/session revoke | `POST /api/v1/auth/web/logout`, `POST /api/v1/auth/web/sessions/<session-id>/revoke`, `POST /api/v1/auth/web/sessions/revoke-all` | Logout and manual revoke mark web sessions revoked and disconnect the active websocket session. |
| Waitlist persistence | `POST /api/v1/waitlist` | Waitlist submissions are upserted by normalized email and submission count is incremented. The record stores email, source, origin, user-agent, trusted client IP when available, submission count, first-created timestamp, and latest-submission timestamp for beta access/support triage. |
| Email verification | `POST /api/v1/auth/email-verification/complete` and `/resend` | New accounts receive a 24-hour, one-time verification link. Existing invited beta accounts are marked verified by migration. Relay Connect and managed Relay Cloud checkout refuse unverified accounts. |
| Password reset | `POST /api/v1/auth/password-reset/request` and `/complete` | Requests are non-enumerating. Resend delivers a 30-minute, one-time link; completion replaces the password and revokes web, mobile, legacy refresh, and live websocket sessions. |
| Account export | `GET /api/v1/auth/account/export` | Exports the profile, memberships, audit summaries, and every registered workspace-scoped entity for owned workspaces. Password, session, OAuth verifier, provider credential, and encrypted-secret fields are excluded. |
| Account deletion | `DELETE /api/v1/auth/account` | Requires the current password and exact `DELETE` confirmation. It refuses active subscriptions or shared-workspace ambiguity, then removes owned workspaces and their data, sessions, bridge devices, OAuth/Marketplace connections, refresh state, and the account. |

## Waitlist Privacy Handling

Decision for the first public beta: waitlist signup is a support and access
triage queue, not a marketing analytics pipeline.

Stored fields:

- normalized email address
- signup source
- request origin
- user-agent
- trusted client IP when available from the backend request context
- submission count
- first-created timestamp
- latest-submission timestamp

Handling rules:

- Do not export waitlist rows to third-party marketing tools without a separate
  privacy/product decision.
- Do not paste raw waitlist IP addresses, user-agent strings, or email lists into
  public issue trackers, screenshots, chat transcripts, loop reports, or
  generated docs.
- Use waitlist origin, user-agent, and IP metadata only for duplicate detection,
  abuse review, beta access support, and operational troubleshooting.
- Account export and deletion are self-service. A successful deletion also
  removes a matching waitlist row and direct email references in invite data.
- Production account email is enabled only with
  `RELAY_TRANSACTIONAL_EMAIL_ENABLED=true`; production validation then requires
  `RESEND_API_KEY`, `RELAY_EMAIL_FROM`, and `RELAY_PUBLIC_WEB_ORIGIN`.

## Password Reset Operating Model

Password reset and email verification are self-service transactional-email
journeys. Raw action tokens are delivered by email and never stored; the
database stores only SHA-256 token hashes, purpose, expiry, and use time.

User-facing behavior:

- The login screen lets a tester submit a reset request by email.
- The response is non-enumerating: it does not reveal whether the email belongs
  to an account.
- An existing account receives a one-time link that expires after 30 minutes.
- Completion revokes all browser and mobile sessions and clears legacy refresh
  state before the user signs in again.

Operational monitoring:

- Monitor `audit_logs` for `eventType = 'auth.password_reset.requested'`.
- These events are anonymous account-level events with `actorType = 'anonymous'`
  and `actorId` set to the normalized submitted email.
- Monitor `auth.password_reset.email_sent`,
  `auth.password_reset.email_failed`, and `auth.password_reset.completed`.
- Alert on sustained email-provider failures without logging addresses, links,
  action tokens, provider API keys, or message bodies.

Security rules:

- Always return the same request response whether or not an account exists.
- Invalidate earlier unused tokens when a newer token is issued.
- Never place passwords, reset links, cookies, bearer tokens, or provider keys
  in logs, support notes, screenshots, or analytics.

## Browser Session And CSRF Boundary

The browser session cookies are host-only because no `Domain` attribute is
set. Access and refresh cookies are `HttpOnly`, use `SameSite=Lax`, use
`Secure` in production, and have path `/`. The CSRF cookie is deliberately
readable by the first-party web SDK so it can be returned in the
`x-csrf-token` header; it is not an authentication credential.

The backend requires the matching cookie/header pair on browser registration,
login, and refresh even when the request has no existing auth cookie. It also
requires the pair on every unsafe cookie-authenticated request. Native/mobile
and API clients that authenticate with an `Authorization: Bearer` header do not
use the browser CSRF protocol. Password-reset and email-verification completion
use one-time action tokens rather than ambient browser authority.

The access-token kinds are transport-bound: a browser token is accepted only
from the browser access cookie and must reference an active `web_sessions` row;
it is rejected if replayed as a bearer token. Mobile and legacy API tokens are
accepted only through the bearer transport. This keeps browser-session
revocation and CSRF classification effective even if a short-lived browser JWT
is copied out of its normal cookie channel.

Every newly issued access and refresh JWT has a unique token ID, so rotation
cannot reproduce the same signed token when two issues occur within one second.
Browser, mobile, and legacy refresh storage rotates with a compare-and-swap
against the previously verified hash. If another request has already replaced
that hash, Relay treats it as refresh-token reuse, revokes the affected session
(or clears the legacy slot), and requires a fresh login. The web SDK coalesces
simultaneous refresh attempts within one tab to avoid creating that race during
ordinary request recovery.

The remaining pre-session native compatibility path is bounded. A sid-less
legacy access JWT is accepted only while the user's old single refresh slot is
still populated; clearing that slot invalidates the token immediately. The
first valid legacy refresh atomically clears the old slot, creates a real
`mobile_sessions` row, and returns sid-bearing tokens. A normal native login
also clears the old slot within the same transaction that creates its new
session. New registration never creates a legacy slot.

Realtime follows the same revocation boundary. Browser sockets are bound to
their web session, and sid-bearing native sockets are bound to their mobile
session. Logout, manual session revocation, password change, password reset,
account deletion, rejected refresh, and detected refresh reuse close the mapped
socket after revoking its database authority. A reconnect must pass the same
non-revoked-session check as HTTP.

There is no reusable server-side CSRF secret to configure or rotate. Each CSRF
value is random and the protection comes from the browser returning the same
first-party cookie value in a request header that a cross-origin site cannot
read.

## Account Deletion Operating Model

Account export and account deletion are genuine self-service operations.

User-facing behavior:

- Settings > Security offers JSON export before deletion.
- Deletion requires the signed-in user's current password and exact `DELETE`
  confirmation.
- An active Relay Connect or managed Relay Cloud subscription must first be
  cancelled through its recorded billing provider.
- A user must leave or transfer any workspace they do not own.

Deletion behavior:

- Owned workspaces are deleted, which cascades messages, attachments/sync
  objects, agents, runtime bindings, bridge credentials, Marketplace/OAuth
  records, and other workspace-scoped data.
- The account row, action tokens, browser sessions, mobile sessions, and legacy
  refresh state are deleted; connected sockets are actively closed.
- Account-linked audit rows retain event type and timestamp for security/legal
  evidence, but actor references are pseudonymized and IP, user-agent, and
  metadata fields are erased.
- Railway backups and Stripe payment records follow the separately published
  retention schedule and are not represented as immediately erased.

## Invite-Code Administration

There is no in-app invite-code admin API in the current beta repo. That is
intentional for the first public beta because invite codes are authentication
secrets and should not be copied into browser-visible admin screens, chat
messages, reports, or committed files.

Use Railway backend environment management for invite seed administration:

- Issue: generate a new high-entropy beta invite seed outside the repo, append it
  to `CLAWCHAT_BETA_INVITE_CODES`, and redeploy the Railway backend from
  `backend/`. Give each seed to one intended tester only.
- Consume: on first successful registration, the backend stores an HMAC hash in
  `beta_invites`, increments `useCount`, writes `auth.invite.accepted`, and
  rejects later reuse once `useCount >= maxUses`.
- Email-bind or expire: for higher-control invites, create a `beta_invites`
  database row with a server-HMAC `codeHash`, optional lowercase `email`,
  `maxUses`, `expiresAt`, and null `revokedAt`. Do not store raw invite codes.
- Rotate: add a new seed first, verify signup against Railway, then remove old
  unconsumed seeds from `CLAWCHAT_BETA_INVITE_CODES` and redeploy from
  `backend/`.
- Revoke: remove the seed from `CLAWCHAT_BETA_INVITE_CODES` and set
  `revokedAt` on the matching `beta_invites` record if it already exists.
  Existing accounts are not deleted; revoke sessions or request account deletion
  separately if an account is compromised.

Production environment validation rejects short or placeholder invite seeds.
Use at least 16 characters; prefer a generated random value.

The first deployment of the dedicated invite-hash key must keep the current JWT
and encryption keys unchanged. Before the API accepts traffic, startup checks
every configured raw seed for a legacy JWT/encryption-derived database hash and
atomically moves the matching record to the dedicated key. Conflicting records
fail startup. For later invite-hash key rotation, temporarily set the old key in
`CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS`; remove it after configured hashes
migrate. A pending database-only invite whose raw value is unavailable cannot
be migrated and must be revoked/reissued rather than bypassed.

Do not print invite-code values in deployment logs, loop reports, support
tickets, screenshots, or incident notes. Record only that a code was issued,
consumed, rotated, or revoked, who approved it, and the deployment timestamp.
