import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

function policyMinimum(policy, clientKind) {
  const match = policy.match(new RegExp(`${clientKind}: "([0-9]+\\.[0-9]+\\.[0-9]+)"`));
  assert.ok(match, `missing Railway minimum for ${clientKind}`);
  return match[1];
}

test("actual launch artifacts satisfy Railway minimum client versions", () => {
  const mac = JSON.parse(read(
    "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/relay-console-release.json",
  ));
  const web = JSON.parse(read("web/package.json"));
  const iosProject = read("ios/project.yml");
  const policy = read(
    "backend/src/modules/cloud-commercial/client-compatibility-policy.ts",
  );

  assert.ok(compareVersions(mac.version, policyMinimum(policy, "relayConsoleSwift")) >= 0);
  assert.ok(compareVersions(web.version, policyMinimum(policy, "web")) >= 0);
  assert.match(iosProject, /CFBundleShortVersionString: "1\.0"/);
  assert.match(policy, /ios: "1\.0\.0"/);
});

test("Mac and Railway both fail closed below the advertised minimum", () => {
  const macContract = read(
    "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift",
  );
  const macSettings = read(
    "RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift",
  );
  const relaySync = read("backend/src/modules/relay-sync/relay-sync.service.ts");

  for (const value of [
    "manifest.minimumClients[clientKind]",
    "RelayConsoleReleaseMetadata.current.version",
    "Update Relay Console before connecting",
  ]) {
    assert.ok(macContract.includes(value), `Mac compatibility contract is missing ${value}`);
  }
  assert.match(
    macSettings,
    /let decoded = try JSONDecoder\(\)\.decode[\s\S]*?saveDeployment\(manifest: decoded\)[\s\S]*?validAccessToken/,
  );
  assert.match(
    relaySync,
    /evaluateRelayClientVersion\(\s*input\.clientKind,\s*input\.clientVersion,?\s*\)/,
  );
  assert.match(relaySync, /throw new ConflictException\(compatibility\.code\)/);
});

test("backend candidate advertises the dependency-bound bridge preview", () => {
  const backend = JSON.parse(read(
    "backend/src/modules/bridge/bridge-compatibility-manifest.json",
  ));
  const backendPackage = JSON.parse(read("backend/package.json"));

  assert.equal(backend.releaseStatus, "preview");
  assert.deepEqual(backend.supportedBackend, {
    version: backendPackage.version,
    commit: null,
    origin: "https://api.relayconsole.work",
  });
  assert.equal(
    backend.plugins.find((plugin) => plugin.id === "hermes-agent-bridge")
      ?.runtimeDependencies?.python?.aiohttp,
    ">=3.10,<4",
  );
});
