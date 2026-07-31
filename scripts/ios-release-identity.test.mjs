import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const project = read("ios/project.yml");
const infoPlist = read("ios/ClawChat/App/Info.plist");
const runtimeConfig = read("ios/ClawChat/App/AppRuntimeConfig.swift");
const deploymentOriginPolicy = read(
  "ios/ClawChat/App/RelayDeploymentOriginPolicy.swift",
);
const tokenStore = read("ios/ClawChat/Infrastructure/Security/AuthTokenStore.swift");
const telemetry = read("ios/ClawChat/Shared/Telemetry/Telemetry.swift");
const uiTests = read("ios/ClawChatUITests/ClawChatUITests.swift");

test("the shipping iOS artifact uses the Relay Console identity", () => {
  assert.match(project, /bundleIdPrefix:\s+com\.relayconsole/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER:\s+com\.relayconsole\.app/);
  assert.match(project, /PRODUCT_NAME:\s+["']Relay Console["']/);
  assert.match(project, /PRODUCT_MODULE_NAME:\s+ClawChat/);
  assert.match(infoPlist, /<key>CFBundleDisplayName<\/key>\s*<string>Relay Console<\/string>/);
  assert.match(runtimeConfig, /Bundle\.main\.bundleIdentifier \?\? "com\.relayconsole\.app"/);
  assert.match(uiTests, /XCUIApplication\(bundleIdentifier: "com\.relayconsole\.app"\)/);
});

test("all shipping backend origins use Relay's canonical Railway-backed domains", () => {
  for (const source of [project, infoPlist, deploymentOriginPolicy]) {
    assert.match(source, /https:\/\/api\.relayconsole\.work\/api\/v1/);
    assert.match(source, /wss:\/\/api\.relayconsole\.work/);
    assert.match(source, /https:\/\/relayconsole\.work/);
  }
  for (const source of [project, infoPlist, runtimeConfig, deploymentOriginPolicy]) {
    assert.doesNotMatch(source, /https?:\/\/[^\s"']+\.up\.railway\.app/i);
    assert.doesNotMatch(source, /wss?:\/\/[^\s"']+\.up\.railway\.app/i);
  }
  assert.match(runtimeConfig, /RelayDeploymentOriginPolicy\.production/);
  assert.match(runtimeConfig, /RelayDeploymentOriginPolicy\.validate/);
});

test("shipping runtime configuration keys no longer expose the ClawChat brand", () => {
  for (const key of [
    "RelayConsoleAPIBaseURL",
    "RelayConsoleWebAssetBaseURL",
    "RelayConsoleWebSocketBaseURL",
  ]) {
    assert.match(project, new RegExp(`${key}:`));
    assert.match(infoPlist, new RegExp(`<key>${key}</key>`));
    assert.match(
      runtimeConfig,
      new RegExp(`object\\(forInfoDictionaryKey: "${key}"\\)`),
    );
  }

  for (const source of [project, infoPlist, runtimeConfig]) {
    assert.doesNotMatch(source, /ClawChat(?:APIBaseURL|WebAssetBaseURL|WebSocketBaseURL)/);
  }
});

test("secure storage and telemetry use Relay Console while retaining an explicit one-way legacy migration", () => {
  assert.match(tokenStore, /private static let service = "com\.relayconsole\.app\.auth"/);
  assert.match(tokenStore, /private static let legacyService = "com\.clawchat\.app\.auth"/);
  assert.match(tokenStore, /migrated_from_legacy_keychain/);
  assert.match(telemetry, /Logger\(subsystem: "com\.relayconsole\.app"/);
});
