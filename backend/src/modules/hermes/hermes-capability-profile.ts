export const HERMES_CAPABILITY_PROFILE_IDS = [
  "chat_only",
  "browser_research",
  "marketplace_app_operator",
  "registered_local_app_operator",
  "repo_reader",
  "repo_editor",
  "runtime_operator",
  "coding_agent",
  "manager_agent",
  "worker_agent",
] as const;

export type HermesCapabilityProfileId =
  (typeof HERMES_CAPABILITY_PROFILE_IDS)[number];

export type HermesCapabilityProfileResolution = {
  profile: HermesCapabilityProfileId;
  rawEnabledToolsets: string[];
  rawDisabledToolsets: string[];
  additiveToolsets: string[];
  enabledToolsetsForHermes?: string[];
  disabledToolsetsForHermes: string[];
  replaceBaseHarness: boolean;
  baseHarnessPreserved: boolean;
  finalResolvedToolManifest: string[];
};

type ResolveInput = {
  configMetadata?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
  rawEnabledToolsets: string[];
  rawDisabledToolsets: string[];
  browserSupport: boolean;
  marketplaceToolNames: string[];
  localAppRuntimeToolNames: string[];
};

const DEFAULT_DISABLED_TOOLSETS: string[] = [];

const PROFILE_ADDITIVE_TOOLSETS: Record<HermesCapabilityProfileId, string[]> = {
  chat_only: [],
  browser_research: ["browser"],
  marketplace_app_operator: ["marketplace"],
  registered_local_app_operator: ["marketplace", "local_app_runtime"],
  repo_reader: ["repo_search", "file_read"],
  repo_editor: ["repo_search", "file_read", "patch"],
  runtime_operator: ["local_app_runtime"],
  coding_agent: ["repo_search", "file_read", "patch", "approved_commands", "skills"],
  manager_agent: [],
  worker_agent: [],
};

export function resolveHermesCapabilityProfile(
  input: ResolveInput,
): HermesCapabilityProfileResolution {
  const profile = normalizeProfile(
    stringOrNull(input.configMetadata?.capabilityProfile) ??
      stringOrNull(input.capabilities?.capabilityProfile),
  );
  const replaceBaseHarness =
    booleanOrNull(input.configMetadata?.replaceBaseHarness) ??
    booleanOrNull(input.capabilities?.replaceBaseHarness) ??
    false;
  const additiveToolsets = unique([
    ...PROFILE_ADDITIVE_TOOLSETS[profile],
    ...(input.browserSupport ? ["browser"] : []),
    ...(input.marketplaceToolNames.length ? ["marketplace"] : []),
    ...(input.localAppRuntimeToolNames.length ? ["local_app_runtime"] : []),
    ...input.rawEnabledToolsets,
  ]);
  const disabledToolsetsForHermes = unique([
    ...DEFAULT_DISABLED_TOOLSETS,
    ...input.rawDisabledToolsets,
  ]);
  const enabledToolsetsForHermes = replaceBaseHarness ? additiveToolsets : undefined;
  const baseHarnessPreserved = !replaceBaseHarness;
  return {
    profile,
    rawEnabledToolsets: input.rawEnabledToolsets,
    rawDisabledToolsets: input.rawDisabledToolsets,
    additiveToolsets,
    enabledToolsetsForHermes,
    disabledToolsetsForHermes,
    replaceBaseHarness,
    baseHarnessPreserved,
    finalResolvedToolManifest: unique([
      ...(baseHarnessPreserved ? ["hermes_base_harness"] : []),
      ...additiveToolsets.map((toolset) => `toolset:${toolset}`),
      ...input.marketplaceToolNames.map((name) => `marketplace:${name}`),
      ...input.localAppRuntimeToolNames.map((name) => `local_app:${name}`),
    ]),
  };
}

function normalizeProfile(value: string | null): HermesCapabilityProfileId {
  if (
    value &&
    (HERMES_CAPABILITY_PROFILE_IDS as readonly string[]).includes(value)
  ) {
    return value as HermesCapabilityProfileId;
  }
  return "worker_agent";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}
