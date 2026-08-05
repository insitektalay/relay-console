#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_ROOT="$(cd "$ROOT_DIR/.." && pwd)"
WORKFLOW="$REPOSITORY_ROOT/.github/workflows/macos-sparkle-release.yml"
APPCAST_URL="https://insitektalay.github.io/relay-console/appcast.xml"

grep -q '"identity" : "sparkle"' "$ROOT_DIR/Package.resolved"
grep -q '"version" : "2.9.4"' "$ROOT_DIR/Package.resolved"
grep -q 'exact: "2.9.4"' "$ROOT_DIR/Package.swift"
grep -q "$APPCAST_URL" "$ROOT_DIR/Scripts/build-release-app.sh"
grep -q 'RELAY_SPARKLE_PUBLIC_ED_KEY must contain' "$ROOT_DIR/Scripts/build-release-app.sh"
grep -q 'SURequireSignedFeed' "$ROOT_DIR/Scripts/build-release-app.sh"
grep -q 'SPARKLE_FRAMEWORK/Versions/B/Autoupdate' "$ROOT_DIR/Scripts/build-distribution.sh"
grep -q 'SPARKLE_FRAMEWORK/Versions/B/Updater.app' "$ROOT_DIR/Scripts/build-distribution.sh"
grep -q 'Sparkle framework rpath missing' "$ROOT_DIR/Scripts/validate-release-app.sh"
grep -q 'workflow_dispatch:' "$WORKFLOW"
! grep -Eq '^[[:space:]]+(pull_request|push):' "$WORKFLOW"
grep -q 'Publish appcast last' "$WORKFLOW"
grep -q 'insitektalay/relay-console' "$WORKFLOW"
! grep -q 'insitektalay/clawchat' "$WORKFLOW"
grep -q 'releases/download/\${RELEASE_TAG}/' "$WORKFLOW"
grep -q 'RelayConsoleSwift/.build/release-arm64/artifacts/sparkle/Sparkle/bin/generate_appcast' "$WORKFLOW"
! grep -q 'RelayConsoleSwift/.build/artifacts/sparkle/Sparkle/bin/generate_appcast' "$WORKFLOW"
grep -q -- '-o "\$UPDATES/appcast.xml" "\$UPDATES"' "$WORKFLOW"
grep -q -- '--ed-key-file -' "$WORKFLOW"
grep -q 'RELAY_REQUIRE_PRODUCTION_TELEMETRY' "$WORKFLOW"
grep -q 'RELAY_CONSOLE_PUBLIC_TAG_RELEASE' "$WORKFLOW"
grep -q 'RELAY_CONSOLE_RELEASE_SOURCE_COMMIT' "$WORKFLOW"
grep -q 'relay:backendCommit' "$WORKFLOW"
grep -q 'sign_update' "$WORKFLOW"
grep -q 'RELAY_CONSOLE_PUBLIC_TAG_RELEASE' "$ROOT_DIR/Scripts/build-distribution.sh"
grep -q 'RELAY_POSTHOG_PROJECT_TOKEN.*vars.RELAY_POSTHOG_PROJECT_TOKEN' "$WORKFLOW"
grep -q 'RELAY_SENTRY_DSN.*vars.RELAY_SENTRY_DSN' "$WORKFLOW"
grep -q 'SENTRY_AUTH_TOKEN.*secrets.SENTRY_AUTH_TOKEN' "$WORKFLOW"
grep -q '@sentry/cli@2.58.6' "$WORKFLOW"
grep -q 'git checkout --orphan gh-pages' "$WORKFLOW"
grep -q 'uses: actions/checkout@[0-9a-f]\{40\}' "$WORKFLOW"
grep -q 'uses: actions/upload-artifact@[0-9a-f]\{40\}' "$WORKFLOW"

if git -C "$REPOSITORY_ROOT" grep -IEn '(SPARKLE_EDDSA_PRIVATE_KEY|APPLE_NOTARY_PRIVATE_KEY)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9+/]{40,}' -- ':!RelayConsoleSwift/Scripts/validate-sparkle-release.sh'; then
  echo "A release private key appears to be committed" >&2
  exit 1
fi

for document in \
  "$ROOT_DIR/Release/macos-update-manifest.schema.json" \
  "$ROOT_DIR/Release/public-beta-update-manifest.schema.json" \
  "$ROOT_DIR/Release/macos-distribution-evidence.schema.json" \
  "$ROOT_DIR/Release/macos-swiftpm-dependency-inventory.json"
do
  jq empty "$document"
done

echo "Sparkle release configuration validation passed"
