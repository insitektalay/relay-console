# Public Beta OAuth Boundary

No provider is enabled in the current public-beta allowlist. The production app
must not accept or depend on Relay-owned OAuth client secrets, build-time secret
injection, an unregistered custom URL scheme, or a desktop callback listener.

## Required Broker Contract

Before a provider can enter the allowlist, its flow must be implemented and
deployed on the Railway backend under `/api/v1`:

1. The authenticated desktop user requests OAuth configuration/start for the
   exact workspace and provider through the Railway origin configured by
   `CLAWCHAT_RAILWAY_ORIGIN`.
2. Railway owns the provider client secret, generates a 256-bit one-time state
   and PKCE verifier/challenge, encrypts retained verifier material, and returns
   only the authorization URL and expiry to the desktop.
3. The provider returns to
   `/api/v1/marketplace/oauth/{slug}/callback` on Railway. Railway validates the
   exact provider, state hash, expiry, one-time use, redirect URI, and PKCE before
   exchanging the code.
4. Railway validates identity/scopes, stores encrypted provider tokens, deletes
   consumed state/verifier data, and records a redacted audit event.
5. The desktop learns completion only through an authenticated, bounded Railway
   status request. A callback must never place provider tokens or authorization
   codes in a desktop URL.

The existing Railway connector service supplies parts of this contract for its
registered connectors. The Swift public beta does not claim Google or any other
provider usable until the connector, desktop authentication/status exchange,
provider registration, deployment, and real acceptance evidence all exist.

Manual user-owned credentials may remain a separate provider-specific feature,
but they must never be presented as Relay-owned OAuth.
