# Secure macOS updates with Sparkle 2

The signed and notarized DMG is the initial installation path. Once Relay
Console is copied to `/Applications` (or the user's `Applications` folder),
Sparkle 2 is the only installed-app update mechanism. The older JSON/DMG
assessment is retained only as publication evidence; the app does not read it,
open a browser, or ask users to replace the application manually.

## Trust and version policy

- `CFBundleShortVersionString` is the displayed version. `CFBundleVersion` is a
  positive integer and must increase for every published build.
- Releases use annotated tags matching `macos-v<version>-b<build>` and must point
  at the authorized clean commit. A normal commit or pull request cannot publish.
- The appcast is `https://insitektalay.github.io/clawchat/appcast.xml`. GitHub
  Pages must serve the `gh-pages` branch for the repository before the first
  release. Enclosures use immutable, tag-bound GitHub Release asset URLs.
- Apple Developer ID signing, Apple notarization, and Sparkle EdDSA signing are
  separate gates. The app embeds only the EdDSA public key.
- Relay Console is not sandboxed. The packaged framework therefore omits
  Sparkle's optional sandbox XPC services and signs `Autoupdate`, `Updater.app`,
  the framework, Relay executables, and the outer app from the inside out.

## One-time operator setup

Run the reviewed Sparkle 2.9.4 `bin/generate_keys` tool once. It stores the
private key in the operator's Keychain and prints the public key. Back up the
private key in an encrypted, access-controlled recovery store; never commit it.
Configure these GitHub Actions secrets:

- `MACOS_DEVELOPER_ID_CERTIFICATE_P12_BASE64`
- `MACOS_DEVELOPER_ID_CERTIFICATE_PASSWORD`
- `MACOS_DEVELOPER_ID_APPLICATION`
- `APPLE_TEAM_ID`
- `APPLE_NOTARY_KEY_ID`, `APPLE_NOTARY_ISSUER_ID`, `APPLE_NOTARY_PRIVATE_KEY`
- `SPARKLE_EDDSA_PRIVATE_KEY`
- `SPARKLE_PUBLIC_ED_KEY`

The release build requires `RELAY_SPARKLE_PUBLIC_ED_KEY`; a missing, malformed,
or wrong-host feed fails packaging. Forks must generate their own key and change
the approved feed host in code and release validation together, or omit both
keys and accept that updates are disabled. A fork must not retain Relay's public
key while pointing at an unrelated feed.

## Authorized publication

Prepare reviewed markdown release notes named for the update archive, then run
the `macOS Sparkle Release` workflow manually with the exact protected tag. It:

1. verifies tag, commit, version, build, and previous appcast monotonicity;
2. imports the Developer ID identity and Sparkle key without printing them;
3. builds, signs inside-out, notarizes, staples, validates, and preserves dSYMs;
4. creates the exact Sparkle zip and checksum/evidence;
5. runs Sparkle `generate_appcast`, creates the GitHub Release, uploads and
   downloads the immutable asset, and verifies its checksum; then
6. publishes the new appcast to GitHub Pages last.

The workflow uses `contents: write` only in its release job, never runs for pull
requests, and does not expose release secrets to untrusted code. Keep previous
release assets and appcast entries so supported older versions can update.

## Failure and recovery

- If upload succeeds but appcast publication fails, leave the release asset in
  place and rerun only after verifying it; clients still see the prior appcast.
- If appcast publication fails, restore the previous known-good `appcast.xml`.
- To withdraw a bad release, remove its appcast item first; do not publish a
  lower build. Publish a higher corrective build. Use critical-update markup
  only for a reviewed security release.
- If the Sparkle key is compromised, stop publishing, preserve the last trusted
  feed, ship a Developer-ID-signed bridge release that embeds a new public key,
  and rotate only after users have a trusted migration path.
- If the private key is lost, restore the encrypted backup. Without it, existing
  installs cannot trust a new key; use the same signed bridge-release process.
- If the Apple certificate expires, renew it and update the workflow secret.
  Existing Sparkle trust does not replace valid Developer ID/notarization.

## N to N+1 acceptance

1. Install signed version N from its DMG and confirm no pill appears while N is current.
2. Publish signed N+1 through the protected workflow.
3. Relaunch N or choose **Relay Console → Check for Updates…**.
4. Confirm the bottom-left **Update** pill and its version; click it.
5. Review release notes, install, and relaunch through Sparkle.
6. Confirm N+1 opens, settings/conversations/Keychain credentials remain, the
   pill disappears, and a manual check reports current.

This two-release signed/notarized exercise is required before claiming the
feature live. Unit tests and ad-hoc packaging cannot prove installation.
