#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_ROOT="$ROOT_DIR/.build/distribution"
SOURCE_APP=""
DRY_RUN=0
ARCHITECTURE_POLICY="${RELAY_CONSOLE_ARCHITECTURE_POLICY:-arm64}"
ENTITLEMENTS="$ROOT_DIR/Release/RelayConsole.entitlements"

usage() {
  cat <<'USAGE'
Usage: Scripts/build-distribution.sh [--app PATH] [--output DIR] [--architecture arm64|x86_64|universal2] [--dry-run]

Environment for a real notarized build:
  RELAY_CONSOLE_DEVELOPER_ID_APPLICATION
  RELAY_CONSOLE_NOTARY_KEYCHAIN_PROFILE

Dry-run mode uses an ad-hoc hardened-runtime signature, exercises DMG and
quarantine verification, and never submits to Apple.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)
      [[ $# -ge 2 ]] || { echo "--app requires a path" >&2; exit 2; }
      SOURCE_APP="$2"
      shift
      ;;
    --output)
      [[ $# -ge 2 ]] || { echo "--output requires a directory" >&2; exit 2; }
      OUTPUT_ROOT="$2"
      shift
      ;;
    --architecture)
      [[ $# -ge 2 ]] || { echo "--architecture requires a value" >&2; exit 2; }
      ARCHITECTURE_POLICY="$2"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

case "$ARCHITECTURE_POLICY" in arm64|x86_64|universal2) ;; *) echo "Unsupported architecture policy" >&2; exit 2 ;; esac

command -v jq >/dev/null 2>&1 || { echo "jq is required to build distribution evidence" >&2; exit 1; }

if [[ "$DRY_RUN" == "1" ]]; then
  SIGN_IDENTITY="-"
  TIMESTAMP_ARGS=(--timestamp=none)
  NOTARY_STATUS="not-run-dry-run"
else
  [[ -z "$SOURCE_APP" ]] || { echo "A real distribution build must compile its app from the validated candidate checkout; --app is dry-run only" >&2; exit 1; }
  if [[ -n "${RELAY_CONSOLE_RELEASE_CANDIDATE_MANIFEST:-}" ]]; then
    RELEASE_CANDIDATE_MANIFEST="$RELAY_CONSOLE_RELEASE_CANDIDATE_MANIFEST"
  else
    RELEASE_CANDIDATE_MANIFEST="$ROOT_DIR/Release/release-candidate-manifest.json"
  fi
  [[ -f "$RELEASE_CANDIDATE_MANIFEST" ]] || { echo "A release-candidate manifest is required for a real distribution build: $RELEASE_CANDIDATE_MANIFEST" >&2; exit 1; }
  CANDIDATE_SCHEMA_VERSION="$(jq -er '.schemaVersion' "$RELEASE_CANDIDATE_MANIFEST")"
  [[ "$CANDIDATE_SCHEMA_VERSION" == "relay.release-candidate.v1" ]] || {
    echo "Unsupported release-candidate schema: $CANDIDATE_SCHEMA_VERSION" >&2
    exit 1
  }
  node "$ROOT_DIR/../scripts/release-candidate-manifest.mjs" --validate "$RELEASE_CANDIDATE_MANIFEST" --require candidate
  [[ "$(jq -r '.status' "$RELEASE_CANDIDATE_MANIFEST")" == "candidate" ]] || { echo "Artifact creation requires an authorized candidate manifest, not a draft or final manifest" >&2; exit 1; }
  CANDIDATE_RELEASE_ID="$(jq -r '.releaseId' "$RELEASE_CANDIDATE_MANIFEST")"
  CANDIDATE_SOURCE_COMMIT="$(jq -r '.source.commit' "$RELEASE_CANDIDATE_MANIFEST")"
  CANDIDATE_SHA256="$(shasum -a 256 "$RELEASE_CANDIDATE_MANIFEST" | awk '{print $1}')"
  : "${RELAY_CONSOLE_DEVELOPER_ID_APPLICATION:?Developer ID Application identity is required}"
  : "${RELAY_CONSOLE_NOTARY_KEYCHAIN_PROFILE:?Notary keychain profile is required}"
  SIGN_IDENTITY="$RELAY_CONSOLE_DEVELOPER_ID_APPLICATION"
  SIGN_IDENTITY_RECORD="$(security find-identity -v -p codesigning | grep -F "$SIGN_IDENTITY" | head -n 1 || true)"
  [[ "$SIGN_IDENTITY_RECORD" == *'"Developer ID Application:'* ]] || {
    echo "The configured signing identity is not an installed Developer ID Application certificate" >&2
    exit 1
  }
  TIMESTAMP_ARGS=(--timestamp)
  NOTARY_STATUS="pending"
fi

if [[ -z "$SOURCE_APP" ]]; then
  "$ROOT_DIR/Scripts/build-release-app.sh" --output "$OUTPUT_ROOT/app" --architecture "$ARCHITECTURE_POLICY" --no-sign
  SOURCE_APP="$OUTPUT_ROOT/app/Relay Console.app"
fi
[[ -d "$SOURCE_APP" ]] || { echo "Source app not found: $SOURCE_APP" >&2; exit 1; }

WORK_ROOT="$OUTPUT_ROOT/work"
APP_PATH="$WORK_ROOT/Relay Console.app"
DMG_STAGE="$WORK_ROOT/dmg-root"
ZIP_PATH="$OUTPUT_ROOT/RelayConsole-public-beta-notary.zip"
DMG_PATH="$OUTPUT_ROOT/RelayConsole-public-beta.dmg"
MANIFEST_PATH="$OUTPUT_ROOT/RelayConsole-public-beta-manifest.json"

mkdir -p "$OUTPUT_ROOT"
rm -rf "$WORK_ROOT"
mkdir -p "$WORK_ROOT" "$DMG_STAGE"
cp -R "$SOURCE_APP" "$APP_PATH"
/usr/libexec/PlistBuddy -c "Delete :RelayConsoleArchitecturePolicy" "$APP_PATH/Contents/Info.plist" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :RelayConsoleArchitecturePolicy string $ARCHITECTURE_POLICY" "$APP_PATH/Contents/Info.plist"

MAIN_EXECUTABLE="$APP_PATH/Contents/MacOS/Relay Console"
BRIDGE_EXECUTABLE="$APP_PATH/Contents/MacOS/RelayMarketplaceToolBridge"
MAIN_ARCHS="$(/usr/bin/lipo -archs "$MAIN_EXECUTABLE")"
BRIDGE_ARCHS="$(/usr/bin/lipo -archs "$BRIDGE_EXECUTABLE")"
if [[ "$ARCHITECTURE_POLICY" == "universal2" ]]; then
  for architecture in arm64 x86_64; do
    [[ " $MAIN_ARCHS " == *" $architecture "* && " $BRIDGE_ARCHS " == *" $architecture "* ]] || { echo "Missing universal architecture: $architecture" >&2; exit 1; }
  done
else
  [[ "$MAIN_ARCHS" == "$ARCHITECTURE_POLICY" && "$BRIDGE_ARCHS" == "$ARCHITECTURE_POLICY" ]] || { echo "Architecture policy does not match embedded executables" >&2; exit 1; }
fi

codesign --force --options runtime "${TIMESTAMP_ARGS[@]}" --sign "$SIGN_IDENTITY" "$BRIDGE_EXECUTABLE"
codesign --force --options runtime "${TIMESTAMP_ARGS[@]}" --sign "$SIGN_IDENTITY" "$MAIN_EXECUTABLE"
codesign --force --options runtime "${TIMESTAMP_ARGS[@]}" --entitlements "$ENTITLEMENTS" --sign "$SIGN_IDENTITY" "$APP_PATH"
codesign --verify --deep --strict "$APP_PATH"
SIGN_DETAILS="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1)"
grep -q 'flags=.*runtime' <<<"$SIGN_DETAILS" || { echo "Hardened runtime flag missing" >&2; exit 1; }
for SIGNED_EXECUTABLE in "$BRIDGE_EXECUTABLE" "$MAIN_EXECUTABLE"; do
  codesign --verify --strict "$SIGNED_EXECUTABLE"
  NESTED_SIGN_DETAILS="$(codesign -dv --verbose=4 "$SIGNED_EXECUTABLE" 2>&1)"
  grep -q 'flags=.*runtime' <<<"$NESTED_SIGN_DETAILS" || { echo "Nested executable hardened runtime flag missing" >&2; exit 1; }
done

SIGN_AUTHORITY="$(sed -n 's/^Authority=//p' <<<"$SIGN_DETAILS" | head -n 1)"
TEAM_IDENTIFIER="$(sed -n 's/^TeamIdentifier=//p' <<<"$SIGN_DETAILS" | head -n 1)"
APP_CDHASH="$(sed -n 's/^CDHash=//p' <<<"$SIGN_DETAILS" | head -n 1)"
if [[ "$DRY_RUN" == "0" ]]; then
  [[ "$SIGN_AUTHORITY" == "Developer ID Application:"* ]] || { echo "Signed app authority is not Developer ID Application" >&2; exit 1; }
  [[ "$TEAM_IDENTIFIER" =~ ^[A-Z0-9]{10}$ ]] || { echo "Signed app TeamIdentifier is invalid" >&2; exit 1; }
  [[ "$APP_CDHASH" =~ ^[A-Fa-f0-9]{40,64}$ ]] || { echo "Signed app CDHash is invalid" >&2; exit 1; }
  grep -q '^Timestamp=' <<<"$SIGN_DETAILS" || { echo "Signed app lacks a trusted timestamp" >&2; exit 1; }
fi

ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"

if [[ "$DRY_RUN" == "0" ]]; then
  APP_NOTARY_SUBMISSION_SHA256="$(shasum -a 256 "$ZIP_PATH" | awk '{print $1}')"
  NOTARY_RESULT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/relay-console-notary.XXXXXX")"
  APP_NOTARY_RESULT="$NOTARY_RESULT_ROOT/app.json"
  DMG_NOTARY_RESULT="$NOTARY_RESULT_ROOT/dmg.json"
  xcrun notarytool submit "$ZIP_PATH" --keychain-profile "$RELAY_CONSOLE_NOTARY_KEYCHAIN_PROFILE" --wait --output-format json > "$APP_NOTARY_RESULT"
  APP_NOTARY_ID="$(jq -er '.id' "$APP_NOTARY_RESULT")"
  APP_NOTARY_STATUS="$(jq -er '.status' "$APP_NOTARY_RESULT")"
  [[ "$APP_NOTARY_STATUS" == "Accepted" ]] || { echo "Apple did not accept the notarization archive" >&2; exit 1; }
  xcrun stapler staple "$APP_PATH"
  xcrun stapler validate "$APP_PATH"
  ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"
fi

cp -R "$APP_PATH" "$DMG_STAGE/Relay Console.app"
ln -s /Applications "$DMG_STAGE/Applications"
rm -f "$DMG_PATH"
hdiutil create -volname "Relay Console" -srcfolder "$DMG_STAGE" -format UDZO -ov "$DMG_PATH"
codesign --force "${TIMESTAMP_ARGS[@]}" --sign "$SIGN_IDENTITY" "$DMG_PATH"
codesign --verify --strict "$DMG_PATH"

if [[ "$DRY_RUN" == "0" ]]; then
  DMG_NOTARY_SUBMISSION_SHA256="$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$RELAY_CONSOLE_NOTARY_KEYCHAIN_PROFILE" --wait --output-format json > "$DMG_NOTARY_RESULT"
  DMG_NOTARY_ID="$(jq -er '.id' "$DMG_NOTARY_RESULT")"
  DMG_NOTARY_STATUS="$(jq -er '.status' "$DMG_NOTARY_RESULT")"
  [[ "$DMG_NOTARY_STATUS" == "Accepted" ]] || { echo "Apple did not accept the notarized DMG" >&2; exit 1; }
  xcrun stapler staple "$DMG_PATH"
  xcrun stapler validate "$DMG_PATH"
  codesign --verify --strict "$DMG_PATH"
  spctl --assess --type execute --verbose=4 "$APP_PATH"
  spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH"
  NOTARY_STATUS="accepted-stapled"
  GATEKEEPER_STATUS="accepted"
else
  spctl --assess --type execute --verbose=4 "$APP_PATH" >/dev/null 2>&1 && { echo "Dry-run app unexpectedly passed Gatekeeper" >&2; exit 1; }
  GATEKEEPER_STATUS="expected-rejected-ad-hoc"
fi

QUARANTINE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/relay-console-quarantine.XXXXXX")"
QUARANTINE_DMG="$QUARANTINE_ROOT/RelayConsole-public-beta.dmg"
MOUNT_POINT="$QUARANTINE_ROOT/mount"
cp "$DMG_PATH" "$QUARANTINE_DMG"
xattr -w com.apple.quarantine "0081;$(printf '%x' "$(date +%s)");RelayConsoleBeta;" "$QUARANTINE_DMG"
mkdir -p "$MOUNT_POINT"
hdiutil attach -nobrowse -readonly -mountpoint "$MOUNT_POINT" "$QUARANTINE_DMG" >/dev/null
codesign --verify --deep --strict "$MOUNT_POINT/Relay Console.app"
if [[ "$DRY_RUN" == "0" ]]; then
  spctl --assess --type execute --verbose=4 "$MOUNT_POINT/Relay Console.app"
fi
hdiutil detach "$MOUNT_POINT" >/dev/null

APP_SHA="$(shasum -a 256 "$MAIN_EXECUTABLE" | awk '{print $1}')"
BRIDGE_SHA="$(shasum -a 256 "$BRIDGE_EXECUTABLE" | awk '{print $1}')"
ZIP_SHA="$(shasum -a 256 "$ZIP_PATH" | awk '{print $1}')"
DMG_SHA="$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
APP_KIB="$(du -sk "$APP_PATH" | awk '{print $1}')"
ZIP_BYTES="$(stat -f '%z' "$ZIP_PATH")"
DMG_BYTES="$(stat -f '%z' "$DMG_PATH")"
APP_VERSION="$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$APP_PATH/Contents/Info.plist")"
APP_BUILD="$(/usr/bin/plutil -extract CFBundleVersion raw -o - "$APP_PATH/Contents/Info.plist")"
BUNDLE_IDENTIFIER="$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$APP_PATH/Contents/Info.plist")"
MINIMUM_MACOS="$(/usr/bin/plutil -extract LSMinimumSystemVersion raw -o - "$APP_PATH/Contents/Info.plist")"
ARCHITECTURES_JSON="$(tr ' ' '\n' <<<"$MAIN_ARCHS" | jq -R 'select(length > 0)' | jq -s .)"

if [[ "$DRY_RUN" == "0" ]]; then
  [[ "$APP_VERSION" == "$(jq -r '.components.macOS.version' "$RELEASE_CANDIDATE_MANIFEST")" ]] || { echo "Packaged macOS version differs from the authorized candidate" >&2; exit 1; }
  [[ "$APP_BUILD" == "$(jq -r '.components.macOS.build' "$RELEASE_CANDIDATE_MANIFEST")" ]] || { echo "Packaged macOS build differs from the authorized candidate" >&2; exit 1; }
  [[ "$BUNDLE_IDENTIFIER" == "$(jq -r '.components.macOS.bundleIdentifier' "$RELEASE_CANDIDATE_MANIFEST")" ]] || { echo "Packaged macOS bundle identifier differs from the authorized candidate" >&2; exit 1; }
  [[ "$MINIMUM_MACOS" == "$(jq -r '.components.macOS.minimumOS' "$RELEASE_CANDIDATE_MANIFEST")" ]] || { echo "Packaged macOS minimum OS differs from the authorized candidate" >&2; exit 1; }
  [[ "$(jq -c 'sort' <<<"$ARCHITECTURES_JSON")" == "$(jq -c '.components.macOS.architectures | sort' "$RELEASE_CANDIDATE_MANIFEST")" ]] || { echo "Packaged macOS architectures differ from the authorized candidate" >&2; exit 1; }
  jq -n \
    --arg releaseId "$CANDIDATE_RELEASE_ID" \
    --arg capturedAt "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --arg sourceCommit "$CANDIDATE_SOURCE_COMMIT" \
    --arg candidateSHA256 "$CANDIDATE_SHA256" \
    --arg fileName "$(basename "$DMG_PATH")" \
    --arg dmgSHA256 "$DMG_SHA" \
    --argjson dmgSizeBytes "$DMG_BYTES" \
    --arg appVersion "$APP_VERSION" \
    --arg appBuild "$APP_BUILD" \
    --arg bundleIdentifier "$BUNDLE_IDENTIFIER" \
    --arg minimumOS "$MINIMUM_MACOS" \
    --argjson architectures "$ARCHITECTURES_JSON" \
    --arg mainExecutableSHA256 "$APP_SHA" \
    --arg bridgeExecutableSHA256 "$BRIDGE_SHA" \
    --arg authority "$SIGN_AUTHORITY" \
    --arg teamIdentifier "$TEAM_IDENTIFIER" \
    --arg appCDHash "$APP_CDHASH" \
    --arg appSubmissionId "$APP_NOTARY_ID" \
    --arg appStatus "$APP_NOTARY_STATUS" \
    --arg appSubmissionSHA256 "$APP_NOTARY_SUBMISSION_SHA256" \
    --arg dmgSubmissionId "$DMG_NOTARY_ID" \
    --arg dmgStatus "$DMG_NOTARY_STATUS" \
    --arg dmgSubmissionSHA256 "$DMG_NOTARY_SUBMISSION_SHA256" \
    '{
      schemaVersion: "relay.macos-distribution-evidence.v1",
      releaseId: $releaseId,
      capturedAt: $capturedAt,
      candidate: { sourceCommit: $sourceCommit, manifestSHA256: $candidateSHA256 },
      artifact: {
        fileName: $fileName, dmgSHA256: $dmgSHA256, dmgSizeBytes: $dmgSizeBytes,
        appVersion: $appVersion, appBuild: $appBuild,
        bundleIdentifier: $bundleIdentifier, minimumOS: $minimumOS,
        architectures: $architectures,
        mainExecutableSHA256: $mainExecutableSHA256,
        bridgeExecutableSHA256: $bridgeExecutableSHA256
      },
      signing: {
        mode: "developer-id-hardened-runtime", authority: $authority,
        teamIdentifier: $teamIdentifier, appCDHash: $appCDHash,
        timestamped: true, hardenedRuntime: true, nestedExecutablesVerified: true,
        appVerified: true, dmgVerified: true
      },
      notarization: {
        appSubmissionId: $appSubmissionId, appStatus: $appStatus,
        appSubmissionSHA256: $appSubmissionSHA256,
        dmgSubmissionId: $dmgSubmissionId, dmgStatus: $dmgStatus,
        dmgSubmissionSHA256: $dmgSubmissionSHA256,
        appStapleValidated: true, dmgStapleValidated: true
      },
      gatekeeper: {
        appAccepted: true, dmgAccepted: true,
        quarantinedMountSignatureVerified: true,
        quarantinedMountGatekeeperAccepted: true
      }
    }' > "$MANIFEST_PATH"
  node "$ROOT_DIR/../scripts/apple-distribution-evidence.mjs" --validate-macos "$MANIFEST_PATH" --candidate "$RELEASE_CANDIDATE_MANIFEST"
  rm -rf "$NOTARY_RESULT_ROOT"
else
  jq -n \
    --arg appVersion "$APP_VERSION" --arg appBuild "$APP_BUILD" \
    --arg bundleIdentifier "$BUNDLE_IDENTIFIER" --arg architecturePolicy "$ARCHITECTURE_POLICY" \
    --arg mainArchitectures "$MAIN_ARCHS" --arg bridgeArchitectures "$BRIDGE_ARCHS" \
    --argjson appSizeKiB "$APP_KIB" --argjson zipSizeBytes "$ZIP_BYTES" --argjson dmgSizeBytes "$DMG_BYTES" \
    --arg mainExecutableSHA256 "$APP_SHA" --arg bridgeExecutableSHA256 "$BRIDGE_SHA" \
    --arg notaryZipSHA256 "$ZIP_SHA" --arg dmgSHA256 "$DMG_SHA" \
    '{ appVersion: $appVersion, appBuild: $appBuild, bundleIdentifier: $bundleIdentifier,
       architecturePolicy: $architecturePolicy, mainArchitectures: $mainArchitectures,
       bridgeArchitectures: $bridgeArchitectures, appSizeKiB: $appSizeKiB,
       zipSizeBytes: $zipSizeBytes, dmgSizeBytes: $dmgSizeBytes,
       mainExecutableSHA256: $mainExecutableSHA256,
       bridgeExecutableSHA256: $bridgeExecutableSHA256,
       notaryZipSHA256: $notaryZipSHA256, dmgSHA256: $dmgSHA256,
       signatureMode: "ad-hoc-hardened-runtime", notaryStatus: "not-run-dry-run",
       gatekeeperStatus: "expected-rejected-ad-hoc", quarantineMountVerification: "passed" }' > "$MANIFEST_PATH"
fi

jq empty "$MANIFEST_PATH"
echo "$MANIFEST_PATH"
