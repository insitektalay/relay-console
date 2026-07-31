# Relay Console iOS Marketplace OAuth return

## Launch contract

The iPhone/iPad app starts Marketplace provider authorization inside
`ASWebAuthenticationSession`. The authenticated Railway start request stores an
exact return target bound to the initiating workspace and provider:

```text
relayconsole://marketplace/oauth?workspace_id=<workspace>&marketplace_app=<provider>
```

The provider still returns its authorization code and state only to Railway's
registered HTTPS callback. Railway consumes those values, creates or updates
the connection, and then closes the in-app browser with a Relay callback that
contains only:

- workspace ID;
- provider slug;
- `connected` or `error` status;
- the created connection ID on success; or
- the fixed `oauth_failed` error code on failure.

Provider authorization codes, OAuth state, access or refresh tokens, client
secrets, provider error text, URL credentials, and fragments are forbidden in
the app callback. iOS rejects unknown or duplicate query fields, a different
workspace/provider, a different scheme/host/path, mismatched connection IDs,
and any secret-bearing field. After a valid return, iOS reloads the Railway
connection list and accepts the result only when that exact provider connection
exists in the initiating workspace.

## Browser and universal-link boundary

Existing browser-based OAuth continues to return to an approved HTTPS Relay web
origin. The first iOS release uses the canonical `relayconsole` callback scheme
within `ASWebAuthenticationSession`; it does not claim that an Apple associated
domain is configured. An HTTPS universal-link callback can replace this only
after the final Apple Team ID, App ID, signed associated-domain entitlement,
and matching `apple-app-site-association` file exist and pass a real-device
test.

## Evidence and remaining live gate

Repository evidence includes Railway allowlist/secret-stripping tests, iOS
context and sensitive-field parser tests, a static cross-platform regression,
and a successful unsigned `generic/platform=iOS` build-for-testing. The
Foundation-only callback boundary also runs as
`pnpm test:ios-marketplace-oauth-return-host`, so canonical success/error,
workspace/provider mismatch, URL credentials, fragments, duplicate fields,
mismatched connection IDs, and code/state/token/message rejection are executable
without an iOS runtime. The built artifact contains
`com.relayconsole.app.marketplace-oauth` and the `relayconsole` URL scheme.

This flow is not live yet. The backend change must be deployed from `backend/`
to Railway, and a signed real-device acceptance run must prove success,
cancellation, provider denial, wrong-workspace rejection, connection refresh,
and URL/log/history secret absence with a release-eligible provider. Until
that evidence exists, the production checklist OAuth-return item stays open.
