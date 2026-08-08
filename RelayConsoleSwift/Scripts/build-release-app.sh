#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/Scripts/load-owner-configuration.sh"
relay_load_owner_configuration "$ROOT_DIR"
METADATA_PATH="$ROOT_DIR/Sources/RelayConsoleCore/Resources/relay-console-release.json"
OUTPUT_ROOT="$ROOT_DIR/.build/release-app-product"
SKIP_BUILD=0
ADHOC_SIGN=1
ARCHITECTURE_POLICY="${RELAY_CONSOLE_ARCHITECTURE_POLICY:-arm64}"

usage() {
  cat <<'USAGE'
Usage: Scripts/build-release-app.sh [--output DIR] [--architecture arm64|x86_64|universal2] [--skip-build] [--no-sign]

Builds a standalone Relay Console.app whose executable, helper, and SwiftPM
resource bundles are embedded in the app. The resulting app never rebuilds from
the source checkout at launch.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || { echo "--output requires a directory" >&2; exit 2; }
      OUTPUT_ROOT="$2"
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      ;;
    --architecture)
      [[ $# -ge 2 ]] || { echo "--architecture requires arm64, x86_64, or universal2" >&2; exit 2; }
      ARCHITECTURE_POLICY="$2"
      shift
      ;;
    --no-sign)
      ADHOC_SIGN=0
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

case "$ARCHITECTURE_POLICY" in
  arm64|x86_64|universal2) ;;
  *) echo "Unsupported architecture policy: $ARCHITECTURE_POLICY" >&2; exit 2 ;;
esac

metadata_value() {
  /usr/bin/plutil -extract "$1" raw -o - "$METADATA_PATH"
}

PRODUCT_NAME="$(metadata_value productName)"
BUNDLE_IDENTIFIER="$(metadata_value bundleIdentifier)"
VERSION="$(metadata_value version)"
BUILD_NUMBER="$(metadata_value build)"
RELEASE_CHANNEL="$(metadata_value releaseChannel)"
MINIMUM_MACOS="$(metadata_value minimumMacOSVersion)"
APPLICATION_CATEGORY="$(metadata_value applicationCategory)"
SPARKLE_FEED_URL="${RELAY_SPARKLE_FEED_URL:-https://insitektalay.github.io/relay-console/appcast.xml}"
SPARKLE_PUBLIC_ED_KEY="${RELAY_SPARKLE_PUBLIC_ED_KEY:-}"
RAILWAY_ORIGIN="${CLAWCHAT_RAILWAY_ORIGIN:-https://your-backend.up.railway.app}"
WEBSOCKET_ORIGIN="${NEXT_PUBLIC_RAILWAY_WS_BASE_URL:-wss://your-backend.up.railway.app}"
POSTHOG_TOKEN="${RELAY_POSTHOG_PROJECT_TOKEN:-}"
POSTHOG_HOST="${RELAY_POSTHOG_HOST:-https://eu.i.posthog.com}"
SENTRY_DSN="${RELAY_SENTRY_DSN:-}"
TELEMETRY_ENVIRONMENT="${RELAY_TELEMETRY_ENVIRONMENT:-$RELEASE_CHANNEL}"
REQUIRE_PRODUCTION_TELEMETRY="${RELAY_REQUIRE_PRODUCTION_TELEMETRY:-0}"

[[ "$RAILWAY_ORIGIN" == https://* ]] || { echo "CLAWCHAT_RAILWAY_ORIGIN must use HTTPS" >&2; exit 1; }
[[ "$WEBSOCKET_ORIGIN" == wss://* ]] || { echo "NEXT_PUBLIC_RAILWAY_WS_BASE_URL must use WSS" >&2; exit 1; }
[[ "$SPARKLE_FEED_URL" == "https://insitektalay.github.io/relay-console/appcast.xml" ]] || { echo "RELAY_SPARKLE_FEED_URL must be the approved immutable-control appcast URL" >&2; exit 1; }
[[ "$SPARKLE_PUBLIC_ED_KEY" =~ ^[A-Za-z0-9+/]{43}=$ ]] || { echo "RELAY_SPARKLE_PUBLIC_ED_KEY must contain the Sparkle generate_keys public EdDSA key" >&2; exit 1; }

case "$REQUIRE_PRODUCTION_TELEMETRY" in
  0|1) ;;
  *) echo "RELAY_REQUIRE_PRODUCTION_TELEMETRY must be 0 or 1" >&2; exit 1 ;;
esac

if [[ "$REQUIRE_PRODUCTION_TELEMETRY" == "1" ]]; then
  [[ "$POSTHOG_TOKEN" == phc_* ]] || { echo "RELAY_POSTHOG_PROJECT_TOKEN must contain a PostHog project token for a production release" >&2; exit 1; }
  [[ "$POSTHOG_HOST" == https://* ]] || { echo "RELAY_POSTHOG_HOST must use HTTPS for a production release" >&2; exit 1; }
  [[ "$SENTRY_DSN" == https://* ]] || { echo "RELAY_SENTRY_DSN must use HTTPS for a production release" >&2; exit 1; }
  [[ "$TELEMETRY_ENVIRONMENT" == "production" ]] || { echo "RELAY_TELEMETRY_ENVIRONMENT must be production for a production release" >&2; exit 1; }
  [[ -n "${SENTRY_AUTH_TOKEN:-}" && -n "${SENTRY_ORG:-}" && -n "${SENTRY_PROJECT:-}" ]] || {
    echo "SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT are required for a production release" >&2
    exit 1
  }
fi

SENTRY_UPLOAD_CONFIGURATION_COUNT=0
for value in "${SENTRY_AUTH_TOKEN:-}" "${SENTRY_ORG:-}" "${SENTRY_PROJECT:-}"; do
  [[ -z "$value" ]] || SENTRY_UPLOAD_CONFIGURATION_COUNT=$((SENTRY_UPLOAD_CONFIGURATION_COUNT + 1))
done
if [[ "$SENTRY_UPLOAD_CONFIGURATION_COUNT" -ne 0 && "$SENTRY_UPLOAD_CONFIGURATION_COUNT" -ne 3 ]]; then
  echo "SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT must be configured together" >&2
  exit 1
fi

APP_PATH="$OUTPUT_ROOT/$PRODUCT_NAME.app"
CONTENTS_PATH="$APP_PATH/Contents"
MACOS_PATH="$CONTENTS_PATH/MacOS"
RESOURCES_PATH="$CONTENTS_PATH/Resources"
FRAMEWORKS_PATH="$CONTENTS_PATH/Frameworks"
MAIN_EXECUTABLE="$MACOS_PATH/$PRODUCT_NAME"
BRIDGE_EXECUTABLE="$MACOS_PATH/RelayMarketplaceToolBridge"
HOST_EXECUTABLE="$MACOS_PATH/RelayHostService"

build_architecture() {
  local architecture="$1"
  local scratch="$ROOT_DIR/.build/release-$architecture"
  if [[ "$SKIP_BUILD" == "0" ]]; then
    swift build --package-path "$ROOT_DIR" --scratch-path "$scratch" -c release --arch "$architecture" -Xswiftc -g --product "$PRODUCT_NAME" >&2 || return $?
    swift build --package-path "$ROOT_DIR" --scratch-path "$scratch" -c release --arch "$architecture" -Xswiftc -g --product RelayMarketplaceToolBridge >&2 || return $?
    swift build --package-path "$ROOT_DIR" --scratch-path "$scratch" -c release --arch "$architecture" -Xswiftc -g --product RelayHostService >&2 || return $?
  fi
  swift build --package-path "$ROOT_DIR" --scratch-path "$scratch" -c release --arch "$architecture" --show-bin-path || return $?
}

resolve_sparkle_framework_source() {
  local architecture="$1"
  local relative_path="artifacts/sparkle/Sparkle/Sparkle.xcframework/macos-arm64_x86_64/Sparkle.framework"
  local candidate

  for candidate in \
    "$ROOT_DIR/.build/release-$architecture/$relative_path" \
    "$ROOT_DIR/.build/$relative_path"; do
    if [[ -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

if [[ "$ARCHITECTURE_POLICY" == "universal2" ]]; then
  ARM_BIN_PATH="$(build_architecture arm64)"
  INTEL_BIN_PATH="$(build_architecture x86_64)"
  BIN_PATH="$ARM_BIN_PATH"
  for path in "$ARM_BIN_PATH/$PRODUCT_NAME" "$ARM_BIN_PATH/RelayMarketplaceToolBridge" "$ARM_BIN_PATH/RelayHostService" "$INTEL_BIN_PATH/$PRODUCT_NAME" "$INTEL_BIN_PATH/RelayMarketplaceToolBridge" "$INTEL_BIN_PATH/RelayHostService"; do
    [[ -x "$path" ]] || { echo "Missing architecture product: $path" >&2; exit 1; }
  done
else
  BIN_PATH="$(build_architecture "$ARCHITECTURE_POLICY")"
  [[ -x "$BIN_PATH/$PRODUCT_NAME" ]] || { echo "Missing release executable: $BIN_PATH/$PRODUCT_NAME" >&2; exit 1; }
  [[ -x "$BIN_PATH/RelayMarketplaceToolBridge" ]] || { echo "Missing release bridge: $BIN_PATH/RelayMarketplaceToolBridge" >&2; exit 1; }
  [[ -x "$BIN_PATH/RelayHostService" ]] || { echo "Missing Relay Host service: $BIN_PATH/RelayHostService" >&2; exit 1; }
fi

mkdir -p "$OUTPUT_ROOT"
if [[ -e "$APP_PATH" ]]; then
  rm -rf "$APP_PATH"
fi
mkdir -p "$MACOS_PATH" "$RESOURCES_PATH" "$FRAMEWORKS_PATH"

if [[ "$ARCHITECTURE_POLICY" == "universal2" ]]; then
  /usr/bin/lipo -create "$ARM_BIN_PATH/$PRODUCT_NAME" "$INTEL_BIN_PATH/$PRODUCT_NAME" -output "$MAIN_EXECUTABLE"
  /usr/bin/lipo -create "$ARM_BIN_PATH/RelayMarketplaceToolBridge" "$INTEL_BIN_PATH/RelayMarketplaceToolBridge" -output "$BRIDGE_EXECUTABLE"
  /usr/bin/lipo -create "$ARM_BIN_PATH/RelayHostService" "$INTEL_BIN_PATH/RelayHostService" -output "$HOST_EXECUTABLE"
else
  cp "$BIN_PATH/$PRODUCT_NAME" "$MAIN_EXECUTABLE"
  cp "$BIN_PATH/RelayMarketplaceToolBridge" "$BRIDGE_EXECUTABLE"
  cp "$BIN_PATH/RelayHostService" "$HOST_EXECUTABLE"
fi
chmod 755 "$MAIN_EXECUTABLE" "$BRIDGE_EXECUTABLE" "$HOST_EXECUTABLE"

SPARKLE_ARTIFACT_ARCHITECTURE="$ARCHITECTURE_POLICY"
if [[ "$SPARKLE_ARTIFACT_ARCHITECTURE" == "universal2" ]]; then
  # Sparkle's binary artifact is already universal, so either architecture's
  # fresh SwiftPM scratch directory contains the framework needed by the app.
  SPARKLE_ARTIFACT_ARCHITECTURE="arm64"
fi
if ! SPARKLE_FRAMEWORK_SOURCE="$(resolve_sparkle_framework_source "$SPARKLE_ARTIFACT_ARCHITECTURE")"; then
  echo "Resolved Sparkle.framework not found in the release scratch directory or default SwiftPM build directory" >&2
  exit 1
fi
/usr/bin/ditto "$SPARKLE_FRAMEWORK_SOURCE" "$FRAMEWORKS_PATH/Sparkle.framework"
# Relay Console is not sandboxed, so Sparkle's optional sandbox XPC services are deliberately omitted.
rm -rf "$FRAMEWORKS_PATH/Sparkle.framework/Versions/B/XPCServices" "$FRAMEWORKS_PATH/Sparkle.framework/XPCServices"
if ! /usr/bin/otool -l "$MAIN_EXECUTABLE" | grep -q '@executable_path/../Frameworks'; then
  /usr/bin/install_name_tool -add_rpath '@executable_path/../Frameworks' "$MAIN_EXECUTABLE"
fi

RESOURCE_COUNT=0
while IFS= read -r bundle; do
  [[ -n "$bundle" ]] || continue
  cp -R "$bundle" "$RESOURCES_PATH/"
  RESOURCE_COUNT=$((RESOURCE_COUNT + 1))
done < <(find "$BIN_PATH" -maxdepth 1 -type d -name '*.bundle' | sort)
[[ "$RESOURCE_COUNT" -ge 2 ]] || { echo "Expected SwiftPM resource bundles, found $RESOURCE_COUNT" >&2; exit 1; }

cp "$ROOT_DIR/Sources/RelayConsoleApp/Resources/Assets/AppIcon/icon.icns" "$RESOURCES_PATH/RelayConsole.icns"
cp "$ROOT_DIR/Release/PrivacyInfo.xcprivacy" "$RESOURCES_PATH/PrivacyInfo.xcprivacy"
cp "$ROOT_DIR/Release/THIRD_PARTY_NOTICES.md" "$RESOURCES_PATH/THIRD_PARTY_NOTICES.md"
cp "$ROOT_DIR/Release/swift-cmark-COPYING" "$RESOURCES_PATH/swift-cmark-COPYING"
cp "$ROOT_DIR/Release/Sparkle-LICENSE" "$RESOURCES_PATH/Sparkle-LICENSE"
printf 'APPL????' > "$CONTENTS_PATH/PkgInfo"

cat > "$CONTENTS_PATH/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>$PRODUCT_NAME</string>
  <key>CFBundleExecutable</key>
  <string>$PRODUCT_NAME</string>
  <key>CFBundleIconFile</key>
  <string>RelayConsole</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_IDENTIFIER</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeRole</key>
      <string>Editor</string>
      <key>CFBundleURLName</key>
      <string>com.relayconsole.app.oauth</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>relayconsole</string>
      </array>
    </dict>
  </array>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$PRODUCT_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundleVersion</key>
  <string>$BUILD_NUMBER</string>
  <key>LSApplicationCategoryType</key>
  <string>$APPLICATION_CATEGORY</string>
  <key>LSMinimumSystemVersion</key>
  <string>$MINIMUM_MACOS</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSAppleMusicUsageDescription</key>
  <string>Relay Console accesses media only when you choose media to attach.</string>
  <key>NSDesktopFolderUsageDescription</key>
  <string>Relay Console accesses Desktop files only when you explicitly select them.</string>
  <key>NSDocumentsFolderUsageDescription</key>
  <string>Relay Console accesses Documents files only when you explicitly select them.</string>
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Relay Console accesses Photos only when you choose an image or video to attach.</string>
  <key>RelayConsoleReleaseChannel</key>
  <string>$RELEASE_CHANNEL</string>
  <key>RelayConsoleArchitecturePolicy</key>
  <string>$ARCHITECTURE_POLICY</string>
  <key>SUFeedURL</key>
  <string>$SPARKLE_FEED_URL</string>
  <key>SUPublicEDKey</key>
  <string>$SPARKLE_PUBLIC_ED_KEY</string>
  <key>SURequireSignedFeed</key>
  <true/>
  <key>SUEnableAutomaticChecks</key>
  <true/>
  <key>SUScheduledCheckInterval</key>
  <integer>86400</integer>
  <key>SUAllowsAutomaticUpdates</key>
  <false/>
  <key>SUAutomaticallyUpdate</key>
  <false/>
</dict>
</plist>
PLIST

if [[ -n "$POSTHOG_TOKEN" ]]; then
  [[ "$POSTHOG_HOST" == https://* ]] || { echo "RELAY_POSTHOG_HOST must use HTTPS" >&2; exit 1; }
  /usr/bin/plutil -insert RelayPostHogProjectToken -string "$POSTHOG_TOKEN" "$CONTENTS_PATH/Info.plist"
  /usr/bin/plutil -insert RelayPostHogHost -string "$POSTHOG_HOST" "$CONTENTS_PATH/Info.plist"
fi
if [[ -n "$SENTRY_DSN" ]]; then
  [[ "$SENTRY_DSN" == https://* ]] || { echo "RELAY_SENTRY_DSN must use HTTPS" >&2; exit 1; }
  /usr/bin/plutil -insert RelaySentryDSN -string "$SENTRY_DSN" "$CONTENTS_PATH/Info.plist"
fi
/usr/bin/plutil -insert RelayTelemetryEnvironment -string "$TELEMETRY_ENVIRONMENT" "$CONTENTS_PATH/Info.plist"
/usr/bin/plutil -insert RelayConsoleRailwayOrigin -string "$RAILWAY_ORIGIN" "$CONTENTS_PATH/Info.plist"
/usr/bin/plutil -insert RelayConsoleWebSocketBaseURL -string "$WEBSOCKET_ORIGIN" "$CONTENTS_PATH/Info.plist"

/usr/bin/plutil -lint "$CONTENTS_PATH/Info.plist" >/dev/null
/usr/bin/plutil -lint "$RESOURCES_PATH/PrivacyInfo.xcprivacy" >/dev/null

DSYM_PATH="$OUTPUT_ROOT/$PRODUCT_NAME.app.dSYM"
rm -rf "$DSYM_PATH"
if command -v dsymutil >/dev/null 2>&1; then
  dsymutil "$MAIN_EXECUTABLE" -o "$DSYM_PATH"
fi
if [[ -d "$DSYM_PATH" ]] && command -v dwarfdump >/dev/null 2>&1; then
  EXECUTABLE_UUIDS="$(dwarfdump --uuid "$MAIN_EXECUTABLE")"
  DSYM_UUIDS="$(dwarfdump --uuid "$DSYM_PATH")"
  while read -r uuid; do
    [[ -n "$uuid" ]] || continue
    grep -q "$uuid" <<<"$DSYM_UUIDS" || {
      echo "Relay Console dSYM is missing executable UUID $uuid" >&2
      exit 1
    }
  done < <(awk '{print $2}' <<<"$EXECUTABLE_UUIDS")
fi

if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
  [[ -n "${SENTRY_ORG:-}" && -n "${SENTRY_PROJECT:-}" ]] || {
    echo "SENTRY_ORG and SENTRY_PROJECT are required when SENTRY_AUTH_TOKEN is set" >&2
    exit 1
  }
  SENTRY_CLI_BIN="${SENTRY_CLI_BIN:-sentry-cli}"
  command -v "$SENTRY_CLI_BIN" >/dev/null 2>&1 || {
    echo "sentry-cli is required to upload release symbols" >&2
    exit 1
  }
  [[ -d "$DSYM_PATH" ]] || { echo "Relay Console dSYM was not generated" >&2; exit 1; }
  "$SENTRY_CLI_BIN" debug-files upload \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT" \
    "$DSYM_PATH"
elif [[ -d "$DSYM_PATH" ]]; then
  echo "Sentry dSYM generated at $DSYM_PATH (set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT to upload)" >&2
fi

if [[ "$ADHOC_SIGN" == "1" ]] && command -v codesign >/dev/null 2>&1; then
  SPARKLE_FRAMEWORK="$FRAMEWORKS_PATH/Sparkle.framework"
  codesign --force --options runtime --timestamp=none --sign - "$SPARKLE_FRAMEWORK/Versions/B/Autoupdate"
  codesign --force --options runtime --timestamp=none --sign - "$SPARKLE_FRAMEWORK/Versions/B/Updater.app"
  codesign --force --options runtime --timestamp=none --sign - "$SPARKLE_FRAMEWORK"
  codesign --force --sign - "$BRIDGE_EXECUTABLE"
  codesign --force --identifier "Relay Console" --sign - "$HOST_EXECUTABLE"
  codesign --force --identifier "Relay Console" --sign - "$MAIN_EXECUTABLE"
  codesign --force --sign - "$APP_PATH"
fi

if [[ "$ADHOC_SIGN" == "1" ]]; then
  "$ROOT_DIR/Scripts/validate-release-app.sh" "$APP_PATH"
else
  "$ROOT_DIR/Scripts/validate-release-app.sh" --skip-signature-verification "$APP_PATH"
fi
RELEASE_TEST_ARCHITECTURE="$ARCHITECTURE_POLICY"
if [[ "$RELEASE_TEST_ARCHITECTURE" == "universal2" ]]; then
  RELEASE_TEST_ARCHITECTURE="arm64"
fi
RELAY_CONSOLE_RELEASE_APP_PATH="$APP_PATH" swift run \
  --package-path "$ROOT_DIR" \
  --scratch-path "$ROOT_DIR/.build/release-$RELEASE_TEST_ARCHITECTURE" \
  -c release \
  --arch "$RELEASE_TEST_ARCHITECTURE" \
  RelayConsoleReleaseBundleTests

echo "$APP_PATH"
