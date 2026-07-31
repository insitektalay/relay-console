# Relay Console iOS Release Handoff

Remote push notifications are not part of the first public release. The app
does not request notification permission or register with APNs; its
Notifications screen shows Railway-backed in-app alerts while the app is open.
APNs registration, token lifecycle, delivery, deep links, and opt-out must pass
a later release gate before remote-push claims or entitlements are added.

This document summarizes the iPhone app work completed across Phases 1-5 and the release checks required before TestFlight or App Store submission.

## Scope Completed

### Phase 1-2: Observability and Stability

- Added PostHog and Sentry iOS SDK integrations through Swift Package Manager.
- Added public routing config for PostHog plus Sentry DSN, environment, and release.
- Added a required first-launch privacy choice with both independent switches
  off by default; neither SDK starts before the choice.
- Added allowlisted PostHog events and sanitized Sentry breadcrumbs, nonfatal
  errors, crashes, and pseudonymous session/workspace/thread/agent context.
- Added telemetry coverage across API, websocket, auth/session, workspace switching, thread/message flows, agent flows, Paperclip, analytics, library, security, and Agent Documentation surfaces.
- Replaced fatal crash paths with recoverable fallback behavior and Sentry captures.
- Hardened API URL handling so invalid or loopback backend configuration is rejected and Railway fallback is used.
- Moved auth token storage from `UserDefaults` to Keychain with safe legacy migration.
- Aligned websocket auth with backend/web source of truth: request `/auth/ws-ticket`, connect to the bare Railway WSS URL, then send the ticket in the first authentication frame.
- Added websocket reconnect telemetry and stale connection protection.
- Added stale-result guards around workspace and websocket switching.

### Phase 3: Feature Parity

- Added Agent Documentation surfaces for linked apps, blueprints, packs, proposals, sync mappings, installs, drift, and state export.
- Added Workspace Library file browsing, read, create, edit/write, delete, import through iOS Files, and share/export flows.
- Added Agent Workspace Files support aligned to agent library endpoints, including visible sync state fields where backend data is available.
- Added Thread Analytics detail, active periods, repeated-agent analysis, and CSV/JSON share exports.
- Expanded Paperclip parity for connection setup, update, test, delete, canonical thread link, approval summaries, fetch states, unlink, and update flows.
- Added security parity surfaces for session lists, session revoke, audit logs, and metrics where supported.
- Added missing web-backed settings surfaces without doing a full settings redesign.

### Phase 4: UI Alignment

- Ported Mission Control design tokens to SwiftUI: colors, typography, spacing, borders, radius, elevation, status colors, and badge colors.
- Added reusable SwiftUI components for cards, buttons, badges, avatars, empty states, skeleton/loading states, meta rows, status/risk badges, section headers, and error states.
- Reworked navigation presentation to keep iOS-native tabs and move secondary areas into More.
- Applied the mobile design system to Agent Documentation, Workspace Library, Security, Thread Analytics, Paperclip setup/linking, Agent Detail, Settings, and More.

### Phase 5: Final QA

- Ran clean build successfully.
- Ran unit tests successfully.
- Ran UI smoke test target successfully; the smoke test skipped as expected on an unauthenticated simulator.
- Verified Sentry config path, dSYM setup notes, Keychain migration path, websocket ticket auth path, and Railway API/websocket config path.
- No Phase 5 app-code fixes were required.

## PostHog and Sentry Configuration

The app reads client telemetry values from build settings expanded into
`ClawChat/App/Info.plist`.

Required:

- `POSTHOG_PROJECT_TOKEN`: public PostHog iOS project token.
- `POSTHOG_HOST`: HTTPS PostHog ingestion host.
- `SENTRY_DSN`: Sentry iOS project DSN.

Recommended:

- `SENTRY_ENVIRONMENT`: `development`, `staging`, `testflight`, or `production`.
- `SENTRY_RELEASE`: explicit release string from CI, or leave empty to use the app default `com.relayconsole.app@<version>+<build>`.

Configure these in CI or Xcode build settings for TestFlight/App Store builds.
The PostHog token and Sentry DSN are public routing identifiers; keep PostHog
personal API keys and Sentry auth tokens out of the bundle.

Backend configuration remains Railway-only:

- `RelayConsoleAPIBaseURL`: `https://api.relayconsole.work/api/v1`
- `RelayConsoleWebAssetBaseURL`: `https://relayconsole.work`
- `RelayConsoleWebSocketBaseURL`: `wss://api.relayconsole.work`

The shipping app, executable, display name, bundle identifier, configuration
keys, secure-storage service, and telemetry subsystem all use Relay Console.
The checked-in Xcode project/scheme and Swift module retain the internal
`ClawChat` name only to preserve source and test-module compatibility;
`PRODUCT_NAME` and `PRODUCT_MODULE_NAME` keep that implementation detail out of
the customer-facing artifact.

Marketplace OAuth now has a secret-free iOS return implementation documented
in [`MARKETPLACE_OAUTH_RETURN.md`](MARKETPLACE_OAUTH_RETURN.md). It remains a
live release gate until the backend is deployed to Railway and a signed
real-device provider journey passes; repository compilation alone is not
acceptance evidence.

## dSYM Upload

For TestFlight and App Store symbolication:

1. Keep Release/TestFlight Debug Information Format set to `DWARF with dSYM File`.
2. Archive and export the app normally.
3. Upload generated dSYMs to Sentry from CI after archive/export.
4. Confirm the Sentry release value matches the uploaded dSYM release/dist metadata.
5. Verify with one intentional test crash in a non-production build and confirm the stack trace is symbolicated.

See `SENTRY_SETUP.md` for the shorter setup reference.

## Build and Test

The final release manifest does not accept a typed TestFlight label. After App
Store Connect processes the uploaded archive, run the headless evidence command
against that exact `.xcarchive`:

```sh
RELAY_APP_STORE_CONNECT_KEY_ID='…' \
RELAY_APP_STORE_CONNECT_ISSUER_ID='…' \
RELAY_APP_STORE_CONNECT_PRIVATE_KEY_PATH='/protected/path/AuthKey_….p8' \
node scripts/apple-distribution-evidence.mjs \
  --capture-ios \
  --candidate RelayConsoleSwift/Release/release-candidate-manifest.json \
  --archive /path/to/RelayConsole.xcarchive \
  --output RelayConsoleSwift/Release/ios-distribution-evidence.json
```

The command verifies the distribution signature and provisioning profile, then
queries the exact processed bundle, marketing version, and build through App
Store Connect. It does not open Xcode, launch the app, or boot a Simulator. See
`docs/relay-cloud/APPLE_DISTRIBUTION_RELEASE_BINDING_GATE_2026-07-15.md`.

The processed-build record does not close the App Store gate. After the
listing, privacy answers, review path, device matrix, internal and external
TestFlight, and App Review pass, complete
`RelayConsoleSwift/Release/app-store-release-results.template.json` and run the
capture documented in
`docs/relay-cloud/APP_STORE_RELEASE_BINDING_GATE_2026-07-15.md`.

Verified with:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild clean build \
  -project ../ios/ClawChat.xcodeproj \
  -scheme ClawChat \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ~/Library/Developer/Xcode/DerivedData/ClawChat-phase5 \
  -onlyUsePackageVersionsFromResolvedFile \
  -skipPackageUpdates \
  -skipPackagePluginValidation \
  -skipMacroValidation
```

Result: pass.

The repeatable unattended simulator matrix is:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  pnpm test:ios-simulator-matrix
```

Result on 2026-07-20: pass on disposable iPhone 17 and iPad Pro 13-inch
(M5) simulators. Each device ran 66 unit/contract/render tests and one
signed-out accessibility-extra-extra-extra-large, keyboard and rotation UI
flow, with zero failures and zero skips. See
`docs/relay-cloud/IOS_SIMULATOR_QA_MATRIX_2026-07-20.md` for the exact scope and
the physical-device, VoiceOver, authenticated Railway, StoreKit/TestFlight and
App Review work that remains.

## Real-Device and TestFlight QA Checklist

- Install a fresh TestFlight build.
- Confirm Sentry receives app start/session data for the TestFlight environment.
- Trigger one nonfatal telemetry event and verify user/session/workspace context in Sentry.
- Trigger one controlled test crash in a non-production build and confirm symbolicated stack traces.
- Log in with a real account.
- Kill and relaunch the app; confirm session restore works from Keychain.
- Upgrade from a previous build with legacy `UserDefaults` tokens; confirm migration to Keychain and no forced logout.
- Switch workspaces rapidly; confirm old loads do not overwrite the active workspace.
- Open thread list, thread detail, and message history.
- Send a message, confirm it appears, and verify error handling on failed send.
- Toggle offline/online while viewing a thread and while sending a message.
- Confirm websocket connection uses ticket auth and reconnects after network loss.
- Exercise agent picker and agent runtime flows.
- Open Agent Documentation: linked apps, blueprints, packs, proposals, sync mappings, installs, drift, and state export.
- Browse Workspace Library folders and files.
- Read, create, edit/write, delete, import, and share/export Workspace Library files.
- Open Agent Workspace Files and verify sync states where backend data is present.
- Open Thread Analytics, active periods, repeated-agent analysis, CSV export, and JSON export.
- Configure, test, update, and delete a Paperclip connection.
- Link and unlink a Paperclip canonical thread link.
- Review Paperclip approval summaries and fetch states.
- Exercise approvals and tasks flows.
- Open Security, list sessions, revoke a session, view audit logs, and review security metrics.
- Open Settings, save a Relay account export through Files, and verify all
  other web-backed settings surfaces load or show recoverable errors.
- Confirm offline recovery does not crash.
- Confirm API failures are shown as recoverable user-visible states and captured as nonfatal telemetry.

## Known Remaining Risks

- Swift concurrency warnings remain in API, theme, and UI test code. They are not current build blockers but should be cleaned before adopting stricter Swift concurrency settings.
- A deprecated iOS badge API warning remains and should be modernized before it becomes a hard compatibility issue.
- Some older operational/team dashboard views still contain sample fallback data and should be audited before treating those areas as release-critical.
- UI smoke coverage is limited without an authenticated simulator/device fixture.
- Real-device coverage is still required for Keychain migration, Sentry symbolication, websocket reconnect behavior, Files picker import/export, and share sheet export.

## Backend/API Gaps Blocking Full Parity

The iOS app is wired to backend contracts where available and does not fake missing server behavior. Remaining parity risk is backend/data dependent:

- Agent Documentation drift, sync mappings, installs, and export quality depend on complete backend payloads for the selected workspace.
- Agent Workspace Files can only show linked sync states when the backend includes those fields.
- Security metrics and audit-log completeness depend on backend support for the workspace and user role.
- Thread Analytics repeated-agent and active-period accuracy depends on backend analytics payload completeness.
- Paperclip approval summaries and fetch states depend on backend-provided status fields.
- UI smoke automation needs an authenticated test account/workspace fixture to validate full navigation and feature surfaces end to end.

## Recommended Next Pass After Release

1. Run a full real-device TestFlight QA cycle using the checklist above.
2. Fix any Sentry-reported crash or high-frequency nonfatal error before expanding scope.
3. Add authenticated UI test fixtures so main tab navigation and parity surfaces can run in CI.
4. Clean Swift concurrency/deprecation warnings.
5. Audit older operational/team dashboard sample fallback paths and replace any release-critical sample behavior with real backend states.
6. Revisit backend/API gaps after real production data confirms which parity surfaces still lack complete payloads.
