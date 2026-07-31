# Relay Console iOS PostHog and Sentry Setup

The iOS app reads PostHog and Sentry settings from build settings expanded into
`ClawChat/App/Info.plist`.

Client routing settings:

- `POSTHOG_PROJECT_TOKEN`: public PostHog project token.
- `POSTHOG_HOST`: HTTPS PostHog ingestion host; defaults to the EU host.
- `SENTRY_DSN`: public iOS project DSN from Sentry.

Recommended build settings:

- `SENTRY_ENVIRONMENT`: `development`, `staging`, `testflight`, or `production`.
- `SENTRY_RELEASE`: leave empty to default to `com.relayconsole.app@<version>+<build>`, or set explicitly from CI.

For local development, set these in an uncommitted `.xcconfig` or in Xcode scheme/build settings. For TestFlight and App Store builds, set them in CI or the release build configuration.

Privacy boundary:

- Product analytics and crash reporting both default off. A required
  first-launch screen records the user's independent choices before either SDK
  can initialize, and Settings can withdraw either choice later.
- PostHog receives allowlisted product events and pseudonymous identifiers.
  Automatic lifecycle events, screen capture, autocapture, feature-flag
  requests and error autocapture are disabled.
- Sentry receives only pseudonymous identifiers, sanitized crashes/errors,
  hangs, watchdog terminations and allowlisted operational scalars. It does not
  receive the user's name or email.
- Request data, automatic network breadcrumbs/tracing, file-I/O tracing,
  performance tracing, screenshots, view hierarchies, default PII and event
  extras are disabled.
- File/folder paths, URLs, messages, prompts, content, credentials,
  authorization material, provider error descriptions and unknown strings are
  redacted. Captured errors retain only a bounded domain and numeric code.
- Run `pnpm run test:ios-telemetry-privacy` before archiving.

The PostHog project token and Sentry DSN are public client routing identifiers.
Do not place a PostHog personal API key or Sentry auth token in the app bundle.

Symbolication requirements:

- Keep Debug Information Format as `DWARF with dSYM File` for release/TestFlight builds.
- Install `sentry-cli` in CI and set the build-only secrets
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`.
- After creating the archive, run
  `Scripts/upload-sentry-dsyms.sh /absolute/path/to/ClawChat.xcarchive`.
  The script skips cleanly when no auth token is configured and fails closed
  when an attempted upload is incomplete or has no dSYMs.
- Verify Sentry release name matches the uploaded dSYM release/dist metadata.

The Sentry upload credentials are CI secrets. They must not be added to an
`.xcconfig`, Info.plist, app bundle, or any `NEXT_PUBLIC_*` variable.

The complete configuration and verification matrix is in
[`../docs/TELEMETRY_CONFIGURATION.md`](../docs/TELEMETRY_CONFIGURATION.md).

Backend configuration remains Railway-only:

- `RelayConsoleAPIBaseURL` must target the Railway `/api/v1` origin.
- `RelayConsoleWebSocketBaseURL` must target the Railway websocket origin.
- Do not configure loopback API or websocket origins.
