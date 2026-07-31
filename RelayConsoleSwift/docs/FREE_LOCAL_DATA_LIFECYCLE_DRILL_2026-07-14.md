# Free Local Data Lifecycle Drill — 2026-07-14

## Result

The repository-level Free Local export and reset gate passed. Relay Console can
export portable local data and reset its own state without modifying connected,
user-managed Hermes Agent or OpenClaw installations.

## Proved Boundaries

- Export contains useful profile, workspace, conversation, agent, and portable
  runtime identity/ownership metadata.
- Export mode is `0600` and excludes secret values, Keychain accounts,
  security-scoped bookmarks, and machine-local runtime paths.
- Export does not alter the connected external runtime.
- Reset rejects an inexact confirmation phrase.
- Confirmed reset removes the Relay-owned data root and referenced Keychain
  item while preserving external Hermes Agent and OpenClaw directories and
  their marker contents exactly.
- Migrations 31 and 32 preserve schema-30 profile, workspace, harness,
  conversation, message, and Keychain-reference contracts. Only rebuildable
  caches are cleared, and the previous schema query remains readable.
- App-update policy, local-security, harness-lifecycle, service, release-bundle,
  and package-build gates remain green.

## Headless Evidence

All commands ran from `RelayConsoleSwift` without opening Relay Console, Xcode,
the iPhone Simulator, a browser, or any UI test:

```text
swift run RelayConsoleDataLifecycleTests       passed
swift run RelayConsoleMigrationTests           passed
swift run RelayConsoleAppUpdateTests           passed
swift run RelayConsoleLocalSecurityTests       passed
swift run RelayConsoleHarnessLifecycleTests    passed
swift run RelayConsoleServiceTests             passed
swift run RelayConsoleReleaseBundleTests       passed
swift build -c release                         passed
```

The complete gate set was rerun headlessly after the implementation audit on
2026-07-14. The production-configuration package build completed successfully;
it compiled and linked the Relay Console executable but did not run it.

## Gates That Remain Open

This drill is not signed-release acceptance. The following still require the
exact release candidate and remain unchecked in the acceptance matrix:

- Developer ID-signed and notarized DMG update and rollback;
- Keychain continuity using a real signed app on a supported clean Mac;
- app removal, reinstall, and post-relaunch validation; and
- upgrade from the previous supported signed beta.

No backend behavior changed, and nothing was deployed to Railway.
