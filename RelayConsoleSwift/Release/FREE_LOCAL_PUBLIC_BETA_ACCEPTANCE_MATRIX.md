# Free Local public-beta acceptance matrix

> **Superseded before publication on 2026-07-25.** Keep this matrix as
> non-publishable build 4 evidence. It does not control the current paid Relay
> launch.

Candidate: Relay Console 0.1.1 build 4, Apple silicon, macOS 14 or later.

This matrix is scoped to the free same-Mac application. It does not require or
accept evidence for Relay Cloud, Relay Connect, browser/iOS clients, billing,
managed hosting, or standalone bridge plugins. Every manual row remains Pending
until it is repeated against the exact signed DMG and records that DMG's
SHA-256.

| Gate | Required evidence | Current status |
| --- | --- | --- |
| Machine-readable Free Local scope | Schema and validator tests; exact clean candidate commit | Validator passes; clean commit candidate pending |
| Automated release gate | Full Swift and release-tool test logs for candidate commit | Complete gate passes on the release-preparation working tree; exact clean candidate rerun pending |
| Schema 38 to 40 upgrade | Preserved agent, binding, managed document, host assignment, migration records | Automated migration test passes |
| Developer ID signing | Nested executable, app, DMG authority/team/timestamp/hardened-runtime evidence | Pending signed artifact |
| Apple notarization and stapling | App and DMG submission IDs, Accepted status, staple validation | Pending notary profile and artifact |
| Gatekeeper and quarantine path | `spctl`, quarantined DMG mount, copied app launch | Dry-run quarantined mount passes; signed-artifact Gatekeeper/launch pending |
| Same-Mac Hermes | Runtime version, compatible health, redacted agent dispatch and response | User-owned Hermes v0.15.1 and healthy gateway discovered; official `venv/bin/python` layout now has regression coverage; exact candidate dispatch pending |
| Same-Mac OpenClaw | Runtime version, compatible health, redacted agent dispatch and response | Pending supported OpenClaw installation |
| Clean supported Mac | Mac model, macOS version, no checkout/developer-tool dependency, first launch | Pending external Mac |
| Local data lifecycle | Export, reset, profile removal, app-removal preparation and reinstall | Automated repository contracts pass; signed-candidate repeat pending |
| Accessibility | Keyboard, focus, VoiceOver, long content, minimum window | Automated release checks pass; human smoke pending |
| HTTPS publication | Canonical DMG/checksum URLs, exact release notes/known issues/policies | Source prepared; target, artifact and approval pending |
| Final human go/no-go | Named owner, exact commit, DMG hash, evidence review, timestamp | Pending |

## Superseded build 2 release-preparation dry run (not publishable)

- Date: 2026-07-22
- Command: `pnpm run release:free-local:gate`
- Result: passed end to end
- Host: MacBook Pro `MacBookPro18,3`, Apple M1 Pro, macOS 26.2
- DMG: `RelayConsoleSwift/.build/free-local-gate/distribution/RelayConsole-public-beta.dmg`
- DMG SHA-256: `20322839f6b0fbc1f52d541137059a6a49d05a4560914c563a288573b16fd967`
- DMG size: 163891650 bytes
- App version/build: 0.1.1 / 2
- Signature: ad-hoc hardened runtime
- Notarization: not run (dry run)
- Quarantined mount verification: passed
- Publication status: prohibited; this is not a Developer ID signed or notarized artifact

Build 2 was later signed and notarized successfully, but manual acceptance
found that a healthy legacy managed runtime hid the Change Location migration
control. Build 2 is therefore superseded and must not be published.

## Superseded build 3 signed candidate (not publishable)

- Date: 2026-07-22
- Source commit: `f38913f4475bf7883db919b31b61997a540e7ae8`
- DMG SHA-256: `5579e08ad37ad1b9cc3adfbd8dda47bf413250667bb64411290f4714f38466fb`
- App notarization submission: `c39285ca-009e-4a5f-af41-445d36ab1766` (`Accepted`)
- DMG notarization submission: `51e3d7df-3c7f-4f61-a2db-726f748c2e1c` (`Accepted`)
- Gatekeeper, stapling, and quarantined-mount verification: passed
- Publication status: prohibited

Manual acceptance confirmed that build 3 restored Change Location for healthy
legacy runtimes. It also exposed that a stored runtime transport failure could
render a raw HTML response in chat. Build 3 is therefore superseded by build 4,
which replaces HTML error documents with a short plain-language runtime error
while preserving ordinary error messages.

Read-only Hermes discovery found the user-owned checkout at
`~/.hermes/hermes-agent`, version 0.15.1 (2026.5.29), commit
`6f6eb871d83415fe2980f3483cc41a435ba22196`, with its launchd gateway healthy.
It also found old app-managed Hermes gateway processes. No runtime process,
checkout, profile, LaunchAgent, credential, or user database was changed.

## Candidate record

- Source branch:
- Source commit:
- Candidate manifest SHA-256:
- Reviewer:
- Review date:
- DMG path or public URL:
- DMG SHA-256:
- DMG size:
- App version/build:
- macOS version and Mac model:
- Developer ID authority/team:
- App notarization submission/result:
- DMG notarization submission/result:
- Hermes version/result: v0.15.1 discovered healthy; exact candidate dispatch pending
- OpenClaw version/result:
- Clean-Mac result:
- Accessibility reviewer/result:
- Release notes URL:
- Known-issues URL:
- Download/checksum URLs:
- Privacy/terms/notices approval references:
- Final decision and owner:
