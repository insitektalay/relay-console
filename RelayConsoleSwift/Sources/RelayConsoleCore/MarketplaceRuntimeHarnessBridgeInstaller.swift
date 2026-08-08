import Foundation

public struct MarketplaceRuntimeBridgeCommandSpec: Sendable {
    var command: String
    var args: [String]
}

public struct MarketplaceRuntimeBridgeInstallResult: Sendable {
    public var env: [String: String]
    public var registeredToolNames: Set<String>
    public var requiresHarnessRefresh: Bool
}

extension HarnessInstallManager {
    public func prepareMarketplaceRuntimeToolBridge(
        for agent: AgentWithBinding,
        request: RuntimeDispatchRequest,
        harnessPath: URL,
        mount: MarketplaceRuntimeCapabilitySnapshot
    ) throws -> MarketplaceRuntimeBridgeInstallResult {
        let snapshotPath = try writeMarketplaceRuntimeSnapshot(mount)
        let command = marketplaceRuntimeBridgeCommandSpec()
        let brokerTokenPath = try MarketplaceRuntimeBrokerEndpoint.ensureTokenFile(forRoot: paths.root)
        let openClawContextPath = paths.root
            .appendingPathComponent("marketplace-runtime", isDirectory: true)
            .appendingPathComponent("openclaw-dispatch-contexts.json")
        let env: [String: String] = [
            RelayConsoleServices.temporaryUserDataPathEnvironmentKey: paths.root.path,
            "RELAY_MARKETPLACE_RUNTIME_SNAPSHOT_PATH": snapshotPath.path,
            MarketplaceRuntimeBrokerEndpoint.socketPathEnvironmentKey: MarketplaceRuntimeBrokerEndpoint.socketPath(forRoot: paths.root),
            MarketplaceRuntimeBrokerEndpoint.tokenPathEnvironmentKey: brokerTokenPath.path,
            "RELAY_MARKETPLACE_TOOL_BRIDGE_COMMAND": command.command,
            "RELAY_MARKETPLACE_TOOL_BRIDGE_ARGS_JSON": encodeJSONString(command.args) ?? "[]",
            "RELAY_MARKETPLACE_AGENT_ID": agent.id,
            "RELAY_MARKETPLACE_WORKSPACE_ID": agent.workspaceId,
            "RELAY_MARKETPLACE_RUNTIME_TYPE": agent.binding.runtimeType.rawValue,
            "RELAY_MARKETPLACE_DISPATCH_ID": request.dispatchId,
            "RELAY_MARKETPLACE_THREAD_ID": request.threadId,
            "RELAY_MARKETPLACE_RUNTIME_SESSION_ID": request.sessionId,
            "RELAY_MARKETPLACE_CORRELATION_ID": request.correlationId,
            "RELAY_MARKETPLACE_RUNTIME_CONTEXT_PATH": openClawContextPath.path,
            "RELAY_MARKETPLACE_RAW_PROVIDER_TOOL_EXPOSURE": "false"
        ]

        let registeredToolNames: Set<String>
        var requiresHarnessRefresh = false
        switch agent.binding.runtimeType {
        case .hermes:
            try writeHermesMarketplaceRuntimeToolModule(harnessPath: harnessPath)
            registeredToolNames = Set(mount.mountedToolNames)
        case .openclaw:
            let slug = agent.binding.externalAgentId ?? openClawSlug(for: agent)
            let sessionKey = openClawSessionKey(
                slug: slug,
                threadId: request.threadId,
                mount: mount
            )
            try writeOpenClawDispatchContext(
                sessionKey: sessionKey,
                environment: env,
                to: openClawContextPath
            )
            let snapshotDirectory = snapshotPath.deletingLastPathComponent()
            let catalog = try openClawMarketplaceToolCatalog(
                snapshotDirectory: snapshotDirectory,
                including: mount
            )
            let pluginDir = try writeOpenClawMarketplaceRuntimeToolPlugin(
                toolNames: catalog.toolNames
            )
            requiresHarnessRefresh = try ensureOpenClawMarketplacePluginEnabled(
                pluginDir: pluginDir,
                runtimeConfig: openClawMarketplacePluginRuntimeConfig(
                    snapshotDirectory: snapshotDirectory,
                    catalogVersion: catalog.version,
                    command: command,
                    environment: env
                )
            )
            registeredToolNames = Set(mount.mountedToolNames)
        default:
            registeredToolNames = []
            break
        }
        return MarketplaceRuntimeBridgeInstallResult(
            env: env,
            registeredToolNames: registeredToolNames,
            requiresHarnessRefresh: requiresHarnessRefresh
        )
    }

    private func writeOpenClawDispatchContext(
        sessionKey: String,
        environment: [String: String],
        to url: URL
    ) throws {
        openClawMarketplaceContextLock.lock()
        defer { openClawMarketplaceContextLock.unlock() }
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        var root = parseJSONObject(
            from: (try? String(contentsOf: url, encoding: .utf8)) ?? ""
        ) ?? [:]
        var contexts = objectValue(root["contexts"]) ?? [:]
        contexts[sessionKey] = .object(
            environment.reduce(into: JSONRecord()) { record, pair in
                record[pair.key] = .string(pair.value)
            }
        )
        root["contexts"] = .object(contexts)
        root["updatedAt"] = .string(nowIso())
        try (encodeJSONRecord(root) + "\n").write(to: url, atomically: true, encoding: .utf8)
    }

    private func writeMarketplaceRuntimeSnapshot(_ mount: MarketplaceRuntimeCapabilitySnapshot) throws -> URL {
        let directory = paths.root
            .appendingPathComponent("marketplace-runtime", isDirectory: true)
            .appendingPathComponent("snapshots", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let fingerprint = mount.fingerprint.replacingOccurrences(of: "sha256:", with: "")
        let filename = [
            RelayProviderWrapperToolCompilerService.safeIdentifierComponent(mount.runtimeType.rawValue),
            RelayProviderWrapperToolCompilerService.safeIdentifierComponent(mount.agentId),
            String(fingerprint.prefix(16))
        ].joined(separator: "-") + ".json"
        let url = directory.appendingPathComponent(filename)
        let data = try jsonEncoder.encode(mount)
        try data.write(to: url, options: [.atomic])
        return url
    }

    private func writeHermesMarketplaceRuntimeToolModule(harnessPath: URL) throws {
        let toolsDir = harnessPath.appendingPathComponent("tools", isDirectory: true)
        try FileManager.default.createDirectory(at: toolsDir, withIntermediateDirectories: true)
        let modulePath = toolsDir.appendingPathComponent("relay_marketplace_tools.py")
        try hermesMarketplaceRuntimeToolModuleSource.write(to: modulePath, atomically: true, encoding: .utf8)
    }

    private func openClawMarketplaceToolCatalog(
        snapshotDirectory: URL,
        including current: MarketplaceRuntimeCapabilitySnapshot
    ) throws -> (toolNames: [String], version: String) {
        var snapshots = [current]
        let urls = (try? FileManager.default.contentsOfDirectory(
            at: snapshotDirectory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        )) ?? []
        for url in urls where url.pathExtension == "json" {
            guard let data = try? Data(contentsOf: url),
                  let snapshot = try? jsonDecoder.decode(
                    MarketplaceRuntimeCapabilitySnapshot.self,
                    from: data
                  ),
                  snapshot.runtimeType == .openclaw
            else { continue }
            snapshots.append(snapshot)
        }
        let names = Array(Set(snapshots.flatMap(\.mountedToolNames))).sorted()
        let fingerprints = Array(Set(snapshots.map(\.fingerprint))).sorted()
        let version = RelayProviderWrapperToolCompilerService.stableSuffix(
            (names + fingerprints).joined(separator: "|")
        )
        return (names, version)
    }

    private func writeOpenClawMarketplaceRuntimeToolPlugin(toolNames: [String]) throws -> URL {
        let pluginDir = paths.root
            .appendingPathComponent("marketplace-runtime", isDirectory: true)
            .appendingPathComponent("openclaw-relay-marketplace-plugin", isDirectory: true)
        try FileManager.default.createDirectory(at: pluginDir, withIntermediateDirectories: true)
        let toolContracts = toolNames.map(JSONValue.string)
        let manifest: JSONRecord = [
            "id": .string("relay-marketplace"),
            "name": .string("Relay Marketplace"),
            "description": .string("Policy-scoped Relay Marketplace provider wrapper tools."),
            "enabledByDefault": .bool(true),
            "configSchema": .object([
                "type": .string("object"),
                "additionalProperties": .bool(false),
                "properties": .object([
                    "snapshotDirectory": .object([
                        "type": .string("string")
                    ]),
                    "catalogVersion": .object([
                        "type": .string("string")
                    ]),
                    "bridgeCommand": .object([
                        "type": .string("string")
                    ]),
                    "bridgeArgs": .object([
                        "type": .string("array"),
                        "items": .object(["type": .string("string")])
                    ]),
                    "bridgeEnvironment": .object([
                        "type": .string("object"),
                        "additionalProperties": .object(["type": .string("string")])
                    ])
                ])
            ]),
            "contracts": .object([
                "tools": .array(toolContracts)
            ])
        ]
        try (encodeJSONRecord(manifest) + "\n").write(
            to: pluginDir.appendingPathComponent("openclaw.plugin.json"),
            atomically: true,
            encoding: .utf8
        )
        try openClawMarketplaceRuntimeToolPluginSource.write(
            to: pluginDir.appendingPathComponent("index.js"),
            atomically: true,
            encoding: .utf8
        )
        return pluginDir
    }

    private func ensureOpenClawMarketplacePluginEnabled(pluginDir: URL, runtimeConfig: JSONRecord) throws -> Bool {
        let configPath = openClawConfigPath()
        var config = parseJSONObject(from: (try? String(contentsOf: configPath, encoding: .utf8)) ?? "") ?? [:]
        let originalConfig = config
        var plugins = objectValue(config["plugins"]) ?? [:]
        var load = objectValue(plugins["load"]) ?? [:]
        var pathsArray = arrayValue(load["paths"])
        appendUniqueString(pluginDir.path, to: &pathsArray)
        load["paths"] = .array(pathsArray)
        plugins["load"] = .object(load)

        var entries = objectValue(plugins["entries"]) ?? [:]
        let enabledPluginIDsToPreserve = plugins["allow"] == nil
            ? entries.keys.sorted().filter { pluginID in
                guard case .object(let entry)? = entries[pluginID] else { return false }
                return boolValue(entry["enabled"]) == true
            }
            : []
        entries["relay-marketplace"] = .object([
            "enabled": .bool(true),
            "config": .object(runtimeConfig)
        ])
        plugins["entries"] = .object(entries)

        var allow = arrayValue(plugins["allow"])
        for pluginID in enabledPluginIDsToPreserve {
            appendUniqueString(pluginID, to: &allow)
        }
        appendUniqueString("relay-marketplace", to: &allow)
        plugins["allow"] = .array(allow)

        config["plugins"] = .object(plugins)
        try FileManager.default.createDirectory(at: configPath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try (encodeJSONRecord(config) + "\n").write(to: configPath, atomically: true, encoding: .utf8)
        return config != originalConfig
    }

    private func appendUniqueString(_ value: String, to array: inout [JSONValue]) {
        guard !array.contains(.string(value)) else { return }
        array.append(.string(value))
    }

    private func openClawMarketplacePluginRuntimeConfig(
        snapshotDirectory: URL,
        catalogVersion: String,
        command: MarketplaceRuntimeBridgeCommandSpec,
        environment: [String: String]
    ) -> JSONRecord {
        let persistentEnvironmentKeys = Set([
            RelayConsoleServices.temporaryUserDataPathEnvironmentKey,
            MarketplaceRuntimeBrokerEndpoint.socketPathEnvironmentKey,
            MarketplaceRuntimeBrokerEndpoint.tokenPathEnvironmentKey,
            "RELAY_MARKETPLACE_AGENT_ID",
            "RELAY_MARKETPLACE_WORKSPACE_ID",
            "RELAY_MARKETPLACE_RUNTIME_TYPE",
            "RELAY_MARKETPLACE_RUNTIME_CONTEXT_PATH",
            "RELAY_MARKETPLACE_RAW_PROVIDER_TOOL_EXPOSURE"
        ])
        let persistentEnvironment = environment
            .filter { persistentEnvironmentKeys.contains($0.key) }
            .reduce(into: JSONRecord()) { partial, pair in
                partial[pair.key] = .string(pair.value)
            }
        return [
            "snapshotDirectory": .string(snapshotDirectory.path),
            "catalogVersion": .string(catalogVersion),
            "bridgeCommand": .string(command.command),
            "bridgeArgs": .array(command.args.map(JSONValue.string)),
            "bridgeEnvironment": .object(persistentEnvironment)
        ]
    }

    private func marketplaceRuntimeBridgeCommandSpec() -> MarketplaceRuntimeBridgeCommandSpec {
        if let explicit = ProcessInfo.processInfo.environment["RELAY_MARKETPLACE_TOOL_BRIDGE_PATH"]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !explicit.isEmpty {
            return MarketplaceRuntimeBridgeCommandSpec(command: explicit, args: [])
        }
        if let executable = Bundle.main.executableURL {
            let sibling = executable.deletingLastPathComponent().appendingPathComponent("RelayMarketplaceToolBridge")
            if FileManager.default.isExecutableFile(atPath: sibling.path) {
                return MarketplaceRuntimeBridgeCommandSpec(command: sibling.path, args: [])
            }
        }
        return MarketplaceRuntimeBridgeCommandSpec(
            command: "/usr/bin/swift",
            args: [
                "run",
                "--package-path",
                relayConsoleSwiftPackageRoot().path,
                "RelayMarketplaceToolBridge"
            ]
        )
    }

    private func relayConsoleSwiftPackageRoot() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}

private func objectValue(_ value: JSONValue?) -> JSONRecord? {
    if case .object(let object)? = value {
        return object
    }
    return nil
}

private func arrayValue(_ value: JSONValue?) -> [JSONValue] {
    if case .array(let array)? = value {
        return array
    }
    return []
}

private let hermesMarketplaceRuntimeToolModuleSource = #"""
import json
import os
import subprocess
from functools import partial

from tools.registry import registry


TOOLSET = "relay-marketplace"


def _always_false():
    return False


def _always_true():
    return True


def _field_schema(value):
    if isinstance(value, dict) and value.get("type"):
        return value
    if isinstance(value, str):
        lower = value.lower()
        if "array" in lower:
            return {"type": "array", "items": {"type": "string"}}
        if "boolean" in lower or "bool" in lower:
            return {"type": "boolean"}
        if "integer" in lower or "int" in lower:
            return {"type": "integer"}
        if "number" in lower:
            return {"type": "number"}
    return {"type": "string"}


def _parameters_schema(input_schema):
    if isinstance(input_schema, dict) and input_schema.get("type") == "object":
        return input_schema
    properties = {}
    required = []
    if isinstance(input_schema, dict):
        for key, value in input_schema.items():
            properties[key] = _field_schema(value)
            if not (isinstance(value, str) and "optional" in value.lower()):
                required.append(key)
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


def _load_snapshot():
    path = os.environ.get("RELAY_MARKETPLACE_RUNTIME_SNAPSHOT_PATH", "").strip()
    if not path:
        return {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {}


def _run_bridge(tool_name, args, **kwargs):
    command = os.environ.get("RELAY_MARKETPLACE_TOOL_BRIDGE_COMMAND", "").strip()
    if not command:
        return json.dumps({"ok": False, "error": "Relay Marketplace bridge command is not configured."})
    try:
        bridge_args = json.loads(os.environ.get("RELAY_MARKETPLACE_TOOL_BRIDGE_ARGS_JSON", "[]"))
        if not isinstance(bridge_args, list):
            bridge_args = []
    except Exception:
        bridge_args = []
    envelope = json.dumps({"toolName": tool_name, "arguments": args or {}})
    completed = subprocess.run(
        [command, *bridge_args, "execute"],
        input=envelope,
        text=True,
        capture_output=True,
        timeout=120,
    )
    if completed.returncode != 0:
        return json.dumps({
            "ok": False,
            "error": "Relay Marketplace bridge command failed.",
            "stderr": completed.stderr[-4000:],
        })
    return completed.stdout.strip() or json.dumps({"ok": False, "error": "Relay Marketplace bridge returned no output."})


registry.register(
    name="relay_marketplace_unavailable",
    toolset=TOOLSET,
    schema={
        "name": "relay_marketplace_unavailable",
        "description": "Internal Relay Marketplace discovery placeholder.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    handler=lambda args, **kwargs: json.dumps({"ok": False}),
    check_fn=_always_false,
)


_snapshot = _load_snapshot()
_registered_tool_names = []
for _app in _snapshot.get("apps", []):
    for _tool in _app.get("tools", []):
        _name = _tool.get("toolName")
        if not _name:
            continue
        _registered_tool_names.append(_name)
        registry.register(
            name=_name,
            toolset=TOOLSET,
            schema={
                "name": _name,
                "description": f"{_tool.get('displayName', _name)}. {_tool.get('summary', '')}".strip(),
                "parameters": _parameters_schema(_tool.get("inputSchema") or {}),
            },
            handler=partial(_run_bridge, _name),
            check_fn=_always_true,
            max_result_size_chars=100_000,
            override=True,
        )


def _append_unique(target, names):
    if not isinstance(target, list):
        return
    for name in names:
        if name not in target:
            target.append(name)


def _expose_registered_tools(names):
    if not names:
        return
    try:
        import toolsets as _toolsets
        _toolsets.TOOLSETS[TOOLSET] = {
            "description": "Relay Marketplace provider wrapper tools mounted for this runtime session.",
            "tools": list(names),
            "includes": [],
        }
        _append_unique(getattr(_toolsets, "_HERMES_CORE_TOOLS", []), names)
        for _definition in getattr(_toolsets, "TOOLSETS", {}).values():
            if isinstance(_definition, dict):
                _append_unique(_definition.get("tools"), names)
    except Exception:
        return


_expose_registered_tools(_registered_tool_names)
"""#

private let openClawMarketplaceRuntimeToolPluginSource = #"""
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

let runtimeConfig = {};

function loadSnapshot(path) {
  const snapshotPath = runtimeString(path);
  if (!snapshotPath) return {};
  try {
    return JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  } catch {
    return {};
  }
}

function loadCatalog() {
  const directory = runtimeString(runtimeConfig.snapshotDirectory);
  if (!directory) return [];
  const byName = new Map();
  try {
    for (const entry of fs.readdirSync(directory)) {
      if (!entry.endsWith(".json")) continue;
      const snapshot = loadSnapshot(`${directory}/${entry}`);
      if (runtimeString(snapshot.runtimeType) !== "openclaw") continue;
      for (const app of snapshot.apps || []) {
        for (const tool of app.tools || []) {
          if (runtimeString(tool && tool.toolName)) byName.set(tool.toolName, tool);
        }
      }
    }
  } catch {}
  return Array.from(byName.values());
}

function runtimeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function runtimeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}

function runtimeStringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry) => typeof entry[1] === "string")
  );
}

function parseBridgeArgs(config) {
  const raw = runtimeString(process.env.RELAY_MARKETPLACE_TOOL_BRIDGE_ARGS_JSON);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((entry) => typeof entry === "string");
    } catch {}
  }
  return runtimeStringArray(config.bridgeArgs);
}

function fieldSchema(value) {
  if (value && typeof value === "object" && !Array.isArray(value) && value.type) return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower.includes("array")) return { type: "array", items: { type: "string" } };
    if (lower.includes("boolean") || lower.includes("bool")) return { type: "boolean" };
    if (lower.includes("integer") || lower.includes("int")) return { type: "integer" };
    if (lower.includes("number")) return { type: "number" };
  }
  return { type: "string" };
}

function parametersSchema(inputSchema) {
  if (inputSchema && typeof inputSchema === "object" && !Array.isArray(inputSchema) && inputSchema.type === "object") {
    return inputSchema;
  }
  const properties = {};
  const required = [];
  if (inputSchema && typeof inputSchema === "object" && !Array.isArray(inputSchema)) {
    for (const [key, value] of Object.entries(inputSchema)) {
      properties[key] = fieldSchema(value);
      if (!(typeof value === "string" && value.toLowerCase().includes("optional"))) required.push(key);
    }
  }
  return { type: "object", properties, required, additionalProperties: false };
}

function dispatchEnvironment(toolContext) {
  const contextPath = runtimeString(process.env.RELAY_MARKETPLACE_RUNTIME_CONTEXT_PATH)
    || runtimeString(runtimeConfig.bridgeEnvironment && runtimeConfig.bridgeEnvironment.RELAY_MARKETPLACE_RUNTIME_CONTEXT_PATH);
  const sessionKey = runtimeString(toolContext && toolContext.sessionKey);
  if (!contextPath || !sessionKey) return {};
  try {
    const root = JSON.parse(fs.readFileSync(contextPath, "utf8"));
    return runtimeStringRecord(root && root.contexts && root.contexts[sessionKey]);
  } catch {
    return {};
  }
}

function toolForSession(name, toolContext) {
  const environment = dispatchEnvironment(toolContext);
  const snapshot = loadSnapshot(environment.RELAY_MARKETPLACE_RUNTIME_SNAPSHOT_PATH);
  for (const app of snapshot.apps || []) {
    for (const tool of app.tools || []) {
      if (tool && tool.toolName === name) return tool;
    }
  }
  return null;
}

function runBridge(toolName, params, toolContext) {
  const command = runtimeString(process.env.RELAY_MARKETPLACE_TOOL_BRIDGE_COMMAND) || runtimeString(runtimeConfig.bridgeCommand);
  if (!command) return { ok: false, error: "Relay Marketplace bridge command is not configured." };
  const bridgeArgs = parseBridgeArgs(runtimeConfig);
  const bridgeEnvironment = {
    ...runtimeStringRecord(runtimeConfig.bridgeEnvironment),
    ...process.env,
    ...dispatchEnvironment(toolContext),
    RELAY_MARKETPLACE_TOOL_BRIDGE_COMMAND: command,
    RELAY_MARKETPLACE_TOOL_BRIDGE_ARGS_JSON: JSON.stringify(bridgeArgs),
  };
  const child = spawnSync(command, [...bridgeArgs, "execute"], {
    input: JSON.stringify({ toolName, arguments: params || {} }),
    encoding: "utf8",
    env: bridgeEnvironment,
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  if (child.status !== 0) {
    return {
      ok: false,
      error: "Relay Marketplace bridge command failed.",
      stderr: String(child.stderr || "").slice(-4000),
    };
  }
  const text = String(child.stdout || "").trim();
  if (!text) return { ok: false, error: "Relay Marketplace bridge returned no output." };
  try {
    return JSON.parse(text);
  } catch {
    return { ok: true, text };
  }
}

module.exports = {
  id: "relay-marketplace",
  name: "Relay Marketplace",
  description: "Policy-scoped Relay Marketplace provider wrapper tools.",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      snapshotDirectory: { type: "string" },
      catalogVersion: { type: "string" },
      bridgeCommand: { type: "string" },
      bridgeArgs: { type: "array", items: { type: "string" } },
      bridgeEnvironment: { type: "object", additionalProperties: { type: "string" } },
    },
  },
  register(api) {
    runtimeConfig = api && api.pluginConfig && typeof api.pluginConfig === "object" && !Array.isArray(api.pluginConfig)
      ? api.pluginConfig
      : {};
    for (const catalogTool of loadCatalog()) {
        const name = catalogTool.toolName;
        if (!name) continue;
        api.registerTool((toolContext) => {
          const tool = toolForSession(name, toolContext);
          if (!tool) return null;
          return {
            name,
            label: tool.displayName || name,
            description: `${tool.displayName || name}. ${tool.summary || ""}`.trim(),
            parameters: parametersSchema(tool.inputSchema || {}),
            execute: async (_toolCallId, params) => {
              const result = runBridge(name, params || {}, toolContext);
              return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                details: result,
              };
            },
          };
        }, { name });
    }
  },
};
"""#

private let openClawMarketplaceContextLock = NSLock()
