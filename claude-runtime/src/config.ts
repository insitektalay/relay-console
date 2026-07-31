import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { DeviceCredentialStore } from "./credential-store";
import {
  assertManagedExistingDirectory,
  assertManagedPath,
  assertSafeRuntimeId,
} from "./path-policy";
import { writeProtectedFile } from "./output-security";

export type RuntimeAgentConfig = {
  externalAgentId: string;
  repoKey: string;
  model?: string;
};

export type RuntimeRepoConfig = {
  repoKey: string;
  repoPath: string;
  model?: string;
};

export type ManagedAgentHostConfig = {
  externalAgentId: string;
  runtimeType?: "openclaw" | "hermes";
  workspacePath?: string;
  allowWorkspaceQuarantine?: boolean;
  schedulerCommand?: string[];
  cronCommand?: string[];
};

export type RuntimeCommandRiskAcceptance = {
  dangerousBypassAccepted?: boolean;
  acceptedBy?: string;
  acceptedAt?: string;
  reason?: string;
};

export type RuntimeConfig = {
  apiBaseUrl: string;
  wsUrl: string;
  workspaceId: string;
  managedRoot: string;
  claudeCommand?: string[];
  structuredPromptCommand?: string[];
  runtimeCommandRiskAcceptance?: RuntimeCommandRiskAcceptance;
  runtimeLabel?: string;
  heartbeatIntervalSeconds?: number;
  dispatchTimeoutSeconds?: number;
  device?: {
    devicePublicId: string;
  };
  agents: RuntimeAgentConfig[];
  repos: RuntimeRepoConfig[];
  managedAgentHosts?: ManagedAgentHostConfig[];
};

export function getRuntimeHome() {
  return path.join(os.homedir(), ".clawchat", "claude-runtime");
}

export function getRuntimePaths() {
  const home = getRuntimeHome();
  return {
    home,
    configPath: path.join(home, "config.json"),
    journalPath: path.join(home, "state", "journal.json"),
    logsDir: path.join(home, "logs"),
    stateDir: path.join(home, "state"),
  };
}

export async function ensureRuntimeDirs() {
  const paths = getRuntimePaths();
  await ensureProtectedDirectory(path.dirname(paths.home));
  await ensureProtectedDirectory(paths.home);
  await ensureProtectedDirectory(paths.logsDir);
  await ensureProtectedDirectory(paths.stateDir);
  return paths;
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const paths = await ensureRuntimeDirs();
  await rejectSymlinkFile(paths.configPath, "config.json");
  const raw = await fs.readFile(paths.configPath, "utf8");
  const parsed = JSON.parse(raw) as RuntimeConfig & {
    device?: { devicePublicId?: string; deviceToken?: string };
  };
  await migrateLegacyDeviceCredential(parsed, paths.configPath);
  const config = parsed as RuntimeConfig;

  if (!config.apiBaseUrl?.trim()) {
    throw new Error("config.json missing apiBaseUrl");
  }
  if (!config.wsUrl?.trim()) {
    throw new Error("config.json missing wsUrl");
  }
  if (!config.workspaceId?.trim()) {
    throw new Error("config.json missing workspaceId");
  }
  if (!config.managedRoot?.trim()) {
    throw new Error("config.json missing managedRoot");
  }
  validateRuntimeOrigins(config.apiBaseUrl, config.wsUrl);
  if (
    config.claudeCommand !== undefined &&
    (!Array.isArray(config.claudeCommand) ||
      config.claudeCommand.length === 0 ||
      config.claudeCommand.some(
        (entry) => typeof entry !== "string" || !entry.trim(),
      ))
  ) {
    throw new Error(
      "config.json claudeCommand must be an array of non-empty strings",
    );
  }
  if (
    config.structuredPromptCommand !== undefined &&
    (!Array.isArray(config.structuredPromptCommand) ||
      config.structuredPromptCommand.length === 0 ||
      config.structuredPromptCommand.some(
        (entry) => typeof entry !== "string" || !entry.trim(),
      ))
  ) {
    throw new Error(
      "config.json structuredPromptCommand must be an array of non-empty strings",
    );
  }
  if (
    config.runtimeCommandRiskAcceptance !== undefined &&
    (config.runtimeCommandRiskAcceptance === null ||
      typeof config.runtimeCommandRiskAcceptance !== "object")
  ) {
    throw new Error(
      "config.json runtimeCommandRiskAcceptance must be an object when provided",
    );
  }
  if (config.runtimeCommandRiskAcceptance?.dangerousBypassAccepted === true) {
    const acceptedBy =
      config.runtimeCommandRiskAcceptance.acceptedBy?.trim() ?? "";
    const acceptedAt =
      config.runtimeCommandRiskAcceptance.acceptedAt?.trim() ?? "";
    const reason = config.runtimeCommandRiskAcceptance.reason?.trim() ?? "";
    if (!acceptedBy || !acceptedAt || !reason) {
      throw new Error(
        "config.json runtimeCommandRiskAcceptance requires acceptedBy, acceptedAt, and reason when dangerousBypassAccepted is true",
      );
    }
    if (Number.isNaN(Date.parse(acceptedAt))) {
      throw new Error(
        "config.json runtimeCommandRiskAcceptance.acceptedAt must be a valid date string",
      );
    }
  }
  if (!Array.isArray(config.agents) || config.agents.length === 0) {
    throw new Error("config.json must define at least one Claude agent");
  }
  if (!Array.isArray(config.repos) || config.repos.length === 0) {
    throw new Error("config.json must define at least one repo binding");
  }
  if (
    config.managedAgentHosts !== undefined &&
    !Array.isArray(config.managedAgentHosts)
  ) {
    throw new Error("config.json managedAgentHosts must be an array");
  }

  const repoKeys = new Set<string>();
  for (const repo of config.repos) {
    const repoKey = assertSafeRuntimeId(repo.repoKey, "repoKey");
    if (repoKeys.has(repoKey)) {
      throw new Error(`config.json contains duplicate repoKey ${repoKey}`);
    }
    repoKeys.add(repoKey);
    await assertManagedExistingDirectory(
      config.managedRoot,
      repo.repoPath,
      `repo ${repoKey}`,
    );
  }
  for (const agent of config.agents) {
    assertSafeRuntimeId(agent.externalAgentId, "externalAgentId");
    if (!repoKeys.has(agent.repoKey)) {
      throw new Error(
        `Agent ${agent.externalAgentId} references unknown repoKey ${agent.repoKey}`,
      );
    }
  }
  for (const host of config.managedAgentHosts ?? []) {
    assertSafeRuntimeId(host.externalAgentId, "managed externalAgentId");
    if (host.workspacePath) {
      await assertManagedPath(
        config.managedRoot,
        host.workspacePath,
        `workspace for ${host.externalAgentId}`,
        false,
      );
    }
  }

  config.apiBaseUrl = normalizeApiUrl(config.apiBaseUrl);
  config.wsUrl = normalizeWsUrl(config.wsUrl);

  return config;
}

export async function saveRuntimeConfig(config: RuntimeConfig) {
  const paths = await ensureRuntimeDirs();
  const safeConfig = JSON.parse(JSON.stringify(config)) as Record<
    string,
    unknown
  >;
  if (
    safeConfig.device &&
    typeof safeConfig.device === "object" &&
    !Array.isArray(safeConfig.device)
  ) {
    delete (safeConfig.device as Record<string, unknown>).deviceToken;
  }
  await writeProtectedFile(
    paths.configPath,
    JSON.stringify(safeConfig, null, 2) + "\n",
  );
}

function normalizeWsUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.replace(/\/ws\/?$/i, "");
}

function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function validateRuntimeOrigins(apiBaseUrl: string, wsUrl: string) {
  const api = parseRuntimeUrl(apiBaseUrl, "apiBaseUrl");
  const websocket = parseRuntimeUrl(wsUrl, "wsUrl");
  if (api.protocol !== "https:") {
    throw new Error("apiBaseUrl must use HTTPS");
  }
  if (websocket.protocol !== "wss:") {
    throw new Error("wsUrl must use WSS");
  }
  if (!api.hostname.toLowerCase().endsWith(".up.railway.app")) {
    throw new Error("apiBaseUrl must target an exact Railway service origin");
  }
  if (websocket.hostname.toLowerCase() !== api.hostname.toLowerCase()) {
    throw new Error("apiBaseUrl and wsUrl must target the same Railway host");
  }
  if (api.pathname.replace(/\/+$/, "") !== "/api/v1") {
    throw new Error("apiBaseUrl path must be exactly /api/v1");
  }
  if (websocket.pathname !== "/" && websocket.pathname !== "") {
    throw new Error("wsUrl must not contain a path");
  }
  for (const [label, url] of [
    ["apiBaseUrl", api],
    ["wsUrl", websocket],
  ] as const) {
    if (
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      throw new Error(`${label} must be an origin without credentials or extras`);
    }
  }
}

function parseRuntimeUrl(value: string, label: string) {
  try {
    return new URL(value.trim());
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
}

export async function migrateLegacyDeviceCredential(
  config: RuntimeConfig & {
    device?: { devicePublicId?: string; deviceToken?: string };
  },
  configPath: string,
  credentialStore: Pick<DeviceCredentialStore, "save"> = new DeviceCredentialStore(),
) {
  const devicePublicId = config.device?.devicePublicId?.trim() ?? "";
  const deviceToken = config.device?.deviceToken ?? "";
  if (!deviceToken) {
    return;
  }
  if (!devicePublicId) {
    throw new Error(
      "Legacy plaintext deviceToken cannot be migrated without devicePublicId",
    );
  }
  await credentialStore.save(devicePublicId, deviceToken);
  delete config.device?.deviceToken;
  await writeProtectedFile(configPath, JSON.stringify(config, null, 2) + "\n");
}

async function ensureProtectedDirectory(value: string) {
  await fs.mkdir(value, { mode: 0o700 }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    },
  );
  const stat = await fs.lstat(value);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Refusing unsafe runtime directory ${value}`);
  }
  await fs.chmod(value, 0o700);
}

async function rejectSymlinkFile(value: string, label: string) {
  try {
    const stat = await fs.lstat(value);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`${label} must be a regular non-symlink file`);
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}
