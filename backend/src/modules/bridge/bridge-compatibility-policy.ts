import rawManifest = require("./bridge-compatibility-manifest.json");
import { normalizeServerAuthorizedBridgeCapabilities } from "./bridge-capabilities";

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
  verifiedRuntimeVersions?: string[];
  runtimeVersionPolicy?: {
    unknownRuntimeMode: "safe" | "blocked";
    ranges: Array<{
      scheme: "semver" | "calendar";
      minimum: string;
      maximumExclusive?: string;
    }>;
    knownIncompatibleVersions: string[];
    safeModeCapabilities: string[];
  };
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
  capabilities?: string[] | null;
}

export type BridgeCompatibilityLevel =
  | "verified"
  | "compatible"
  | "unsupported";
export type BridgeOperatingMode = "full" | "safe" | "blocked";

export interface BridgeCompatibilityResult {
  compatible: boolean;
  code: string | null;
  level: BridgeCompatibilityLevel;
  operatingMode: BridgeOperatingMode;
  verifiedRuntime: boolean;
  runtimeType: BridgeRuntimeType | null;
  hostType: BridgeHostType | null;
  runtimeVersion: string | null;
  enabledCapabilities: string[];
  disabledCapabilities: string[];
  warnings: string[];
  runtimePolicy: {
    verifiedVersions: string[];
    ranges: Array<{
      scheme: "semver" | "calendar";
      minimum: string;
      maximumExclusive?: string;
    }>;
  } | null;
  release: string;
  releaseStatus: string;
}

function normalizeVersion(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^v(?=\d)/, "");
}

function numericVersion(value?: string | null) {
  const normalized = normalizeVersion(value);
  const match = normalized.match(
    /^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?(?:[-+].*)?$/,
  );
  if (!match) return null;
  const parts = match.slice(1).map((part) => Number(part ?? 0));
  return {
    scheme: parts[0] >= 2_000 ? "calendar" : "semver",
    parts,
  } as const;
}

function compareNumericVersions(left: number[], right: number[]) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

function versionMatchesRange(
  version: ReturnType<typeof numericVersion>,
  range: {
    scheme: "semver" | "calendar";
    minimum: string;
    maximumExclusive?: string;
  },
) {
  if (!version || version.scheme !== range.scheme) return false;
  const minimum = numericVersion(range.minimum);
  const maximum = numericVersion(range.maximumExclusive);
  if (!minimum || compareNumericVersions(version.parts, minimum.parts) < 0) {
    return false;
  }
  return !maximum || compareNumericVersions(version.parts, maximum.parts) < 0;
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
    runtimeVersion: input.runtimeVersion?.trim() || null,
    enabledCapabilities: [] as string[],
    disabledCapabilities: [] as string[],
    warnings: [] as string[],
    runtimePolicy: null as BridgeCompatibilityResult["runtimePolicy"],
    verifiedRuntime: false,
  };

  const unsupported = (code: string): BridgeCompatibilityResult => ({
    ...base,
    compatible: false,
    code,
    level: "unsupported",
    operatingMode: "blocked",
  });

  if (!runtimeType) {
    return unsupported("BRIDGE_RUNTIME_TYPE_REQUIRED");
  }
  if (!hostType) {
    return unsupported("BRIDGE_HOST_UNSUPPORTED");
  }
  if (input.apiContractVersion !== BRIDGE_API_CONTRACT) {
    return unsupported("BRIDGE_API_CONTRACT_MISMATCH");
  }
  if (input.websocketContractVersion !== BRIDGE_WEBSOCKET_CONTRACT) {
    return unsupported("BRIDGE_WEBSOCKET_CONTRACT_MISMATCH");
  }

  const policy = BRIDGE_COMPATIBILITY_MANIFEST.plugins[
    runtimeType
  ] as ManifestPlugin & {
    runtimeVersion: string;
  };
  const runtimePolicy: NonNullable<ManifestPlugin["runtimeVersionPolicy"]> =
    policy.runtimeVersionPolicy ?? {
      unknownRuntimeMode: "blocked" as const,
      ranges: [],
      knownIncompatibleVersions: [],
      safeModeCapabilities: [],
    };
  base.runtimePolicy = {
    verifiedVersions:
      policy.verifiedRuntimeVersions ?? policy.supportedRuntimeVersions ?? [],
    ranges: runtimePolicy.ranges,
  };
  if (!policy.candidateHostOS.includes(hostType)) {
    return unsupported("BRIDGE_HOST_UNSUPPORTED");
  }
  const supportedPluginVersions = (
    policy.supportedPluginVersions ?? [policy.version]
  ).map(normalizeVersion);
  if (
    !normalizeVersion(input.pluginVersion) ||
    !supportedPluginVersions.includes(normalizeVersion(input.pluginVersion))
  ) {
    return unsupported("BRIDGE_PLUGIN_VERSION_UNSUPPORTED");
  }

  const requestedCapabilities = normalizeServerAuthorizedBridgeCapabilities(
    input.capabilities,
  );
  const normalizedRuntimeVersion = normalizeVersion(input.runtimeVersion);
  const verifiedVersions = (
    policy.verifiedRuntimeVersions ??
    policy.supportedRuntimeVersions ?? [policy.runtimeVersion]
  ).map(normalizeVersion);
  if (
    normalizedRuntimeVersion &&
    runtimePolicy.knownIncompatibleVersions
      .map(normalizeVersion)
      .includes(normalizedRuntimeVersion)
  ) {
    return unsupported("BRIDGE_RUNTIME_VERSION_KNOWN_INCOMPATIBLE");
  }

  const verifiedRuntime =
    Boolean(normalizedRuntimeVersion) &&
    verifiedVersions.includes(normalizedRuntimeVersion);
  if (verifiedRuntime) {
    return {
      ...base,
      compatible: true,
      code: null,
      level: "verified",
      operatingMode: "full",
      verifiedRuntime: true,
      enabledCapabilities: requestedCapabilities,
      disabledCapabilities: [],
    };
  }

  const parsedRuntimeVersion = numericVersion(input.runtimeVersion);
  const inCompatibleRange = runtimePolicy.ranges.some((range) =>
    versionMatchesRange(parsedRuntimeVersion, range),
  );
  const unknownVersionAllowed =
    runtimePolicy.unknownRuntimeMode === "safe" &&
    (!normalizedRuntimeVersion || !parsedRuntimeVersion);
  if (!inCompatibleRange && !unknownVersionAllowed) {
    return unsupported("BRIDGE_RUNTIME_VERSION_UNSUPPORTED");
  }

  const enabledSet = new Set(runtimePolicy.safeModeCapabilities);
  const enabledCapabilities = requestedCapabilities.filter((capability) =>
    enabledSet.has(capability),
  );
  const disabledCapabilities = requestedCapabilities.filter(
    (capability) => !enabledSet.has(capability),
  );
  return {
    ...base,
    compatible: true,
    code: null,
    level: "compatible",
    operatingMode: "safe",
    enabledCapabilities,
    disabledCapabilities,
    warnings: [
      normalizedRuntimeVersion
        ? "BRIDGE_RUNTIME_VERSION_UNVERIFIED"
        : "BRIDGE_RUNTIME_VERSION_UNKNOWN",
      ...(disabledCapabilities.length
        ? ["BRIDGE_SAFE_MODE_CAPABILITIES_RESTRICTED"]
        : []),
    ],
  };
}
