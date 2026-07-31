# Relay Console Public Beta Acceptance Matrix

Candidate status: no signed release candidate

Each row stays Pending until a tester records the exact DMG SHA-256, app version
and build, Mac model, architecture, macOS version, tester account type, date,
result, and evidence location. Do not reuse evidence from another artifact.

| Scenario | Apple silicon | Intel if supported | Required evidence | Status |
| --- | --- | --- | --- | --- |
| HTTPS download and SHA-256 match | Pending | Pending | URL, DMG hash, download timestamp | Pending |
| Quarantined DMG open and drag install | Pending | Pending | quarantine attribute, mounted DMG, Applications copy | Pending |
| Developer ID, hardened runtime, notarization, stapling, Gatekeeper | Pending | Pending | `codesign`, `stapler`, `spctl` output | Pending |
| First launch without source or developer tools | Pending | Pending | clean account, launch result, app version | Pending |
| Connect independently installed Hermes, health, model selection, agent dispatch | Pending | Pending | detected version, compatibility result, redacted dispatch | Pending |
| Connect independently installed OpenClaw, health, model selection, agent dispatch | Pending | Pending | detected version, compatibility result, redacted dispatch | Pending |
| Relay bridge update failure and rollback | Pending | Pending | bridge before/after versions, failure, restored health, unchanged runtime version | Pending |
| Enabled provider OAuth start, callback, status, reconnect, revoke | Pending | Pending | provider account class, redacted state/PKCE and status evidence | Pending |
| Manual app update and rollback | Pending | Pending | old/new build, manifest hash, replacement and rollback result | Pending |
| Redacted export | Pending | Pending | file mode, schema, redaction inspection | Pending |
| Reset and profile removal | Pending | Pending | typed confirmation, post-relaunch state | Pending |
| Prepare for app removal and reinstall | Pending | Pending | stopped services, Keychain/data cleanup, clean reinstall | Pending |
| Keyboard, focus, VoiceOver, long content, minimum window | Pending | Pending | completed BETA-001-018 human checklist | Pending |
| Upgrade from the previous supported beta | Pending | Pending | preserved settings/data and migration result | Pending |

Repository-level export/reset and schema-compatibility contracts passed on
2026-07-14; see `docs/FREE_LOCAL_DATA_LIFECYCLE_DRILL_2026-07-14.md`. The rows
above intentionally remain Pending until they are repeated against the exact
signed, notarized release candidate on the required clean-machine matrix.

Record the completed Free Local and Relay Cloud end-to-end steps in
`Release/launch-journey-results.template.json`. The release validator binds
those results to the exact candidate, signed macOS and iOS artifacts, Railway
and Vercel deployments, client matrix, both user-installed runtimes, billing
channels, and one live-verified Marketplace provider. The pending template
cannot authorize a final release.

## Candidate Record

- Reviewer:
- Review date:
- DMG path or public URL:
- DMG SHA-256:
- App version/build:
- Bundle identifier:
- Architectures:
- Minimum macOS:
- Developer ID identity:
- Notarization request/result:
- Release notes URL:
- Update manifest URL and SHA-256:
- Known-issues revision:
- Privacy/terms/notices approval references:

## Required Commands

Run `Scripts/build-distribution.sh` for packaging and Apple checks, then record
the generated manifest. Run `Scripts/validate-release-app.sh` against the app
copied from the quarantined DMG. Run the validation registry from a frozen copy
of the exact candidate source. Redact usernames and private paths before adding
command output to the evidence packet.
