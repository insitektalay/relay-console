export type LocalAppRuntimeProfile = {
  repoPath: string | null;
  appUrl: string | null;
  agentApiUrl: string | null;
  startCommand: string | null;
  healthCheckUrl: string | null;
  backendHealthCheckUrl: string | null;
  autoStartAllowed: boolean;
  hardStopConditions: string[];
  expectedPorts: number[];
  sourceHostId: string | null;
};

type RuntimeProfileInput = {
  appSlug?: string | null;
  appName?: string | null;
  repoPath?: string | null;
  metadata?: Record<string, unknown> | null;
  apiStyleMetadata?: Record<string, unknown> | null;
  connectionMetadata?: Record<string, unknown> | null;
};

const LOCAL_APP_CONNECTOR_RUNTIME_HARD_STOPS = [
  "install",
  "migration",
  "reset",
  "destructive data loss",
  "secret exposure",
  "payment",
  "CAPTCHA bypass",
  "legal commitment",
  "unknown interactive prompt",
];

export const LOCAL_APP_CONNECTOR_DEFAULT_RUNTIME_PROFILE: LocalAppRuntimeProfile = {
  repoPath: "/home/example/repos/LocalAppConnector",
  appUrl: "http://localhost:3052",
  agentApiUrl: "http://localhost:3052/api/openclaw",
  startCommand: "pnpm dev",
  healthCheckUrl: "http://localhost:3052",
  backendHealthCheckUrl: "http://localhost:3210",
  autoStartAllowed: true,
  hardStopConditions: LOCAL_APP_CONNECTOR_RUNTIME_HARD_STOPS,
  expectedPorts: [3052, 3210],
  sourceHostId: null,
};

export function isLocalAppConnectorLocalApp(input: {
  appSlug?: string | null;
  appName?: string | null;
}) {
  return `${input.appSlug ?? ""} ${input.appName ?? ""}`
    .toLowerCase()
    .includes("localappconnector");
}

export function resolveLocalAppRuntimeProfile(
  input: RuntimeProfileInput,
): LocalAppRuntimeProfile {
  const metadata = input.metadata ?? {};
  const apiStyleMetadata = input.apiStyleMetadata ?? {};
  const connectionMetadata = input.connectionMetadata ?? {};
  const explicit =
    objectOrNull(connectionMetadata.runtimeProfile) ??
    objectOrNull(metadata.runtimeProfile) ??
    objectOrNull(apiStyleMetadata.runtimeProfile);
  const lifecycle =
    objectOrNull(connectionMetadata.lifecycle) ??
    objectOrNull(metadata.lifecycle) ??
    objectOrNull(apiStyleMetadata.lifecycle) ??
    {};
  const isLocalAppConnector = isLocalAppConnectorLocalApp({
    appSlug: input.appSlug,
    appName: input.appName,
  });
  const fallback = isLocalAppConnector
    ? LOCAL_APP_CONNECTOR_DEFAULT_RUNTIME_PROFILE
    : {
        repoPath: null,
        appUrl: null,
        agentApiUrl: null,
        startCommand: null,
        healthCheckUrl: null,
        backendHealthCheckUrl: null,
        autoStartAllowed: false,
        hardStopConditions: [
          "install",
          "migration",
          "reset",
          "destructive data loss",
          "secret exposure",
          "payment",
          "CAPTCHA bypass",
          "legal commitment",
          "unknown interactive prompt",
        ],
        expectedPorts: [],
        sourceHostId: null,
      };

  const repoPath =
    stringOrNull(explicit?.repoPath) ??
    stringOrNull(connectionMetadata.localRepoPath) ??
    stringOrNull(metadata.localRepoPath) ??
    (isLocalAppConnector ? null : stringOrNull(input.repoPath)) ??
    fallback.repoPath;
  const appUrl =
    stringOrNull(explicit?.appUrl) ??
    stringOrNull(connectionMetadata.localAppUrl) ??
    stringOrNull(metadata.localAppUrl) ??
    fallback.appUrl;
  const agentApiUrl =
    stringOrNull(explicit?.agentApiUrl) ??
    stringOrNull(connectionMetadata.agentApiUrl) ??
    stringOrNull(metadata.agentApiUrl) ??
    deriveLocalAppConnectorAgentApiUrl(
      stringOrNull(metadata.localappconnectorOpenClawBaseUrl) ??
        stringOrNull(apiStyleMetadata.localappconnectorOpenClawBaseUrl) ??
        appUrl,
    ) ??
    fallback.agentApiUrl;
  const startCommand =
    stringOrNull(explicit?.startCommand) ??
    stringOrNull(connectionMetadata.startCommand) ??
    stringOrNull(metadata.startCommand) ??
    stringOrNull(lifecycle.startCommand) ??
    fallback.startCommand;
  const healthCheckUrl =
    stringOrNull(explicit?.healthCheckUrl) ??
    stringOrNull(connectionMetadata.healthCheckUrl) ??
    stringOrNull(metadata.healthCheckUrl) ??
    stringOrNull(lifecycle.healthUrl) ??
    stringOrNull(lifecycle.statusUrl) ??
    appUrl ??
    fallback.healthCheckUrl;
  const backendHealthCheckUrl =
    stringOrNull(explicit?.backendHealthCheckUrl) ??
    stringOrNull(connectionMetadata.backendHealthCheckUrl) ??
    stringOrNull(metadata.backendHealthCheckUrl) ??
    fallback.backendHealthCheckUrl;
  const sourceHostId =
    stringOrNull(explicit?.sourceHostId) ??
    stringOrNull(connectionMetadata.sourceHostId) ??
    stringOrNull(connectionMetadata.bridgeDeviceId) ??
    stringOrNull(metadata.sourceHostId) ??
    stringOrNull(metadata.bridgeDeviceId) ??
    fallback.sourceHostId;

  return {
    repoPath,
    appUrl,
    agentApiUrl,
    startCommand,
    healthCheckUrl,
    backendHealthCheckUrl,
    autoStartAllowed:
      booleanOrNull(explicit?.autoStartAllowed) ??
      booleanOrNull(connectionMetadata.autoStartAllowed) ??
      booleanOrNull(metadata.autoStartAllowed) ??
      booleanOrNull(connectionMetadata.allowRuntimeHostStart) ??
      booleanOrNull(metadata.allowRuntimeHostStart) ??
      booleanOrNull(lifecycle.allowRuntimeHostStart) ??
      fallback.autoStartAllowed,
    hardStopConditions:
      stringArray(explicit?.hardStopConditions) ??
      stringArray(connectionMetadata.hardStopConditions) ??
      stringArray(metadata.hardStopConditions) ??
      fallback.hardStopConditions,
    expectedPorts:
      numberArray(explicit?.expectedPorts) ??
      numberArray(connectionMetadata.expectedPorts) ??
      numberArray(metadata.expectedPorts) ??
      fallback.expectedPorts,
    sourceHostId,
  };
}

export function localAppRuntimeRecoveryDoctrine() {
  return [
    "Local app unreachable triggers runtime recovery; do not treat it as a final task blocker.",
    "When the current runtime profile allows auto-start, request `localApp.ensureRunning` through the Hermes/source-host bridge before declaring the app unavailable.",
    "Respect runtime hard stops: install, migration, reset, destructive data loss, secret exposure, payment, CAPTCHA bypass, legal commitment, and unknown interactive prompts.",
    "Never call user-local localhost URLs from ClawChat Railway; local app health checks and starts must execute on the configured source host.",
  ].join("\n");
}

function deriveLocalAppConnectorAgentApiUrl(baseUrl: string | null) {
  if (!baseUrl) return null;
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (/\/api\/openclaw$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api/openclaw`;
}

function objectOrNull(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const values = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return values.length ? values : null;
}

function numberArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const values = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0 && entry <= 65535);
  return values.length ? Array.from(new Set(values)) : null;
}
