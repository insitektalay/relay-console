# Public Beta Updates And Rollback

## First-beta decision

Relay Console public beta `0.1.x` uses manual signed updates only. The app may
report that a compatible update exists and open its canonical HTTPS download
page, but it never downloads, replaces, relaunches, downgrades, or rolls back
itself. Background updates, delta patches, feed signing, and automatic rollback
are explicitly out of scope for the first beta and require a later reviewed
product and signing design.

## Update Contract

1. Relay Console accepts only schema version 1 manifests for its current
   `public-beta` channel.
2. Download, release-notes, and support URLs must be public HTTPS URLs. Loopback,
   local, credential-bearing, query, and fragment URLs fail closed.
3. The manifest must name the exact semantic version, build, supported
   architectures, minimum macOS version, and lowercase SHA-256 of the notarized
   DMG.
4. The app opens a download only when the manifest is valid, newer, compatible,
   and channel-matched. Automatic installation remains disabled.
5. The website must show the same version, build, architecture, minimum macOS,
   DMG SHA-256, release notes, and support link as the manifest.

## Manual Update

1. Keep the currently installed app and its notarized DMG.
2. Download the newer notarized DMG from the exact HTTPS URL in the manifest.
3. Verify its SHA-256 against both the manifest and website.
4. Quit Relay Console and copy the new app to Applications.
5. Open it through the quarantined download path and confirm Gatekeeper,
   first-launch, existing-data migration, harness health, and enabled app health.
6. Retain the prior notarized DMG until those checks pass and for at least 30
   days after the successor is published. If a security or data-compatibility
   issue makes rollback unsafe, remove that artifact from the supported
   manifest and say why in the release notes.

## Current Local Schema Compatibility

The current schema advances from 30 to 32 without changing the previous core
profile, workspace, harness, conversation, message, or Keychain-reference
column contracts. Migration 31 clears only rebuildable runtime and Marketplace
caches; migration 32 adds an index. A disposable schema-30 fixture verifies that
user data remains readable through the schema-30 query contract after both
migrations run.

## Rollback

The optional `previous` manifest entry is an exact, still-supported notarized
DMG. Rollback is never automatic:

1. Quit the new app.
2. Preserve a redacted export and backup before replacing binaries.
3. Reinstall the exact previous DMG only when its version/build, architecture,
   HTTPS URL, and SHA-256 validate.
4. Do not open the older app if release notes say the data migration is not
   backward compatible. Use support/recovery guidance instead.

`swift run RelayConsoleMigrationTests` and `swift run RelayConsoleAppUpdateTests`
provide repository-level migration and manifest-policy coverage. They do not
replace installing and rolling back the actual signed, notarized DMGs recorded
in the public-beta acceptance matrix.
