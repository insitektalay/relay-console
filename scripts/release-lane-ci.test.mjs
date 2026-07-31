import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const workflowRoot = resolve(root, ".github/workflows");
const workflowSources = readdirSync(workflowRoot)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .map((name) => ({
    name,
    source: readFileSync(resolve(workflowRoot, name), "utf8"),
  }));

test("repository workflows remain verification-only", () => {
  const deploymentAuthority =
    /\b(?:railway\s+up|railway\s+deploy|vercel\s+deploy|RAILWAY_TOKEN|VERCEL_TOKEN)\b/i;

  for (const workflow of workflowSources) {
    assert.doesNotMatch(
      workflow.source,
      deploymentAuthority,
      `${workflow.name} must not gain production deployment authority`,
    );
  }
});

test("backend and web readiness run for release branches", () => {
  for (const name of [
    "apple-beta-readiness.yml",
    "backend-beta-readiness.yml",
    "web-beta-readiness.yml",
  ]) {
    const source = readFileSync(resolve(workflowRoot, name), "utf8");
    assert.match(source, /push:[\s\S]*?branches:[\s\S]*?release\/\*\*/);
  }
});

test("Apple readiness is headless and never targets a Simulator", () => {
  const source = readFileSync(
    resolve(workflowRoot, "apple-beta-readiness.yml"),
    "utf8",
  );

  for (const command of [
    "test:ios-marketplace-oauth-return",
    "test:apple-distribution-evidence",
    "test:app-store-release-evidence",
    "test:macos-publication-evidence",
    "test:ios-marketplace-oauth-return-host",
    "test:ios-telemetry-privacy",
    "test:ios-account-export",
    "test:native-session-identity",
    "test:client-version-contract",
    "RelayConsoleDataLifecycleTests",
    "RelayConsoleMigrationTests",
    "RelayConsoleReleaseBundleTests",
    "Relay Cloud account export is authenticated unwrapped and owner only",
    "Relay Cloud account deletion requires password exact confirmation and bearer authentication",
    "Relay Cloud session security uses canonical authenticated logout and revocation routes",
    "RelayConsoleReleaseAcceptancePreparationTests",
  ]) {
    assert.match(source, new RegExp(command));
  }
  assert.match(source, /runs-on: macos-15/);
  assert.match(source, /-destination 'generic\/platform=iOS'/);
  assert.match(source, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(source, /build-for-testing/);
  assert.doesNotMatch(source, /iOS Simulator|simctl|xcodebuild\s+test|open\s+-a/i);
});

test("superseded Free Local release authority remains outside active tooling", () => {
  const packageScripts = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8"),
  ).scripts;
  const appleWorkflow = readFileSync(
    resolve(workflowRoot, "apple-beta-readiness.yml"),
    "utf8",
  );
  const distributionBuilder = readFileSync(
    resolve(root, "RelayConsoleSwift/Scripts/build-distribution.sh"),
    "utf8",
  );

  for (const command of [
    "release:free-local:candidate",
    "test:release-free-local",
    "release:free-local:gate",
  ]) {
    assert.equal(packageScripts[command], undefined);
    assert.doesNotMatch(appleWorkflow, new RegExp(command.replaceAll(":", "\\:")));
  }

  assert.doesNotMatch(
    distributionBuilder,
    /free-local-release-candidate|relay\.free-local-release-candidate|free-local-release-candidate\.mjs/,
  );
  assert.match(distributionBuilder, /release-candidate-manifest\.json/);
  assert.match(distributionBuilder, /relay\.release-candidate\.v1/);
});

test("backend CI enforces the release contract suites", () => {
  const source = readFileSync(
    resolve(workflowRoot, "backend-beta-readiness.yml"),
    "utf8",
  );

  for (const command of [
    "marketplace:validate",
    "marketplace:release-manifest:check",
    "marketplace:provider-acceptance",
    "test:marketplace-release-manifest",
    "test:marketplace-provider-acceptance",
    "test:marketplace-release-gate",
    "test:marketplace-freeze-source-audit",
    "test:release-candidate",
    "test:release-freeze",
    "test:apple-distribution-evidence",
    "test:client-version-contract",
    "test:railway-release-topology",
    "test:railway-release-configuration",
    "test:release-remote-evidence",
    "test:public-launch-surface-gate",
    "test:production-smoke-evidence",
    "test:failure-recovery-gate",
    "test:failure-recovery-evidence",
    "test:billing-release-evidence",
    "test:launch-governance-evidence",
    "test:app-store-release-evidence",
    "test:macos-publication-evidence",
    "test:launch-journey-evidence",
    "test:production-checklist-evidence",
    "verify:failure-recovery",
    "test:release-lane",
    "test:launch-product-contract",
    "test:product-contract-terminology",
  ]) {
    assert.match(
      source,
      new RegExp(`pnpm run ${command.replaceAll(":", "\\:")}`),
    );
  }
});
