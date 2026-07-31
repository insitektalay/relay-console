# Relay telemetry configuration

Relay uses PostHog for optional product analytics and Sentry for optional crash
and error reports on macOS, iPhone/iPad, and web.

The consent contract is the same on every client:

- Both choices default to off.
- First launch requires the user to save independent choices before continuing.
- A primary **Enable both and continue** action explains the benefits without
  preselecting either choice.
- Continuing with one or both disabled is fully supported.
- Settings provides independent switches that can be withdrawn at any time.
- The corresponding SDK is not initialized before consent. Turning a category
  off stops its client and clears its active identity.

## Values to create

Create a PostHog project and a Sentry project for each release surface. Separate
projects for macOS, iOS, and web are recommended because they simplify release
health, retention, deletion, dashboards, and platform-specific alerting.

You need these public routing values:

| Service | Value | Safe in client bundle |
| --- | --- | --- |
| PostHog | Project token, normally beginning `phc_` | Yes |
| PostHog | HTTPS ingestion host | Yes |
| Sentry | Project DSN | Yes |

A Sentry **DSN** is likely the value previously referred to as a “SAGDNS.” It
is not an administrative token. Do not provide or embed PostHog personal API
keys or Sentry auth tokens.

Symbol upload additionally uses these secret build-only values:

| Value | Used by |
| --- | --- |
| `SENTRY_AUTH_TOKEN` | macOS build, iOS archive CI, web production build |
| `SENTRY_ORG` | macOS build, iOS archive CI, web production build |
| `SENTRY_PROJECT` | macOS build, iOS archive CI, web production build |

Use a least-privilege organization token that can upload debug files/source
maps. Store it only in CI, Vercel, or the secure release environment.

## Platform configuration

### macOS

Supply these environment variables to
`RelayConsoleSwift/Scripts/build-release-app.sh`:

```sh
RELAY_POSTHOG_PROJECT_TOKEN='phc_public_project_token'
RELAY_POSTHOG_HOST='https://eu.i.posthog.com'
RELAY_SENTRY_DSN='https://public-key@o0.ingest.sentry.io/0'
RELAY_TELEMETRY_ENVIRONMENT='production'
```

The builder writes public values to the app Info.plist. When all three
build-only Sentry values are present, it uploads the generated dSYM with
`sentry-cli`; a partially configured upload fails the release build.

### iPhone and iPad

Set these Xcode build settings for the release configuration:

```text
POSTHOG_PROJECT_TOKEN = phc_public_project_token
POSTHOG_HOST = https://eu.i.posthog.com
SENTRY_DSN = https://public-key@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT = production
SENTRY_RELEASE = com.relayconsole.app@version+build
```

The first three public values expand into `ClawChat/App/Info.plist`. Keep all
Sentry auth credentials out of Xcode build settings that are copied into the
bundle. After archiving, CI uploads dSYMs with:

```sh
SENTRY_AUTH_TOKEN='secret' \
SENTRY_ORG='relay' \
SENTRY_PROJECT='relay-ios' \
ios/Scripts/upload-sentry-dsyms.sh '/absolute/path/ClawChat.xcarchive'
```

### Web

Configure these public Vercel environment variables:

```text
NEXT_PUBLIC_POSTHOG_PROJECT_ID=phc_public_project_token
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
NEXT_PUBLIC_SENTRY_DSN=https://public-key@o0.ingest.sentry.io/0
NEXT_PUBLIC_TELEMETRY_ENVIRONMENT=production
```

For symbolicated browser stacks, configure all three build-only values in
Vercel:

```text
SENTRY_AUTH_TOKEN=secret
SENTRY_ORG=relay
SENTRY_PROJECT=relay-web
```

The production build uploads source maps and removes them from the deployment
output. A partial credential set fails the build. None of these three secrets
may use the `NEXT_PUBLIC_` prefix.

Web API traffic remains on `/api/v1`, rewritten to the Railway backend through
`CLAWCHAT_RAILWAY_ORIGIN`; telemetry configuration does not change backend
routing.

## Collection boundary

PostHog is configured for explicit, allowlisted events only. Automatic
lifecycle capture, page/screen capture, element autocapture, heatmaps, dead
clicks, surveys, feature flags, error autocapture, performance capture, and
session replay are disabled. Events describe coarse screens, product actions,
outcomes, and consent changes. User and workspace identifiers are
pseudonymous SHA-256-derived values.

Sentry is configured for crashes and manually reported operational errors.
Performance tracing and replay are disabled. Relay removes request data,
authored content, user-provided URLs and local paths, query strings,
credentials, names, email addresses, payloads, screenshots, view hierarchies,
default PII, and unapproved contexts before sending. Public application code
locations remain where needed for symbolication. macOS/iOS retain platform
crash information required for diagnosis; web uses an integration-free,
manually sanitized error path.

Keep vendor-side IP storage disabled, use the shortest practical retention
period, restrict staff access, and document PostHog and Sentry as subprocessors.

## Release verification

For each platform and release environment:

1. Start with a clean profile/browser storage. Confirm both switches are off and
   the first-launch choice appears.
2. Continue with both disabled. Confirm no request goes to PostHog or Sentry.
3. Enable PostHog only. Confirm allowlisted events arrive and Sentry remains
   silent.
4. Enable Sentry only. Trigger a non-production test error and confirm PostHog
   remains silent.
5. Confirm Sentry resolves the stack against the matching dSYM/source map,
   release, and environment.
6. Inspect payloads in both vendors for messages, prompts, files, paths, URLs,
   names, emails, credentials, provider data, or other authored content.
7. Disable each category in Settings and confirm subsequent collection stops.
8. Relaunch and confirm the saved choices persist without showing first launch
   again.
9. Re-run the same checks after reinstall/data clearing, SDK upgrades, or any
   consent-storage migration.

Before shipping iOS, republish the App Store privacy answers from
`ios/AppStore/app-privacy-disclosures.json`; the PostHog pseudonymous device
identifier adds a declared data type to the previous submission.
