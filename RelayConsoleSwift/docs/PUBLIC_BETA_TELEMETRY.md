# Public Beta Diagnostics and Telemetry

Relay Console supports opt-in product analytics through PostHog and opt-in crash
and error reporting through Sentry. Both are disabled by default, and neither
SDK is initialized until the active local profile enables the corresponding
choice.

New and legacy profiles treat missing analytics and crash-reporting preferences
as disabled. A required first-launch privacy step explains the benefit and data
boundary for each service. The two switches start off, can be selected
independently, and can be changed later under **Settings → Account**. Relay
remembers completion separately so users who decline are not repeatedly asked.

PostHog receives only allowlisted product events with a pseudonymous profile
identifier. Sentry receives sanitized crashes, errors, hangs, stack traces, and
safe action breadcrumbs. Messages, prompts, files, credentials, provider
payloads, authored content, screenshots, view contents, network requests, and
file operations are excluded. The complete release configuration and data
boundary are documented in `Release/TELEMETRY_CONFIGURATION.md`.
