import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const appRoot = resolve(
  root,
  "RelayConsoleSwift/Sources/RelayConsoleApp",
);

function swiftFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? swiftFiles(path)
      : entry.name.endsWith(".swift")
        ? [path]
        : [];
  });
}

function sourceLines(path) {
  return readFileSync(path, "utf8").split(/\r?\n/);
}

test("macOS state coordinator and extracted feature files stay bounded", () => {
  const coordinator = resolve(appRoot, "AppViewModel.swift");
  assert.ok(
    sourceLines(coordinator).length < 5_000,
    "AppViewModel.swift must remain below 5,000 lines",
  );

  const featureStateFiles = swiftFiles(resolve(appRoot, "Features")).filter(
    (path) => path.includes("AppViewModel+"),
  );
  assert.ok(featureStateFiles.length >= 20, "expected feature-owned state files");
  for (const path of featureStateFiles) {
    assert.ok(
      sourceLines(path).length < 2_000,
      `${relative(root, path)} must remain below 2,000 lines`,
    );
  }
});

test("feature stores own request loading and error transitions", () => {
  const store = readFileSync(
    resolve(appRoot, "FeatureOperationStore.swift"),
    "utf8",
  );
  for (const expected of [
    "@Published private(set) var activeRequest",
    "@Published private(set) var loading",
    "@Published private(set) var error",
    "func begin(",
    "func finish()",
    "func fail(",
    "func beginRefresh()",
    "func finishRefresh()",
  ]) {
    assert.ok(store.includes(expected), `feature store is missing ${expected}`);
  }

  const chatActions = readFileSync(
    resolve(appRoot, "Features/Chats/AppViewModel+Chats.swift"),
    "utf8",
  );
  for (const expected of [
    "featureStore.begin(label)",
    "featureStore.finish()",
    "featureStore.fail(message)",
    "return applicationsFeatureStore",
    "return approvalsFeatureStore",
    "return insightsFeatureStore",
    "return settingsFeatureStore",
    "return agentFeatureStore",
    "return chatFeatureStore",
  ]) {
    assert.ok(
      chatActions.includes(expected),
      `feature action routing is missing ${expected}`,
    );
  }
});

test("full and Applications refreshes publish feature loading state", () => {
  const fullRefresh = readFileSync(
    resolve(appRoot, "Features/Shell/AppViewModel+Coordination.swift"),
    "utf8",
  );
  const applicationsRefresh = readFileSync(
    resolve(
      appRoot,
      "Features/Applications/AppViewModel+ApplicationRefresh.swift",
    ),
    "utf8",
  );

  assert.ok(fullRefresh.includes("featureStores.forEach { $0.beginRefresh() }"));
  assert.ok(fullRefresh.includes("featureStores.forEach { $0.finishRefresh() }"));
  assert.ok(fullRefresh.includes("featureStores.forEach { $0.fail(message) }"));
  assert.ok(
    applicationsRefresh.includes("applicationsFeatureStore.beginRefresh()"),
  );
  assert.ok(
    applicationsRefresh.includes("applicationsFeatureStore.finishRefresh()"),
  );
  assert.ok(
    applicationsRefresh.includes("applicationsFeatureStore.fail(message)"),
  );
});
