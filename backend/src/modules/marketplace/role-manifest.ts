import { type MarketplaceAppDefinition } from "./catalog/marketplace-catalog.types";

export type MarketplaceRoleManifestSource = "default" | "explicit" | "inferred";

export type MarketplaceRoleManifestEntry = {
  role: string;
  label: string;
  purpose: string;
  docsSourcePath: string | null;
  runtimeOutputPath: string | null;
  canWrite: boolean | string;
  readOnly: boolean;
  approvalRequiredFor: string[];
  blockedActions: string[];
  required: boolean;
  installAfterSetup: boolean;
  recommendedAgentName: string | null;
  recommendedAgentType: string | null;
  installable: boolean;
  notInstallableReason: string | null;
  source: MarketplaceRoleManifestSource;
};

export type MarketplaceRoleManifest = {
  roles: MarketplaceRoleManifestEntry[];
  roleCount: number;
};

type NormalizeInput = {
  appSlug: string;
  appName: string;
  app?: MarketplaceAppDefinition;
  explicitRoles?: unknown;
  hasWorkerDocs?: boolean;
  hasAuditorDocs?: boolean;
  hasManagerDocs?: boolean;
};

const ALWAYS_SUPPORTED_RUNTIME_ROLES = new Set(["worker", "auditor"]);

export function normalizeMarketplaceRoleManifest(
  input: NormalizeInput,
): MarketplaceRoleManifest {
  const explicitRoles = Array.isArray(input.explicitRoles)
    ? input.explicitRoles
    : [];
  const roles = new Map<string, MarketplaceRoleManifestEntry>();

  if (explicitRoles.length) {
    for (const role of explicitRoles) {
      const normalized = normalizeExplicitRole(input, role);
      if (normalized) roles.set(normalized.role, normalized);
    }
  } else if (input.app?.roleManifest?.roles?.length) {
    for (const role of input.app.roleManifest.roles) {
      roles.set(role.role, normalizeRoleRuntimeState({ ...role, source: role.source ?? "default" }));
    }
  } else if (!input.hasWorkerDocs && !input.hasAuditorDocs && !input.hasManagerDocs) {
    for (const role of [defaultWorkerRole(input), defaultAuditorRole(input)]) {
      roles.set(role.role, role);
    }
  }

  if (!explicitRoles.length) {
    if (input.hasWorkerDocs) roles.set("worker", inferredWorkerRole(input));
    if (input.hasAuditorDocs) roles.set("auditor", inferredAuditorRole(input));
    if (input.hasManagerDocs) roles.set("manager", inferredManagerRole(input));
  }

  const sorted = [...roles.values()].sort((left, right) => {
    const rank = (role: string) =>
      role === "worker" ? 0 : role === "auditor" ? 1 : role === "manager" ? 2 : 10;
    return rank(left.role) - rank(right.role) || left.role.localeCompare(right.role);
  });
  return { roles: sorted, roleCount: sorted.length };
}

export function roleManifestForApp(app: MarketplaceAppDefinition) {
  return normalizeMarketplaceRoleManifest({
    appSlug: app.slug,
    appName: app.name,
    app,
  });
}

export function findMarketplaceRole(
  app: MarketplaceAppDefinition,
  role: string,
) {
  return roleManifestForApp(app).roles.find((entry) => entry.role === role) ?? null;
}

export function roleLabel(role: string) {
  if (role === "worker") return "Worker / Operator";
  if (role === "auditor") return "Auditor";
  if (role === "manager") return "Manager";
  return titleize(role);
}

export function roleRuntimeOutputPath(role: string) {
  if (role === "worker" || role === "auditor" || role === "manager") {
    return `workspace_files/${role}/`;
  }
  return null;
}

function normalizeExplicitRole(
  input: NormalizeInput,
  raw: unknown,
): MarketplaceRoleManifestEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const role = stringOrNull(value.role) ?? stringOrNull(value.id);
  if (!role) return null;
  return normalizeRoleRuntimeState({
    role: normalizeRoleId(role),
    label: stringOrNull(value.label) ?? roleLabel(role),
    purpose: stringOrNull(value.purpose) ?? `Use ${input.appName} as ${roleLabel(role)}.`,
    docsSourcePath: stringOrNull(value.docsSourcePath),
    runtimeOutputPath: stringOrNull(value.runtimeOutputPath) ?? roleRuntimeOutputPath(role),
    canWrite: normalizeCanWrite(value.canWrite),
    readOnly: value.readOnly === true,
    approvalRequiredFor: stringArray(value.approvalRequiredFor),
    blockedActions: stringArray(value.blockedActions),
    required: value.required === true,
    installAfterSetup: value.installAfterSetup !== false,
    recommendedAgentName:
      stringOrNull(value.recommendedAgentName) ?? `${input.appName} ${roleLabel(role)}`,
    recommendedAgentType: stringOrNull(value.recommendedAgentType),
    installable: value.installable !== false,
    notInstallableReason: stringOrNull(value.notInstallableReason),
    source: "explicit",
  }, input);
}

function inferredWorkerRole(input: NormalizeInput): MarketplaceRoleManifestEntry {
  return normalizeRoleRuntimeState({
    role: "worker",
    label: "Worker / Operator",
    purpose: "Operate the app and perform approved work.",
    docsSourcePath: ".clawchat/agent-docs-source/",
    runtimeOutputPath: roleRuntimeOutputPath("worker"),
    canWrite: true,
    readOnly: false,
    approvalRequiredFor: ["writes", "bulk jobs", "status changes"],
    blockedActions: ["secrets", "destructive database actions"],
    required: false,
    installAfterSetup: true,
    recommendedAgentName: `${input.appName} Worker`,
    recommendedAgentType: "worker",
    installable: true,
    notInstallableReason: null,
    source: "inferred",
  });
}

function inferredAuditorRole(input: NormalizeInput): MarketplaceRoleManifestEntry {
  return normalizeRoleRuntimeState({
    role: "auditor",
    label: "Auditor",
    purpose: "Independently review outputs, evidence, and workflow quality.",
    docsSourcePath: ".clawchat/auditor-docs-source/",
    runtimeOutputPath: roleRuntimeOutputPath("auditor"),
    canWrite: "audit writeback only",
    readOnly: false,
    approvalRequiredFor: ["mutating operational records"],
    blockedActions: ["operating as worker", "changing workflow status fields"],
    required: false,
    installAfterSetup: true,
    recommendedAgentName: `${input.appName} Auditor`,
    recommendedAgentType: "auditor",
    installable: true,
    notInstallableReason: null,
    source: "inferred",
  });
}

function inferredManagerRole(input: NormalizeInput): MarketplaceRoleManifestEntry {
  return normalizeRoleRuntimeState({
    role: "manager",
    label: "Manager",
    purpose:
      "Coordinate available app roles, assign work, interpret results, handle approvals, and decide next actions.",
    docsSourcePath: ".clawchat/manager-docs-source/",
    runtimeOutputPath: roleRuntimeOutputPath("manager"),
    canWrite: "coordination and approved management writeback only",
    readOnly: false,
    approvalRequiredFor: ["delegation changes", "approval decisions", "status changes"],
    blockedActions: ["operating as worker", "overriding auditor independence", "bypassing approval gates"],
    required: false,
    installAfterSetup: true,
    recommendedAgentName: `${input.appName} Manager`,
    recommendedAgentType: "manager",
    installable: true,
    notInstallableReason: null,
    source: "inferred",
  }, input);
}

function defaultWorkerRole(input: NormalizeInput): MarketplaceRoleManifestEntry {
  return { ...inferredWorkerRole(input), source: "default", docsSourcePath: null };
}

function defaultAuditorRole(input: NormalizeInput): MarketplaceRoleManifestEntry {
  return { ...inferredAuditorRole(input), source: "default", docsSourcePath: null };
}

function normalizeRoleRuntimeState(
  role: Omit<MarketplaceRoleManifestEntry, "installable" | "notInstallableReason"> &
    Partial<Pick<MarketplaceRoleManifestEntry, "installable" | "notInstallableReason">>,
  input?: NormalizeInput,
): MarketplaceRoleManifestEntry {
  const hasSupportedRuntime =
    ALWAYS_SUPPORTED_RUNTIME_ROLES.has(role.role) ||
    (role.role === "manager" && input?.hasManagerDocs === true);
  const installable = role.installable === false ? false : hasSupportedRuntime;
  return {
    ...role,
    runtimeOutputPath: role.runtimeOutputPath ?? roleRuntimeOutputPath(role.role),
    installable,
    notInstallableReason: installable
      ? null
      : role.notInstallableReason ?? `No runtime output is available for role \`${role.role}\`.`,
  };
}

function normalizeRoleId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeCanWrite(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && value.trim()) return value.trim();
  return false;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim())
    : [];
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function titleize(value: string) {
  return normalizeRoleId(value)
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
