# Public Beta Local Security

Relay Console creates its managed Application Support root and directories with
mode `0700`. Startup repair removes group and other permissions from existing
managed content. Regular files become `0600`; owner-executable files retain only
owner execution and become `0700`. Relay Console skips symbolic links during
repair so it does not change an unmanaged target outside its root.

SQLite database, WAL, and shared-memory files use mode `0600`.

Relay Console stores provider secrets as generic-password items in macOS
Keychain. Items use stable service and account attributes plus
`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`. This supports background use
after the user unlocks the Mac, prevents migration of the item to another
device, and avoids deprecated per-binary trusted-application ACLs. Startup
rewrites referenced legacy items with the reviewed attributes while preserving
their values and stable database references.

Signed updates must keep the bundle identifier and Keychain service/account
contract stable. BETA-001-019 repeats continuity checks with the signed release
candidate on supported Macs.
