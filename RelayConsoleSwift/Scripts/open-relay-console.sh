#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/Scripts/load-owner-configuration.sh"
relay_load_owner_configuration "$ROOT_DIR"
METADATA_PATH="$ROOT_DIR/Sources/RelayConsoleCore/Resources/relay-console-release.json"
CONFIGURATION="debug"
PIN_DOCK=0
OPEN_APP=1

usage() {
  cat <<'USAGE'
Usage: Scripts/open-relay-console.sh [--release] [--pin-dock] [--no-open]

Builds a development-only Relay Console launcher and installs it at:
  ~/Applications/Relay Console.app

The installed app rebuilds from this workspace every time it cold-launches, so
quit and reopen it to pick up source changes.

For a standalone public-beta app, use Scripts/build-release-app.sh.
USAGE
}

metadata_value() {
  /usr/bin/plutil -extract "$1" raw -o - "$METADATA_PATH"
}

RELEASE_BUNDLE_IDENTIFIER="$(metadata_value bundleIdentifier)"
RELEASE_VERSION="$(metadata_value version)"
RELEASE_BUILD="$(metadata_value build)"
POSTHOG_TOKEN="${RELAY_POSTHOG_PROJECT_TOKEN:-}"
POSTHOG_HOST="${RELAY_POSTHOG_HOST:-https://eu.i.posthog.com}"
SENTRY_DSN="${RELAY_SENTRY_DSN:-}"
TELEMETRY_ENVIRONMENT="${RELAY_TELEMETRY_ENVIRONMENT:-development}"
RAILWAY_ORIGIN="${CLAWCHAT_RAILWAY_ORIGIN:-https://your-backend.up.railway.app}"
WEBSOCKET_ORIGIN="${NEXT_PUBLIC_RAILWAY_WS_BASE_URL:-wss://your-backend.up.railway.app}"

if [[ -n "$POSTHOG_TOKEN" && "$POSTHOG_HOST" != https://* ]]; then
  echo "RELAY_POSTHOG_HOST must use HTTPS" >&2
  exit 1
fi
if [[ -n "$SENTRY_DSN" && "$SENTRY_DSN" != https://* ]]; then
  echo "RELAY_SENTRY_DSN must use HTTPS" >&2
  exit 1
fi
if [[ "$RAILWAY_ORIGIN" != https://* ]]; then
  echo "CLAWCHAT_RAILWAY_ORIGIN must use HTTPS" >&2
  exit 1
fi
if [[ "$WEBSOCKET_ORIGIN" != wss://* ]]; then
  echo "NEXT_PUBLIC_RAILWAY_WS_BASE_URL must use WSS" >&2
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release)
      CONFIGURATION="release"
      ;;
    --pin-dock)
      PIN_DOCK=1
      ;;
    --no-open)
      OPEN_APP=0
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

cd "$ROOT_DIR"

APP_DIR="${RELAY_CONSOLE_APP_DIR:-$HOME/Applications/Relay Console.app}"
APP_PARENT_DIR="$(dirname "$APP_DIR")"
APP_NAME="$(basename "$APP_DIR")"
mkdir -p "$APP_PARENT_DIR"
APP_PARENT_DIR="$(cd "$APP_PARENT_DIR" && pwd)"
APP_DIR="$APP_PARENT_DIR/$APP_NAME"

STALE_DIST_APP_DIR="$ROOT_DIR/dist/Relay Console.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
LAUNCHER_NAME="Relay Console Launcher"
RUNTIME_NAME="Relay Console.bin"
BRIDGE_NAME="RelayMarketplaceToolBridge"
RESOURCE_BUNDLE_GLOB="RelayConsoleSwift_*.bundle"
LOCK_DIR="${TMPDIR:-/tmp}/relay-console-swift-launcher.lock"
LOCK_OWNER_FILE="$LOCK_DIR/pid"
LOCK_ACQUIRED=0
LOCK_WAIT_LIMIT=9000
LOCK_MISSING_OWNER_GRACE=25

release_build_lock() {
  if [[ "$LOCK_ACQUIRED" == "1" ]]; then
    rm -f "$LOCK_OWNER_FILE" >/dev/null 2>&1 || true
    rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
    LOCK_ACQUIRED=0
  fi
}

cleanup() {
  release_build_lock
}
trap cleanup EXIT

acquire_build_lock() {
  local wait_count=0
  local missing_owner_wait_count=0
  local owner_pid=""
  local stale_lock_dir=""
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    if [[ -f "$LOCK_OWNER_FILE" ]]; then
      missing_owner_wait_count=0
      owner_pid="$(<"$LOCK_OWNER_FILE")"
      if [[ "$owner_pid" =~ ^[0-9]+$ ]] && ! kill -0 "$owner_pid" 2>/dev/null; then
        stale_lock_dir="$LOCK_DIR.stale.$$"
        if mv "$LOCK_DIR" "$stale_lock_dir" 2>/dev/null; then
          rm -rf "$stale_lock_dir"
          echo "Recovered an abandoned Relay Console build lock from PID $owner_pid."
          continue
        fi
      fi
    else
      missing_owner_wait_count=$((missing_owner_wait_count + 1))
      if (( missing_owner_wait_count >= LOCK_MISSING_OWNER_GRACE )); then
        stale_lock_dir="$LOCK_DIR.stale.$$"
        if mv "$LOCK_DIR" "$stale_lock_dir" 2>/dev/null; then
          rm -rf "$stale_lock_dir"
          echo "Recovered an abandoned Relay Console build lock with no owner PID."
          missing_owner_wait_count=0
          continue
        fi
      fi
    fi
    if (( wait_count >= LOCK_WAIT_LIMIT )); then
      echo "Timed out waiting for another Relay Console build to finish." >&2
      exit 1
    fi
    if (( wait_count == 0 )); then
      echo "Another Relay Console build is already running; waiting for it to finish..."
    elif (( wait_count % 75 == 0 )); then
      echo "Still waiting for the other Relay Console build ($((wait_count / 5)) seconds elapsed)..."
    fi
    sleep 0.2
    wait_count=$((wait_count + 1))
  done
  printf '%s\n' "$$" > "$LOCK_OWNER_FILE"
  LOCK_ACQUIRED=1
}

quit_running_app() {
  osascript -e 'tell application "Relay Console" to quit' >/dev/null 2>&1 || true
  sleep 0.8
  pkill -x "Relay Console" >/dev/null 2>&1 || true
  pkill -x "$RUNTIME_NAME" >/dev/null 2>&1 || true
}

codesign_identity() {
  if [[ -n "${RELAY_CONSOLE_CODESIGN_IDENTITY:-}" ]]; then
    printf '%s\n' "$RELAY_CONSOLE_CODESIGN_IDENTITY"
    return 0
  fi
  security find-identity -v -p codesigning 2>/dev/null \
    | sed -n 's/^[[:space:]]*[0-9]*) \([A-Fa-f0-9]\{40\}\) "Apple Development:[^"]*".*/\1/p' \
    | head -n 1
}

sign_local_executable() {
  local target="$1"
  local identifier="${2:-$(basename "$target")}"
  local identity
  if ! command -v codesign >/dev/null 2>&1 || [[ ! -e "$target" ]]; then
    return 0
  fi
  identity="$(codesign_identity)"
  if [[ -z "$identity" ]]; then
    identity="-"
  fi
  codesign --force --timestamp=none --identifier "$identifier" --sign "$identity" "$target" >/dev/null 2>&1 \
    || codesign --force --sign - "$target" >/dev/null 2>&1 \
    || true
}

run_swift_build_once() {
  if [[ "$CONFIGURATION" == "release" ]]; then
    swift build --jobs 2 -c release --product "Relay Console" || return $?
    swift build --jobs 2 -c release --product "$BRIDGE_NAME"
  else
    swift build --jobs 2 --product "Relay Console" || return $?
    swift build --jobs 2 --product "$BRIDGE_NAME"
  fi
}

build_package() {
  local attempt=1
  local max_attempts=2
  local build_log
  local status

  while (( attempt <= max_attempts )); do
    build_log="$(mktemp "${TMPDIR:-/tmp}/relay-console-swift-build.XXXXXX")"
    set +e
    run_swift_build_once 2>&1 | tee "$build_log"
    status=${PIPESTATUS[0]}
    set -e

    if [[ "$status" -eq 0 ]]; then
      rm -f "$build_log"
      return 0
    fi

    if (( attempt < max_attempts )) && grep -q "was modified during the build" "$build_log"; then
      echo "SwiftPM saw a source file change during the build; waiting briefly and retrying once..."
      rm -f "$build_log"
      sleep 1
      attempt=$((attempt + 1))
      continue
    fi

    rm -f "$build_log"
    return "$status"
  done
}

find_built_executable() {
  local executable="$ROOT_DIR/.build/$CONFIGURATION/Relay Console"
  if [[ -x "$executable" ]]; then
    printf '%s\n' "$executable"
    return 0
  fi
  find "$ROOT_DIR/.build" -path "*/$CONFIGURATION/Relay Console" -type f -perm -111 | head -n 1
}

find_built_bridge() {
  local executable="$ROOT_DIR/.build/$CONFIGURATION/$BRIDGE_NAME"
  if [[ -x "$executable" ]]; then
    printf '%s\n' "$executable"
    return 0
  fi
  find "$ROOT_DIR/.build" -path "*/$CONFIGURATION/$BRIDGE_NAME" -type f -perm -111 | head -n 1
}

find_resource_bundles() {
  find "$ROOT_DIR/.build" -path "*/$CONFIGURATION/$RESOURCE_BUNDLE_GLOB" -type d | sort
}

escape_for_double_quotes() {
  sed 's/\\/\\\\/g; s/"/\\"/g; s/\$/\\$/g; s/`/\\`/g' <<<"$1"
}

write_launcher() {
  local launcher_path="$MACOS_DIR/$LAUNCHER_NAME"
  local escaped_root_dir
  local escaped_configuration
  escaped_root_dir="$(escape_for_double_quotes "$ROOT_DIR")"
  escaped_configuration="$(escape_for_double_quotes "$CONFIGURATION")"

  cat > "$launcher_path" <<LAUNCHER
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$escaped_root_dir"
DEFAULT_CONFIGURATION="$escaped_configuration"
CONFIGURATION="\${RELAY_CONSOLE_CONFIGURATION:-\$DEFAULT_CONFIGURATION}"
APP_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")/../.." && pwd)"
CONTENTS_DIR="\$APP_DIR/Contents"
MACOS_DIR="\$CONTENTS_DIR/MacOS"
RESOURCES_DIR="\$CONTENTS_DIR/Resources"
RESOURCE_BUNDLE_GLOB="$RESOURCE_BUNDLE_GLOB"
RUNTIME_EXECUTABLE="\$MACOS_DIR/$RUNTIME_NAME"
BRIDGE_EXECUTABLE="\$MACOS_DIR/$BRIDGE_NAME"
LOG_DIR="\$HOME/Library/Logs/Relay Console"
LOG_FILE="\$LOG_DIR/launcher.log"
LOCK_DIR="\${TMPDIR:-/tmp}/relay-console-swift-launcher.lock"
LOCK_OWNER_FILE="\$LOCK_DIR/pid"
LOCK_ACQUIRED=0
LOCK_WAIT_LIMIT=9000
LOCK_MISSING_OWNER_GRACE=25

mkdir -p "\$LOG_DIR"
exec >>"\$LOG_FILE" 2>&1

cleanup() {
  local status=\$?
  if [[ "\$LOCK_ACQUIRED" == "1" ]]; then
    rm -f "\$LOCK_OWNER_FILE" >/dev/null 2>&1 || true
    rmdir "\$LOCK_DIR" >/dev/null 2>&1 || true
  fi
  if [[ \$status -ne 0 ]]; then
    /usr/bin/osascript -e 'display notification "Build failed. See ~/Library/Logs/Relay Console/launcher.log" with title "Relay Console"' >/dev/null 2>&1 || true
  fi
  exit \$status
}
trap cleanup EXIT

echo "[\$(date)] Launching Relay Console from \$ROOT_DIR (\$CONFIGURATION)"
cd /
if ! cd "\$ROOT_DIR" 2>/dev/null || ! /bin/pwd -P >/dev/null 2>&1; then
  echo "Relay Console cannot read \$ROOT_DIR from a Dock launch. Starting the bundled app without rebuilding."
  /usr/bin/osascript -e 'display notification "Opened the installed build. Grant Relay Console access to Documents, or rerun the launcher script after source edits, to refresh from the Dock." with title "Relay Console"' >/dev/null 2>&1 || true
  cd /
  trap - EXIT
  exec "\$RUNTIME_EXECUTABLE"
fi
export PWD="\$ROOT_DIR"

wait_count=0
missing_owner_wait_count=0
while ! mkdir "\$LOCK_DIR" 2>/dev/null; do
  if [[ -f "\$LOCK_OWNER_FILE" ]]; then
    missing_owner_wait_count=0
    owner_pid="\$(<"\$LOCK_OWNER_FILE")"
    if [[ "\$owner_pid" =~ ^[0-9]+\$ ]] && ! kill -0 "\$owner_pid" 2>/dev/null; then
      stale_lock_dir="\$LOCK_DIR.stale.\$\$"
      if mv "\$LOCK_DIR" "\$stale_lock_dir" 2>/dev/null; then
        rm -rf "\$stale_lock_dir"
        echo "Recovered an abandoned Relay Console build lock from PID \$owner_pid."
        continue
      fi
    fi
  else
    missing_owner_wait_count=\$((missing_owner_wait_count + 1))
    if (( missing_owner_wait_count >= LOCK_MISSING_OWNER_GRACE )); then
      stale_lock_dir="\$LOCK_DIR.stale.\$\$"
      if mv "\$LOCK_DIR" "\$stale_lock_dir" 2>/dev/null; then
        rm -rf "\$stale_lock_dir"
        echo "Recovered an abandoned Relay Console build lock with no owner PID."
        missing_owner_wait_count=0
        continue
      fi
    fi
  fi
  if (( wait_count >= LOCK_WAIT_LIMIT )); then
    echo "Timed out waiting for another Relay Console build to finish."
    exit 1
  fi
  if (( wait_count == 0 )); then
    echo "Another Relay Console build is already running; waiting for it to finish..."
  elif (( wait_count % 75 == 0 )); then
    echo "Still waiting for the other Relay Console build (\$((wait_count / 5)) seconds elapsed)..."
  fi
  sleep 0.2
  wait_count=\$((wait_count + 1))
done
printf '%s\n' "\$\$" > "\$LOCK_OWNER_FILE"
LOCK_ACQUIRED=1

codesign_identity() {
  if [[ -n "\${RELAY_CONSOLE_CODESIGN_IDENTITY:-}" ]]; then
    printf '%s\n' "\$RELAY_CONSOLE_CODESIGN_IDENTITY"
    return 0
  fi
  security find-identity -v -p codesigning 2>/dev/null \\
    | sed -n 's/^[[:space:]]*[0-9]*) \\([A-Fa-f0-9]\\{40\\}\\) "Apple Development:[^"]*".*/\\1/p' \\
    | head -n 1
}

sign_local_executable() {
  local target="\$1"
  local identifier="\${2:-\$(basename "\$target")}"
  local identity
  if ! command -v codesign >/dev/null 2>&1 || [[ ! -e "\$target" ]]; then
    return 0
  fi
  identity="\$(codesign_identity)"
  if [[ -z "\$identity" ]]; then
    identity="-"
  fi
  codesign --force --timestamp=none --identifier "\$identifier" --sign "\$identity" "\$target" >/dev/null 2>&1 \\
    || codesign --force --sign - "\$target" >/dev/null 2>&1 \\
    || true
}

run_swift_build_once() {
  if [[ "\$CONFIGURATION" == "release" ]]; then
    swift build --jobs 2 --package-path "\$ROOT_DIR" -c release --product "Relay Console" || return \$?
    swift build --jobs 2 --package-path "\$ROOT_DIR" -c release --product "$BRIDGE_NAME"
  else
    swift build --jobs 2 --package-path "\$ROOT_DIR" --product "Relay Console" || return \$?
    swift build --jobs 2 --package-path "\$ROOT_DIR" --product "$BRIDGE_NAME"
  fi
}

build_package() {
  local attempt=1
  local max_attempts=2
  local build_log
  local status

  while (( attempt <= max_attempts )); do
    build_log="\$(mktemp "\${TMPDIR:-/tmp}/relay-console-swift-build.XXXXXX")"
    set +e
    run_swift_build_once 2>&1 | tee "\$build_log"
    status=\${PIPESTATUS[0]}
    set -e

    if [[ "\$status" -eq 0 ]]; then
      rm -f "\$build_log"
      return 0
    fi

    if (( attempt < max_attempts )) && grep -q "was modified during the build" "\$build_log"; then
      echo "SwiftPM saw a source file change during the build; waiting briefly and retrying once..."
      rm -f "\$build_log"
      sleep 1
      attempt=\$((attempt + 1))
      continue
    fi

    rm -f "\$build_log"
    return "\$status"
  done
}

set +e
build_package
build_status=\$?
set -e

if [[ "\$build_status" -ne 0 ]]; then
  echo "Relay Console build failed with status \$build_status. Starting the previously installed build."
  /usr/bin/osascript -e 'display notification "Build failed, so Relay Console opened the previous installed build. See ~/Library/Logs/Relay Console/launcher.log." with title "Relay Console"' >/dev/null 2>&1 || true
  rm -f "\$LOCK_OWNER_FILE" >/dev/null 2>&1 || true
  rmdir "\$LOCK_DIR" >/dev/null 2>&1 || true
  LOCK_ACQUIRED=0
  cd /
  trap - EXIT
  exec "\$RUNTIME_EXECUTABLE"
fi

EXECUTABLE="\$ROOT_DIR/.build/\$CONFIGURATION/Relay Console"
if [[ ! -x "\$EXECUTABLE" ]]; then
  EXECUTABLE="\$(find "\$ROOT_DIR/.build" -path "*/\$CONFIGURATION/Relay Console" -type f -perm -111 | head -n 1)"
fi
BRIDGE_SOURCE="\$ROOT_DIR/.build/\$CONFIGURATION/$BRIDGE_NAME"
if [[ ! -x "\$BRIDGE_SOURCE" ]]; then
  BRIDGE_SOURCE="\$(find "\$ROOT_DIR/.build" -path "*/\$CONFIGURATION/$BRIDGE_NAME" -type f -perm -111 | head -n 1)"
fi

if [[ -z "\${EXECUTABLE:-}" || ! -x "\$EXECUTABLE" ]]; then
  echo "Could not find built Relay Console executable."
  exit 1
fi
if [[ -z "\${BRIDGE_SOURCE:-}" || ! -x "\$BRIDGE_SOURCE" ]]; then
  echo "Could not find built Relay Marketplace bridge executable."
  exit 1
fi

RESOURCE_BUNDLES="\$(find "\$ROOT_DIR/.build" -path "*/\$CONFIGURATION/\$RESOURCE_BUNDLE_GLOB" -type d | sort)"
if [[ -z "\${RESOURCE_BUNDLES:-}" ]]; then
  echo "Could not find Relay Console resource bundles."
  exit 1
fi

mkdir -p "\$MACOS_DIR" "\$RESOURCES_DIR"
cp "\$EXECUTABLE" "\$RUNTIME_EXECUTABLE.tmp.\$\$"
chmod +x "\$RUNTIME_EXECUTABLE.tmp.\$\$"
sign_local_executable "\$RUNTIME_EXECUTABLE.tmp.\$\$" "Relay Console"
mv "\$RUNTIME_EXECUTABLE.tmp.\$\$" "\$RUNTIME_EXECUTABLE"
cp "\$BRIDGE_SOURCE" "\$BRIDGE_EXECUTABLE.tmp.\$\$"
chmod +x "\$BRIDGE_EXECUTABLE.tmp.\$\$"
sign_local_executable "\$BRIDGE_EXECUTABLE.tmp.\$\$" "$BRIDGE_NAME"
mv "\$BRIDGE_EXECUTABLE.tmp.\$\$" "\$BRIDGE_EXECUTABLE"
find "\$APP_DIR" -maxdepth 1 -type d -name "\$RESOURCE_BUNDLE_GLOB" -exec rm -rf {} +
find "\$RESOURCES_DIR" -maxdepth 1 -type d -name "\$RESOURCE_BUNDLE_GLOB" -exec rm -rf {} +
while IFS= read -r RESOURCE_BUNDLE; do
  [[ -z "\$RESOURCE_BUNDLE" ]] && continue
  cp -R "\$RESOURCE_BUNDLE" "\$APP_DIR/"
  cp -R "\$RESOURCE_BUNDLE" "\$RESOURCES_DIR/"
done <<< "\$RESOURCE_BUNDLES"
rm -f "\$LOCK_OWNER_FILE" >/dev/null 2>&1 || true
rmdir "\$LOCK_DIR" >/dev/null 2>&1 || true
LOCK_ACQUIRED=0
trap - EXIT

echo "[\$(date)] Starting \$RUNTIME_EXECUTABLE"
exec "\$RUNTIME_EXECUTABLE"
LAUNCHER

  chmod +x "$launcher_path"
}

write_info_plist() {
  cat > "$CONTENTS_DIR/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Relay Console</string>
  <key>CFBundleExecutable</key>
  <string>$LAUNCHER_NAME</string>
  <key>CFBundleIconFile</key>
  <string>RelayConsole</string>
  <key>CFBundleIdentifier</key>
  <string>$RELEASE_BUNDLE_IDENTIFIER.development</string>
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
  <string>Relay Console</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$RELEASE_VERSION</string>
  <key>CFBundleVersion</key>
  <string>$RELEASE_BUILD</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.developer-tools</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSAppleMusicUsageDescription</key>
  <string>Relay Console asks for media-library access only when you choose to attach audio or video media from the composer.</string>
  <key>NSDesktopFolderUsageDescription</key>
  <string>Relay Console asks for Desktop access only to read files you select from Desktop or files used by this development build.</string>
  <key>NSDocumentsFolderUsageDescription</key>
  <string>Relay Console rebuilds from this project in Documents and reads files you explicitly select; this is app/file access, not a per-agent permission.</string>
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Relay Console asks for Photos access only when you choose to attach or upload an image from your photo library.</string>
</dict>
</plist>
PLIST

  if [[ -n "$POSTHOG_TOKEN" ]]; then
    /usr/bin/plutil -insert RelayPostHogProjectToken -string "$POSTHOG_TOKEN" "$CONTENTS_DIR/Info.plist"
    /usr/bin/plutil -insert RelayPostHogHost -string "$POSTHOG_HOST" "$CONTENTS_DIR/Info.plist"
  fi
  if [[ -n "$SENTRY_DSN" ]]; then
    /usr/bin/plutil -insert RelaySentryDSN -string "$SENTRY_DSN" "$CONTENTS_DIR/Info.plist"
  fi
  /usr/bin/plutil -insert RelayTelemetryEnvironment -string "$TELEMETRY_ENVIRONMENT" "$CONTENTS_DIR/Info.plist"
  /usr/bin/plutil -insert RelayConsoleRailwayOrigin -string "$RAILWAY_ORIGIN" "$CONTENTS_DIR/Info.plist"
  /usr/bin/plutil -insert RelayConsoleWebSocketBaseURL -string "$WEBSOCKET_ORIGIN" "$CONTENTS_DIR/Info.plist"
  /usr/bin/plutil -lint "$CONTENTS_DIR/Info.plist" >/dev/null
}

pin_to_dock() {
  if defaults read com.apple.dock persistent-apps 2>/dev/null | grep -F "$APP_DIR" >/dev/null; then
    echo "Relay Console is already in the Dock."
    return 0
  fi

  if command -v dockutil >/dev/null 2>&1; then
    dockutil --add "$APP_DIR" --no-restart >/dev/null
    killall Dock >/dev/null 2>&1 || true
    echo "Pinned Relay Console to the Dock."
    return 0
  fi

  defaults write com.apple.dock persistent-apps -array-add "{tile-data = {file-data = {_CFURLString = \"$APP_DIR\"; _CFURLStringType = 0;};}; tile-type = \"file-tile\";}"
  killall Dock >/dev/null 2>&1 || true
  echo "Pinned Relay Console to the Dock."
}

acquire_build_lock
quit_running_app

if [[ "$STALE_DIST_APP_DIR" != "$APP_DIR" && -d "$STALE_DIST_APP_DIR" ]]; then
  rm -rf "$STALE_DIST_APP_DIR"
fi

build_package

EXECUTABLE="$(find_built_executable)"
if [[ -z "${EXECUTABLE:-}" || ! -x "$EXECUTABLE" ]]; then
  echo "Could not find built Relay Console executable." >&2
  exit 1
fi
BRIDGE_EXECUTABLE="$(find_built_bridge)"
if [[ -z "${BRIDGE_EXECUTABLE:-}" || ! -x "$BRIDGE_EXECUTABLE" ]]; then
  echo "Could not find built Relay Marketplace bridge executable." >&2
  exit 1
fi

RESOURCE_BUNDLES="$(find_resource_bundles)"
if [[ -z "${RESOURCE_BUNDLES:-}" ]]; then
  echo "Could not find Relay Console resource bundles." >&2
  exit 1
fi

if [[ -e "$APP_DIR" && ! -d "$APP_DIR" ]]; then
  rm -f "$APP_DIR"
fi
mkdir -p "$APP_DIR"
rm -rf "$CONTENTS_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

cp "$EXECUTABLE" "$MACOS_DIR/$RUNTIME_NAME"
chmod +x "$MACOS_DIR/$RUNTIME_NAME"
sign_local_executable "$MACOS_DIR/$RUNTIME_NAME" "Relay Console"
cp "$BRIDGE_EXECUTABLE" "$MACOS_DIR/$BRIDGE_NAME"
chmod +x "$MACOS_DIR/$BRIDGE_NAME"
sign_local_executable "$MACOS_DIR/$BRIDGE_NAME" "$BRIDGE_NAME"
find "$APP_DIR" -maxdepth 1 -type d -name "$RESOURCE_BUNDLE_GLOB" -exec rm -rf {} +
find "$RESOURCES_DIR" -maxdepth 1 -type d -name "$RESOURCE_BUNDLE_GLOB" -exec rm -rf {} +
while IFS= read -r RESOURCE_BUNDLE; do
  [[ -z "$RESOURCE_BUNDLE" ]] && continue
  cp -R "$RESOURCE_BUNDLE" "$APP_DIR/"
  cp -R "$RESOURCE_BUNDLE" "$RESOURCES_DIR/"
done <<< "$RESOURCE_BUNDLES"
cp "$ROOT_DIR/Sources/RelayConsoleApp/Resources/Assets/AppIcon/icon.icns" "$RESOURCES_DIR/RelayConsole.icns"
write_launcher
write_info_plist

if command -v codesign >/dev/null 2>&1; then
  BUNDLE_SIGNING_IDENTITY="$(codesign_identity)"
  if [[ -z "$BUNDLE_SIGNING_IDENTITY" ]]; then
    BUNDLE_SIGNING_IDENTITY="-"
  fi
  codesign --force --deep --timestamp=none --identifier "$RELEASE_BUNDLE_IDENTIFIER.development" --sign "$BUNDLE_SIGNING_IDENTITY" "$APP_DIR" >/dev/null 2>&1 \
    || codesign --force --deep --sign - "$APP_DIR" >/dev/null 2>&1 \
    || true
fi

LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [[ -x "$LSREGISTER" ]]; then
  "$LSREGISTER" -f "$APP_DIR" >/dev/null 2>&1 || true
fi

touch "$APP_DIR"

if [[ "$PIN_DOCK" == "1" ]]; then
  pin_to_dock
fi

release_build_lock
trap - EXIT

if [[ "$OPEN_APP" == "1" ]]; then
  open "$APP_DIR"
  echo "Opened $APP_DIR"
else
  echo "Installed $APP_DIR"
fi

if [[ "$PIN_DOCK" != "1" ]]; then
  echo "For a permanent Dock icon, run: $0 --pin-dock"
fi
