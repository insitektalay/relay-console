import rawManifest = require("./bridge-compatibility-manifest.json");

export const BRIDGE_API_CONTRACT = "v2";
export const BRIDGE_WEBSOCKET_CONTRACT = "bridge.v1";
export const RELAY_RUNTIME_CONNECTOR_PROTOCOLS = [
  "agent-replica.v1",
  "relay-connector.v2",
  "relay-connector.v3",
] as const;
export type RelayRuntimeConnectorProtocol =
  (typeof RELAY_RUNTIME_CONNECTOR_PROTOCOLS)[number];
export const RELAY_RUNTIME_CONNECTOR_CONTRACT: RelayRuntimeConnectorProtocol =
  "relay-connector.v3";

export const BRIDGE_RUNTIME_TYPES = [
  "claude_code",
  "hermes",
  "openclaw",
] as const;
export type BridgeRuntimeType = (typeof BRIDGE_RUNTIME_TYPES)[number];

export const BRIDGE_HOST_TYPES = ["macos-launchd", "linux-systemd"] as const;
export type BridgeHostType = (typeof BRIDGE_HOST_TYPES)[number];

type ManifestPlugin = {
  id: string;
  version: string;
  supportedPluginVersions?: string[];
  supportedHarness: { version: string; commit: string | null };
  supportedRuntimeVersions?: string[];
  runtimeDependencies?: Record<string, Record<string, string>>;
  candidateHostOS: string[];
  hostAcceptance: Record<string, string>;
  capabilities: string[];
};

const manifest = rawManifest as typeof rawManifest & {
  plugins: ManifestPlugin[];
  knownGaps: string[];
};
const hermesPlugin = manifest.plugins.find(
  (plugin) => plugin.id === "hermes-agent-bridge",
);
const openClawPlugin = manifest.plugins.find(
  (plugin) => plugin.id === "openclaw-bridge",
);
const claudePlugin = manifest.plugins.find(
  (plugin) => plugin.id === "claude-runtime",
);
if (!hermesPlugin || !openClawPlugin || !claudePlugin) {
  throw new Error("Bridge compatibility manifest is missing a launch plugin");
}

export const BRIDGE_COMPATIBILITY_MANIFEST = {
  ...manifest,
  plugins: {
    claude_code: {
      ...claudePlugin,
      runtimeVersion: claudePlugin.supportedHarness.version,
    },
    hermes: {
      ...hermesPlugin,
      runtimeVersion: hermesPlugin.supportedHarness.version,
    },
    openclaw: {
      ...openClawPlugin,
      runtimeVersion: openClawPlugin.supportedHarness.version,
    },
  },
};

export interface BridgeCompatibilityInput {
  runtimeType?: string | null;
  hostType?: string | null;
  pluginVersion?: string | null;
  runtimeVersion?: string | null;
  apiContractVersion?: string | null;
  websocketContractVersion?: string | null;
}

export interface BridgeCompatibilityResult {
  compatible: boolean;
  code: string | null;
  runtimeType: BridgeRuntimeType | null;
  hostType: BridgeHostType | null;
  release: string;
  releaseStatus: string;
}

function normalizeVersion(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^v(?=\d)/, "");
}

export function evaluateBridgeCompatibility(
  input: BridgeCompatibilityInput,
): BridgeCompatibilityResult {
  const runtimeType = BRIDGE_RUNTIME_TYPES.includes(
    input.runtimeType as BridgeRuntimeType,
  )
    ? (input.runtimeType as BridgeRuntimeType)
    : null;
  const hostType = BRIDGE_HOST_TYPES.includes(input.hostType as BridgeHostType)
    ? (input.hostType as BridgeHostType)
    : null;
  const base = {
    runtimeType,
    hostType,
    release: BRIDGE_COMPATIBILITY_MANIFEST.release,
    releaseStatus: BRIDGE_COMPATIBILITY_MANIFEST.releaseStatus,
  };

  if (!runtimeType) {
    return { ...base, compatible: false, code: "BRIDGE_RUNTIME_TYPE_REQUIRED" };
  }
  if (!hostType) {
    return { ...base, compatible: false, code: "BRIDGE_HOST_UNSUPPORTED" };
  }
  if (input.apiContractVersion !== BRIDGE_API_CONTRACT) {
    return { ...base, compatible: false, code: "BRIDGE_API_CONTRACT_MISMATCH" };
  }
  if (input.websocketContractVersion !== BRIDGE_WEBSOCKET_CONTRACT) {
    return {
      ...base,
      compatible: false,
      code: "BRIDGE_WEBSOCKET_CONTRACT_MISMATCH",
    };
  }

  const policy = BRIDGE_COMPATIBILITY_MANIFEST.plugins[runtimeType];
  if (!policy.candidateHostOS.includes(hostType)) {
    return {
      ...base,
      compatible: false,
      code: "BRIDGE_HOST_UNSUPPORTED",
    };
  }
  const supportedPluginVersions = (
    policy.supportedPluginVersions ?? [policy.version]
  ).map(normalizeVersion);
  if (
    !normalizeVersion(input.pluginVersion) ||
    !supportedPluginVersions.includes(normalizeVersion(input.pluginVersion))
  ) {
    return {
      ...base,
      compatible: false,
      code: "BRIDGE_PLUGIN_VERSION_UNSUPPORTED",
    };
  }
  if (
    !normalizeVersion(input.runtimeVersion) ||
    !(policy.supportedRuntimeVersions ?? [policy.runtimeVersion])
      .map(normalizeVersion)
      .includes(normalizeVersion(input.runtimeVersion))
  ) {
    return {
      ...base,
      compatible: false,
      code: "BRIDGE_RUNTIME_VERSION_UNSUPPORTED",
    };
  }

  return { ...base, compatible: true, code: null };
}
