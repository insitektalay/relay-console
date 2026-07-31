# Private owner configuration

Relay Console keeps deployment addresses, Apple signing identity, telemetry
project details, and release credentials outside the public source snapshot.
Your private checkout supplies those values when you build or deploy it.

## Preserve the current native configuration

Run this before integrating a change that replaces tracked deployment or
signing defaults:

```bash
pnpm owner-config:capture
pnpm owner-config:check
```

The capture command creates two files with permissions `600`:

- `RelayConsoleSwift/Config/owner.env`
- `ios/Config/RelayConsoleOwner.xcconfig`

Git ignores both files. The command refuses to replace either file. Delete or
move an obsolete copy yourself before capturing again.

Capture reads the current macOS API and websocket defaults from the maintained
Swift sources and reads the current iOS endpoints from its plist. The browser
continues to use `web/.env.local`. Each client may use a different public alias
for the same deployment, such as a Railway-generated hostname in the browser
and a custom hostname in the native apps. Within each client, its HTTPS API and
WSS websocket addresses must use the same hostname.

The check command reports missing keys by name and suppresses configured
values. Run it before each configuration-sensitive integration.

The checked-in Xcode project keeps its current settings until the self-host
configuration change removes those tracked values. The private xcconfig then
supplies the same identity, endpoints, and Sentry project to your builds.

## Browser and backend configuration

Next.js reads the private browser settings from `web/.env.local`. Railway keeps
the production backend settings in its service variables. The capture command
does not copy or change either system.

Confirm these browser variables in both `web/.env.local` and the Vercel project:

- `CLAWCHAT_RAILWAY_ORIGIN`
- `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`
- `NEXT_PUBLIC_SENTRY_DSN` when web crash reporting is enabled
- `NEXT_PUBLIC_POSTHOG_PROJECT_ID` when web product analytics is enabled

Confirm the Railway service still contains its database, Redis, encryption,
JWT, deployment identity, public origin, and websocket variables before a
backend deployment.

## Public repository

Commit the example files and configuration loaders. Keep the two owner files,
`backend/.env`, `web/.env.local`, signing certificates, and provider credentials
in the private checkout or their managed services.
