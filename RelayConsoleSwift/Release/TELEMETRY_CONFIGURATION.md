# Relay Console telemetry configuration

Relay Console uses PostHog for opt-in product analytics and Sentry for opt-in
crash and error diagnostics. Both controls default to off and are stored per
local profile. Neither SDK is initialized until the active profile has opted in
to the corresponding service.

After the initial local profile loads, Relay presents a required first-launch
privacy step. PostHog and Sentry are explained and selected independently; both
switches start off. The user may explicitly enable both with the primary action,
enable either service, or continue with both disabled. Completing the step is
stored separately from the two consent values so declining does not cause the
prompt to return. Both choices remain available under **Settings → Account**.

## Release configuration

Set these variables when running `Scripts/build-release-app.sh` or
`Scripts/build-distribution.sh`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `RELAY_POSTHOG_PROJECT_TOKEN` | For PostHog | Public PostHog project token embedded in the app bundle |
| `RELAY_POSTHOG_HOST` | No | HTTPS ingestion host; defaults to `https://eu.i.posthog.com` |
| `RELAY_SENTRY_DSN` | For Sentry | Public HTTPS Sentry DSN embedded in the app bundle |
| `RELAY_TELEMETRY_ENVIRONMENT` | No | Environment label; defaults to the release channel |

The same variables can be supplied to a development launch. Build-time values
are written to `Info.plist`; environment values take precedence at runtime.
The PostHog token and Sentry DSN are client-side routing identifiers, not
administrative secrets. PostHog personal API keys, Sentry auth tokens, and
provider credentials must never be embedded.

Example:

```sh
RELAY_POSTHOG_PROJECT_TOKEN='phc_…' \
RELAY_POSTHOG_HOST='https://eu.i.posthog.com' \
RELAY_SENTRY_DSN='https://public-key@o0.ingest.sentry.io/0' \
RELAY_TELEMETRY_ENVIRONMENT='production' \
Scripts/build-release-app.sh
```

## Sentry symbol upload

The release builder emits `Relay Console.app.dSYM` beside the app. To upload it
during the build, install `sentry-cli` and set:

| Variable | Purpose |
| --- | --- |
| `SENTRY_AUTH_TOKEN` | Secret CI token with debug-file upload access |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |

These three values are used by the build process only and are not embedded in
the app. If `SENTRY_AUTH_TOKEN` is present, the build fails closed when the
other values, `sentry-cli`, or the dSYM are missing.

The public GitHub release workflow reads production values from the
`macos-production-release` environment. Configure these environment variables:

- `RELAY_POSTHOG_PROJECT_TOKEN`
- `RELAY_POSTHOG_HOST`
- `RELAY_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `CLAWCHAT_RAILWAY_ORIGIN`
- `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`

Configure `SENTRY_AUTH_TOKEN` as an environment secret. The workflow pins the
Sentry CLI used for the dSYM upload and sets
`RELAY_REQUIRE_PRODUCTION_TELEMETRY=1`, so a public release cannot silently
ship without PostHog, Sentry, or symbol upload configuration.

The same environment stores the Apple Team ID as `APPLE_TEAM_ID`; the release
workflow passes it to the distribution builder and verifies that it matches the
TeamIdentifier in the signed application.

## Data boundary

PostHog receives only:

- `app_launched`
- `screen_viewed`
- `action_succeeded`
- `action_failed`
- `telemetry_preferences_updated`

Properties are restricted to screen and action families, outcome, coarse
duration bucket, consent state, and release channel. The distinct ID is the
first 128 bits of a SHA-256 digest over a namespaced local profile ID.

Sentry receives automatic crash, uncaught exception, app-hang, processed
MetricKit, release, session, macOS, and device data. Manually reported errors
are converted to a fixed description with an allowlisted Relay error code and
normalized operation. Breadcrumbs contain only action families and outcomes.

The integration deliberately excludes messages, prompts, files, attachments,
credentials, OAuth data, provider payloads, email addresses, display names,
user-selected URLs and paths, raw error descriptions, screenshots, view
hierarchies, network requests, file-I/O tracing, session replay, and performance
tracing.

In the Sentry project’s **Security & Privacy** settings, enable **Prevent
Storing of IP Addresses**. `sendDefaultPii` is disabled in the SDK, but this
server-side setting is the authoritative control for request IP retention.

## Verification checklist

1. Build once without telemetry variables. Both Settings statuses must say the
   service is not configured, and opting in must produce no network traffic.
2. Build with the public token and DSN. Both controls must remain off for a new
   profile and the first-launch privacy step must appear after loading.
3. Opt in to PostHog only. Verify event names and properties against the catalog
   above and verify Sentry receives nothing.
4. Opt in to Sentry only. Trigger a non-fatal test error in a non-production
   test build and verify symbolication, release, environment, and breadcrumbs.
5. Inspect the event in both vendors for authored content, paths, URLs, email,
   names, credentials, and provider data.
6. Opt out again and verify no subsequent events or reports are emitted.
7. Relaunch after accepting or declining the first-launch choices and verify the
   privacy step does not appear again.
