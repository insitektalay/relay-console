# Free Local macOS release runbook

> **Superseded before publication on 2026-07-25.** Relay now has one paid
> launch product. Preserve this file as build 4 preparation history. It cannot
> authorize a free public release, artifact publication, or update manifest.

Release target: Relay Console 0.1.1 build 4, public beta, Apple silicon,
macOS 14 or later.

This was a scoped release lane for the free Mac application. The current
production checklist supersedes it.

## Product boundary

- Local conversations, agents, settings, files, export, reset, and removal
  preparation are included.
- Relay Console connects directly to an independently installed Hermes Agent
  or OpenClaw runtime on the same Mac.
- The user owns installation, authentication, updates, model/provider accounts,
  and any provider charges for those runtimes.
- Applications remain a local preview. This release does not guarantee that
  every catalogue entry can connect or execute.
- No Relay account, paid entitlement, Railway service, cloud bridge, or bridge
  plugin is required for the Free Local path.

The machine-readable version of this boundary is
`free-local-release-candidate.schema.json`. The generated candidate is ignored
by Git because it binds to the exact clean commit used to build the artifact.

## Candidate preparation

From the repository root, after the release preparation commit is clean:

```sh
pnpm run test:release-free-local
pnpm run release:free-local:candidate -- --status candidate
pnpm run release:free-local:candidate -- --validate RelayConsoleSwift/Release/free-local-release-candidate.json --require candidate
```

The candidate authorizes creation of a signed artifact. It explicitly does not
authorize public publication. `RelayConsoleSwift/Scripts/build-distribution.sh`
accepts this scoped manifest without weakening the combined Cloud/iOS release
manifest.

## Apple signing and notarization

The installed identity is:

`Developer ID Application: alex kerss (L53X4LP47U)`

Its SHA-256 fingerprint is:

`21:02:AA:16:6B:75:D3:38:CE:66:C7:5B:17:DA:ED:EB:7C:9D:4A:03:F3:69:8B:24:83:07:45:F0:BD:5E:9F:A0`

The release owner must create the missing Keychain notary profile without
placing the Apple ID, app-specific password, or API key in source control or a
terminal transcript. Apple supports either App Store Connect API credentials or
Apple ID credentials with an app-specific password. Store the result under the
profile name `relay-console-notary`, then run:

```sh
export RELAY_CONSOLE_DEVELOPER_ID_APPLICATION='Developer ID Application: alex kerss (L53X4LP47U)'
export RELAY_CONSOLE_NOTARY_KEYCHAIN_PROFILE='relay-console-notary'
RelayConsoleSwift/Scripts/build-distribution.sh --architecture arm64 --output RelayConsoleSwift/.build/free-local-0.1.1-build-4
```

The script builds from the validated checkout, signs the nested executable and
app with hardened runtime and a trusted timestamp, submits and staples both app
and DMG, verifies Gatekeeper, mounts a quarantined copy, hashes the artifact,
and validates release-bound distribution evidence. A failed check stops the
build; an ad-hoc dry run is never publishable.

## Artifact acceptance

Use `FREE_LOCAL_PUBLIC_BETA_ACCEPTANCE_MATRIX.md`. Every result must name the
exact DMG SHA-256 and 0.1.1 build 4. Evidence from an earlier app, an ad-hoc
build, or a different commit is not transferable.

The minimum release blockers are:

1. full automated Swift/release tests;
2. preserved user data when an existing schema-38 database migrates to 40;
3. direct same-Mac Hermes dispatch;
4. direct same-Mac OpenClaw dispatch;
5. signed, notarized, stapled, quarantined installation;
6. first launch on a clean supported Mac without the source checkout or
   developer tools;
7. human keyboard, focus, VoiceOver, long-content, and minimum-window smoke;
8. HTTPS DMG and checksum publication with exact release notes, known issues,
   support, privacy, terms, notices, and update policy; and
9. the human release owner's final go/no-go.

## Publication boundary

The landing site fails closed: no download appears unless
`RELAY_MACOS_UPDATE_MANIFEST_JSON` contains an exact, valid, canonical
`relayconsole.work` artifact record. Populate that value only after the DMG is
accepted. Do not place a placeholder, ad-hoc artifact, local path, or third-party
download origin in the manifest.

Retain the previous supported notarized DMG for at least 30 days after a later
release. Because 0.1.1 build 4 is the first public artifact, its initial update
manifest may set `previous` to `null`.

## Current external gates

- The `relay-console-notary` Keychain profile does not yet exist.
- This Mac has a healthy user-owned Hermes v0.15.1 checkout. Relay Console now
  recognizes both the older `.venv/bin/python` and current official
  `venv/bin/python` layouts, and the complete dry-run gate covers both Connect
  Existing and scheduler resolution. An exact signed-candidate dispatch is
  still required. Old app-managed Hermes gateway processes were also found and
  must be reviewed with the release owner before migration or shutdown.
- This Mac does not currently have a supported independently installed OpenClaw
  checkout/command for acceptance.
- A separate clean supported Mac is still needed for the quarantine/first-launch
  test.
- The public download deployment target and artifact host must be confirmed.
- Privacy, terms, notices, and release copy still require owner/legal approval.
- Only the human release owner can authorize publication.

These gates prevent a truthful public release, but they do not invalidate the
completed source, migration, packaging, or dry-run evidence.
