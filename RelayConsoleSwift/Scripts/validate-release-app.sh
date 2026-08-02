#!/usr/bin/env bash
set -euo pipefail

SKIP_SIGNATURE_VERIFICATION=0
if [[ "${1:-}" == "--skip-signature-verification" ]]; then
  SKIP_SIGNATURE_VERIFICATION=1
  shift
fi
[[ $# -eq 1 ]] || { echo "Usage: Scripts/validate-release-app.sh [--skip-signature-verification] /path/to/Relay Console.app" >&2; exit 2; }

APP_PATH="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
METADATA_PATH="$ROOT_DIR/Sources/RelayConsoleCore/Resources/relay-console-release.json"
CONTENTS_PATH="$APP_PATH/Contents"
INFO_PLIST="$CONTENTS_PATH/Info.plist"
MAIN_EXECUTABLE="$CONTENTS_PATH/MacOS/Relay Console"
BRIDGE_EXECUTABLE="$CONTENTS_PATH/MacOS/RelayMarketplaceToolBridge"
RESOURCES_PATH="$CONTENTS_PATH/Resources"
SPARKLE_FRAMEWORK="$CONTENTS_PATH/Frameworks/Sparkle.framework"

[[ -d "$APP_PATH" ]] || { echo "App bundle not found: $APP_PATH" >&2; exit 1; }
[[ -f "$INFO_PLIST" ]] || { echo "Info.plist missing" >&2; exit 1; }
[[ -x "$MAIN_EXECUTABLE" ]] || { echo "Standalone main executable missing" >&2; exit 1; }
[[ -x "$BRIDGE_EXECUTABLE" ]] || { echo "Marketplace bridge missing" >&2; exit 1; }
[[ -f "$RESOURCES_PATH/PrivacyInfo.xcprivacy" ]] || { echo "Privacy manifest missing from Contents/Resources" >&2; exit 1; }
[[ -f "$RESOURCES_PATH/THIRD_PARTY_NOTICES.md" ]] || { echo "Third-party notices missing" >&2; exit 1; }
[[ -f "$RESOURCES_PATH/swift-cmark-COPYING" ]] || { echo "swift-cmark component notices missing" >&2; exit 1; }
[[ -f "$RESOURCES_PATH/Sparkle-LICENSE" ]] || { echo "Sparkle licence missing" >&2; exit 1; }
[[ -d "$SPARKLE_FRAMEWORK" ]] || { echo "Sparkle.framework missing" >&2; exit 1; }
[[ -x "$SPARKLE_FRAMEWORK/Versions/B/Autoupdate" ]] || { echo "Sparkle Autoupdate helper missing" >&2; exit 1; }
[[ -x "$SPARKLE_FRAMEWORK/Versions/B/Updater.app/Contents/MacOS/Updater" ]] || { echo "Sparkle Updater.app missing" >&2; exit 1; }
[[ ! -e "$SPARKLE_FRAMEWORK/Versions/B/XPCServices" ]] || { echo "Sandbox-only Sparkle XPC services must not ship in this non-sandboxed app" >&2; exit 1; }
grep -q 'Swift Markdown UI 2.4.1' "$RESOURCES_PATH/THIRD_PARTY_NOTICES.md" || { echo "Swift Markdown UI notice missing" >&2; exit 1; }
grep -q 'NetworkImage 6.0.1' "$RESOURCES_PATH/THIRD_PARTY_NOTICES.md" || { echo "NetworkImage notice missing" >&2; exit 1; }
grep -q 'swift-cmark 0.8.0' "$RESOURCES_PATH/THIRD_PARTY_NOTICES.md" || { echo "swift-cmark notice missing" >&2; exit 1; }
grep -q 'PostHog Apple SDK 3.67.1' "$RESOURCES_PATH/THIRD_PARTY_NOTICES.md" || { echo "PostHog notice missing" >&2; exit 1; }
grep -q 'Sentry Cocoa 9.23.0' "$RESOURCES_PATH/THIRD_PARTY_NOTICES.md" || { echo "Sentry notice missing" >&2; exit 1; }
grep -q 'Sparkle 2.9.4' "$RESOURCES_PATH/THIRD_PARTY_NOTICES.md" || { echo "Sparkle notice missing" >&2; exit 1; }
[[ ! -e "$CONTENTS_PATH/MacOS/Relay Console Launcher" ]] || { echo "Development rebuild launcher must not ship" >&2; exit 1; }
/usr/bin/plutil -lint "$RESOURCES_PATH/PrivacyInfo.xcprivacy" >/dev/null || { echo "Privacy manifest is invalid" >&2; exit 1; }
/usr/bin/plutil -extract NSPrivacyTracking raw -o - "$RESOURCES_PATH/PrivacyInfo.xcprivacy" | grep -qx 'false' || { echo "Privacy manifest must disable tracking" >&2; exit 1; }
grep -q 'NSPrivacyAccessedAPICategoryUserDefaults' "$RESOURCES_PATH/PrivacyInfo.xcprivacy" || { echo "Privacy manifest is missing UserDefaults use" >&2; exit 1; }
grep -q 'NSPrivacyAccessedAPICategoryFileTimestamp' "$RESOURCES_PATH/PrivacyInfo.xcprivacy" || { echo "Privacy manifest is missing file timestamp use" >&2; exit 1; }
grep -q 'NSPrivacyCollectedDataTypeProductInteraction' "$RESOURCES_PATH/PrivacyInfo.xcprivacy" || { echo "Privacy manifest is missing analytics collection" >&2; exit 1; }
grep -q 'NSPrivacyCollectedDataTypeCrashData' "$RESOURCES_PATH/PrivacyInfo.xcprivacy" || { echo "Privacy manifest is missing crash collection" >&2; exit 1; }

[[ "$(/usr/bin/plutil -extract CFBundleExecutable raw -o - "$INFO_PLIST")" == "Relay Console" ]] || { echo "CFBundleExecutable mismatch" >&2; exit 1; }
EXPECTED_IDENTIFIER="$(/usr/bin/plutil -extract bundleIdentifier raw -o - "$METADATA_PATH")"
EXPECTED_VERSION="$(/usr/bin/plutil -extract version raw -o - "$METADATA_PATH")"
EXPECTED_BUILD="$(/usr/bin/plutil -extract build raw -o - "$METADATA_PATH")"
EXPECTED_CHANNEL="$(/usr/bin/plutil -extract releaseChannel raw -o - "$METADATA_PATH")"
[[ "$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$INFO_PLIST")" == "$EXPECTED_IDENTIFIER" ]] || { echo "CFBundleIdentifier mismatch" >&2; exit 1; }
[[ "$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$INFO_PLIST")" == "$EXPECTED_VERSION" ]] || { echo "CFBundleShortVersionString mismatch" >&2; exit 1; }
[[ "$(/usr/bin/plutil -extract CFBundleVersion raw -o - "$INFO_PLIST")" == "$EXPECTED_BUILD" ]] || { echo "CFBundleVersion mismatch" >&2; exit 1; }
[[ "$(/usr/bin/plutil -extract RelayConsoleReleaseChannel raw -o - "$INFO_PLIST")" == "$EXPECTED_CHANNEL" ]] || { echo "Release channel mismatch" >&2; exit 1; }
[[ "$(/usr/bin/plutil -extract SUFeedURL raw -o - "$INFO_PLIST")" == "https://insitektalay.github.io/clawchat/appcast.xml" ]] || { echo "Approved Sparkle HTTPS feed missing" >&2; exit 1; }
SPARKLE_PUBLIC_KEY="$(/usr/bin/plutil -extract SUPublicEDKey raw -o - "$INFO_PLIST")"
[[ "$SPARKLE_PUBLIC_KEY" =~ ^[A-Za-z0-9+/]{43}=$ ]] || { echo "Valid Sparkle public EdDSA key missing" >&2; exit 1; }
[[ "$(/usr/bin/plutil -extract SURequireSignedFeed raw -o - "$INFO_PLIST")" == "true" ]] || { echo "Sparkle signed-appcast enforcement missing" >&2; exit 1; }
[[ "$(/usr/bin/plutil -extract SUAllowsAutomaticUpdates raw -o - "$INFO_PLIST")" == "false" ]] || { echo "Sparkle automatic installation must remain disabled" >&2; exit 1; }

ARCHITECTURE_POLICY="$(/usr/bin/plutil -extract RelayConsoleArchitecturePolicy raw -o - "$INFO_PLIST")"
MAIN_ARCHITECTURES="$(/usr/bin/lipo -archs "$MAIN_EXECUTABLE")"
BRIDGE_ARCHITECTURES="$(/usr/bin/lipo -archs "$BRIDGE_EXECUTABLE")"
case "$ARCHITECTURE_POLICY" in
  arm64|x86_64)
    [[ "$MAIN_ARCHITECTURES" == "$ARCHITECTURE_POLICY" && "$BRIDGE_ARCHITECTURES" == "$ARCHITECTURE_POLICY" ]] || { echo "Thin architecture policy mismatch" >&2; exit 1; }
    ;;
  universal2)
    for architecture in arm64 x86_64; do
      [[ " $MAIN_ARCHITECTURES " == *" $architecture "* && " $BRIDGE_ARCHITECTURES " == *" $architecture "* ]] || { echo "Universal architecture missing: $architecture" >&2; exit 1; }
    done
    ;;
  *) echo "Unknown packaged architecture policy: $ARCHITECTURE_POLICY" >&2; exit 1 ;;
esac

RESOURCE_COUNT="$(find "$RESOURCES_PATH" -maxdepth 1 -type d -name 'RelayConsoleSwift_*.bundle' | wc -l | tr -d ' ')"
[[ "$RESOURCE_COUNT" == "2" ]] || { echo "Expected exactly two resource bundles in Contents/Resources" >&2; exit 1; }
ROOT_RESOURCE_COUNT="$(find "$APP_PATH" -maxdepth 1 -type d -name 'RelayConsoleSwift_*.bundle' | wc -l | tr -d ' ')"
[[ "$ROOT_RESOURCE_COUNT" == "0" ]] || { echo "Resource bundles must not be duplicated at the app root" >&2; exit 1; }

/usr/bin/file "$MAIN_EXECUTABLE" | grep -q 'Mach-O' || { echo "Main executable is not Mach-O" >&2; exit 1; }
/usr/bin/file "$BRIDGE_EXECUTABLE" | grep -q 'Mach-O' || { echo "Bridge executable is not Mach-O" >&2; exit 1; }
/usr/bin/otool -L "$MAIN_EXECUTABLE" >/dev/null
/usr/bin/otool -L "$BRIDGE_EXECUTABLE" >/dev/null
/usr/bin/otool -L "$MAIN_EXECUTABLE" | grep -q 'Sparkle.framework/Versions/B/Sparkle' || { echo "Main executable is not linked to embedded Sparkle" >&2; exit 1; }
/usr/bin/otool -l "$MAIN_EXECUTABLE" | grep -q '@executable_path/../Frameworks' || { echo "Sparkle framework rpath missing" >&2; exit 1; }

if [[ "$SKIP_SIGNATURE_VERIFICATION" == "0" ]] && command -v codesign >/dev/null 2>&1; then
  codesign --verify --deep --strict "$APP_PATH"
  codesign --verify --strict "$SPARKLE_FRAMEWORK/Versions/B/Autoupdate"
  codesign --verify --strict "$SPARKLE_FRAMEWORK/Versions/B/Updater.app"
  codesign --verify --strict "$SPARKLE_FRAMEWORK"
fi

echo "Standalone release app validation passed"
