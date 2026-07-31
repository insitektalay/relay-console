#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_ROOT="$(cd "$ROOT_DIR/.." && pwd)"
OUTPUT_ROOT="${RELAY_CONSOLE_FREE_LOCAL_GATE_OUTPUT:-$ROOT_DIR/.build/free-local-gate}"

run_swift() {
  swift run --package-path "$ROOT_DIR" "$@"
}

cd "$REPOSITORY_ROOT"
pnpm run test:release-free-local
pnpm run test:client-version-contract
pnpm run test:apple-distribution-evidence
pnpm run test:macos-publication-evidence
pnpm run test:release-lane
pnpm --dir "Relay Console landing page" run test:policy-content
pnpm --dir "Relay Console landing page" run typecheck
pnpm --dir "Relay Console landing page" run lint
pnpm --dir "Relay Console landing page" run build

cd "$ROOT_DIR"
run_swift RelayConsoleCoreSmokeTests
run_swift RelayConsoleMigrationTests
run_swift RelayConsoleModelContractTests
for service_test in \
  "Free Local persists conversations agents settings and runtime state without cloud" \
  "Free Local remains writable after Relay Cloud becomes unavailable" \
  "chat thread state creates active sessions and durable wrap-up references" \
  "chat history pages newest messages with stable bidirectional cursors" \
  "chat service denies invalid access without side effects" \
  "agent identity preferences are durable and separate from runtime identity" \
  "agent deletion purges chats runtime and managed workspace" \
  "OpenClaw dispatch runs CLI from harness install path" \
  "OpenClaw gateway remains user-managed on launch and keepalive" \
  "OpenClaw health reports a stopped user-managed gateway without starting it" \
  "Hermes scheduler isolates service test LaunchAgents" \
  "runtime workspace service manages roots files links and baselines" \
  "controlled action service gates writes and records dry-run evidence" \
  "runtime action runs are idempotent read-only and retained"; do
  run_swift RelayConsoleServiceTests "$service_test"
done
run_swift RelayConsoleProfileSettingsTests
run_swift RelayConsoleSourceHygieneTests
run_swift RelayConsoleShellNavigationTests
run_swift RelayConsoleComponentBaselineTests
run_swift RelayConsoleEventReplayTests
run_swift RelayConsoleVisualEvidenceTests
run_swift RelayConsoleAppUpdateTests
run_swift RelayConsoleHarnessLifecycleTests
run_swift RelayConsoleApplicationsBetaTests
run_swift RelayConsoleOAuthReleaseTests
run_swift RelayConsoleModelSelectionTests
run_swift RelayConsoleAttributionTests
run_swift RelayConsoleDataLifecycleTests
run_swift RelayConsoleLocalSecurityTests
run_swift RelayConsoleAccessibilityReleaseTests
run_swift RelayConsoleTelemetryReleaseTests
run_swift RelayConsoleReleaseAcceptancePreparationTests

"$ROOT_DIR/Scripts/build-distribution.sh" --dry-run --architecture arm64 --output "$OUTPUT_ROOT/distribution"

echo "Free Local source, release-tool, website, Swift, bundle, and dry-run distribution gates passed"
echo "$OUTPUT_ROOT/distribution/RelayConsole-public-beta-manifest.json"
