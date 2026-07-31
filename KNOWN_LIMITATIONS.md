# Known Limitations

Relay Console is an early alpha for technical self-hosters. Expect configuration
work and breaking changes between alpha releases.

## Distribution

- The project does not provide an App Store build for iPhone or iPad.
- Self-hosters build and sign the Apple applications with their own Apple
  account.
- The first public release does not promise a signed or notarized macOS build.
- The project does not provide a managed Relay Console web or Railway service.

## Hosting and upgrades

- Each installation needs its own Railway backend, PostgreSQL database, and
  Redis service.
- Operators deploy database migrations through the backend Railway start
  command and keep their own backups.
- Alpha releases may change API contracts, database schema, or bridge
  compatibility. Read the release notes before updating.
- The project offers no uptime, support-response, or data-recovery service-level
  agreement.

## Runtimes and bridges

- Hermes, OpenClaw, Claude Code, and similar runtimes run on infrastructure the
  operator controls.
- Bridge installation and pairing require a separate compatible plugin release.
- Runtime hosts can execute commands and access configured workspaces. Operators
  must review allowlists, filesystem paths, and credentials before enrollment.
- A runtime may lose active work during network interruption, host shutdown, or
  an incompatible upgrade.

## Marketplace applications

- Provider support varies. Some applications expose a full action set, while
  others have read-only, credential, policy, or runtime restrictions.
- Operators supply and maintain their own OAuth applications, API credentials,
  provider accounts, and usage billing.
- Provider APIs can change without a matching Relay Console release.

## Client differences

The macOS, web, and iOS clients share the Railway data model but do not expose
the same host capabilities. The macOS application can manage local runtimes and
workspaces that a browser or iPhone cannot access.

Report security problems through `SECURITY.md`. Use GitHub issues for other
reproducible defects and include the affected commit or alpha version.
