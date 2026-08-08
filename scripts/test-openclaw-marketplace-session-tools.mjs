import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const installerPath = path.join(
  repositoryRoot,
  "RelayConsoleSwift/Sources/RelayConsoleCore/MarketplaceRuntimeHarnessBridgeInstaller.swift",
);
const source = fs.readFileSync(installerPath, "utf8");
const match = source.match(
  /private let openClawMarketplaceRuntimeToolPluginSource = #"""\n([\s\S]*?)\n"""#/,
);
assert.ok(match, "OpenClaw Marketplace plugin source was not found");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "relay-openclaw-tools-"));
try {
  const snapshots = path.join(root, "snapshots");
  fs.mkdirSync(snapshots);
  const jotformPath = path.join(snapshots, "jotform.json");
  const exaPath = path.join(snapshots, "exa.json");
  const descriptor = (toolName) => ({
    toolName,
    displayName: toolName,
    summary: `${toolName} test tool`,
    inputSchema: { type: "object", properties: {} },
  });
  fs.writeFileSync(
    jotformPath,
    JSON.stringify({
      runtimeType: "openclaw",
      apps: [{ tools: [descriptor("jotform_read")] }],
    }),
  );
  fs.writeFileSync(
    exaPath,
    JSON.stringify({
      runtimeType: "openclaw",
      apps: [{ tools: [descriptor("exa_search")] }],
    }),
  );
  const contextPath = path.join(root, "contexts.json");
  fs.writeFileSync(
    contextPath,
    JSON.stringify({
      contexts: {
        "agent:luca": { RELAY_MARKETPLACE_RUNTIME_SNAPSHOT_PATH: jotformPath },
        "agent:omar": { RELAY_MARKETPLACE_RUNTIME_SNAPSHOT_PATH: exaPath },
      },
    }),
  );

  const registrations = new Map();
  const sandbox = {
    module: { exports: {} },
    exports: {},
    process: { env: {} },
    require(specifier) {
      if (specifier === "node:fs") return fs;
      if (specifier === "node:child_process") {
        return { spawnSync: () => ({ status: 0, stdout: "{}", stderr: "" }) };
      }
      throw new Error(`Unexpected module: ${specifier}`);
    },
  };
  vm.runInNewContext(match[1], sandbox, {
    filename: "relay-marketplace-plugin.js",
  });
  sandbox.module.exports.register({
    pluginConfig: {
      snapshotDirectory: snapshots,
      catalogVersion: "test",
      bridgeEnvironment: {
        RELAY_MARKETPLACE_RUNTIME_CONTEXT_PATH: contextPath,
      },
    },
    registerTool(factory, options) {
      registrations.set(options.name, factory);
    },
  });

  assert.deepEqual([...registrations.keys()].sort(), [
    "exa_search",
    "jotform_read",
  ]);
  assert.ok(registrations.get("jotform_read")({ sessionKey: "agent:luca" }));
  assert.equal(
    registrations.get("exa_search")({ sessionKey: "agent:luca" }),
    null,
  );
  assert.ok(registrations.get("exa_search")({ sessionKey: "agent:omar" }));
  assert.equal(
    registrations.get("jotform_read")({ sessionKey: "agent:omar" }),
    null,
  );
  console.log("OpenClaw Marketplace tools are isolated per dispatch session.");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
