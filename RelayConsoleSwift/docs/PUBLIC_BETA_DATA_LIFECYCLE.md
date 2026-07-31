# Public Beta Local Data Lifecycle

Relay Console stores its database, runtime connection metadata, Relay-owned
tools, workspaces, artifacts, and caches under its Application Support root.
Hermes Agent and OpenClaw installations selected through **Connect Existing**
remain outside that root and belong to the user. Provider credentials stay in
macOS Keychain entries referenced by the Relay database.

## Export

Settings → Security → Export local data writes a user-selected JSON file. The
file contains the active local profile and workspace, portable harness identity
and ownership metadata, agents, runtime bindings, threads, and messages. It does
not include machine-local harness paths or security-scoped bookmarks. Relay
Console recursively redacts JSON keys that identify secrets, tokens, passwords,
credentials, Keychain accounts, cookies, or security-scoped bookmarks. It does
not export the `secret_references` table or any Keychain value. The file mode is
`0600`.

## Reset And Profile Removal

The public beta is single-profile. Reset local data and Remove local profile
therefore remove the same complete local state. Each action requires its exact
typed confirmation phrase. Relay Console then:

1. stops only Relay-owned helper, adapter, broker, and legacy child processes;
2. unloads only a legacy Relay-created Hermes scheduling helper, if present;
3. deletes every Keychain item referenced by Relay Console;
4. clears the Relay Console `UserDefaults` domain;
5. closes SQLite;
6. removes only the configured Relay Console data root, never a connected
   user-managed Hermes Agent or OpenClaw installation; and
7. quits before any closed service can be reused.

The next launch recreates an empty local profile and workspace.

## App Removal

Prepare for app removal performs the same managed cleanup, then quits. The user
can move `Relay Console.app` to Trash afterward. Relay Console never deletes its
own signed app bundle and never removes unmanaged folders.

Exports saved outside the managed Application Support root remain until the
user deletes them.

## Repeatable Repository Verification

`swift run RelayConsoleDataLifecycleTests` uses disposable Relay and external
runtime directories. It verifies export contents and permissions, secret and
machine-local metadata redaction, exact typed reset confirmation, Relay-owned
data and Keychain-reference cleanup, and byte-for-byte preservation of connected
user-managed Hermes Agent and OpenClaw marker files.

This automated contract does not replace signed-app acceptance on a clean Mac.
Real Keychain continuity, app removal/reinstall, and signed update/rollback are
recorded separately in the public-beta acceptance matrix.
