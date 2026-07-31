"use client"

import type {
  Agent,
  LinkCrestPolicySyncStatus,
  LocalAppAutonomyMode,
  LocalAppAutonomyPolicy,
  MarketplaceApp,
  MarketplaceApprovalProfile,
  MarketplaceCatalog,
  MarketplaceCategory,
  MarketplaceConnection,
  MarketplaceInstall,
  MarketplaceInstallRole,
  MarketplaceLocalRepoSourceHost,
  MarketplaceRoleManifestEntry,
  MarketplaceRiskLevel,
  MarketplaceRuntimeFormat,
} from "@clawchat/contracts"
import { MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY } from "@clawchat/contracts"

export type MarketplaceView =
  | "all"
  | "external"
  | "local"
  | "connections"
  | "installed"
  | "review"

export type DocumentationAutomationMode =
  | "manual_review"
  | "auto_apply_safe"
  | "auto_apply_full"

export const DEFAULT_PACK_QUALITY: MarketplaceApp["packQuality"] = {
  level: "generated_draft",
  publicationStatus: "review_needed",
  label: "Generated draft",
  description:
    "Pack Factory generated first-pass operating pack. Review before high-risk use.",
  confidence: "low",
  reviewed: false,
  source: "pack_factory",
}

export function getPackQuality(app: MarketplaceApp) {
  return app.packQuality ?? DEFAULT_PACK_QUALITY
}

export function hermesRouterTargetRoot(
  role: MarketplaceInstallRole,
  appSlug?: string
) {
  if (role === "auditor") return `skills/${appSlug ?? "<app>"}-auditor-router`
  if (role === "manager") return `skills/${appSlug ?? "<app>"}-manager-router`
  return `skills/${appSlug ?? "<app>"}-router`
}

export function marketplaceRoleLabel(role: string) {
  if (role === "worker") return "Worker / Operator"
  if (role === "auditor") return "Auditor"
  if (role === "manager") return "Manager"
  return role
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

export const LOCAL_AUTONOMY_MODE_LABELS: Record<LocalAppAutonomyMode, string> =
  {
    safe_default: "Safe default",
    internal_write: "Internal write",
    supervised_external: "Supervised external",
    dangerously_skip_permissions: "Dangerously skip permissions",
    custom_policy: "Custom policy",
  }

export const DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID =
  "dangerously_skip_permissions"

export const DANGEROUS_MARKETPLACE_POLICY_WARNING =
  "This advanced policy removes Relay Console per-action approval for every selected provider-supported action. Workspace and connection ownership, provider-granted authority, selected capabilities, blocked actions, fixed origins, request bounds, rate limits, audit evidence, and secret non-exposure still apply."

export function ordinaryMarketplaceApprovalProfiles(
  profiles: MarketplaceApprovalProfile[]
) {
  return profiles.filter(
    (profile) => profile.id !== DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID
  )
}

export function marketplacePolicyActions(
  app: Pick<
    MarketplaceApp,
    "allowedActions" | "approvalRequiredActions" | "blockedActions"
  >,
  profile: MarketplaceApprovalProfile | null | undefined
) {
  return {
    allowedActions: profile?.allowedActions ?? app.allowedActions,
    approvalRequiredActions:
      profile?.approvalRequiredActions ?? app.approvalRequiredActions,
    blockedActions: profile?.blockedActions ?? app.blockedActions,
  }
}

export const EMPTY_MARKETPLACE_CONNECTIONS: MarketplaceConnection[] = []
export const EMPTY_MARKETPLACE_INSTALLS: MarketplaceInstall[] = []
export const EMPTY_MARKETPLACE_CATALOG: MarketplaceCatalog = {
  categories: [],
  apps: [],
}

export type MarketplaceAgentRecoveryRuntime = "openclaw" | "hermes"

export type MarketplaceAgentRecoveryRequest = {
  runtimeType: MarketplaceAgentRecoveryRuntime
  appName: string
  appSlug: string
}

export type MarketplaceScreenProps = {
  workspaceId: string
  agents: Agent[]
  canManageMarketplace?: boolean
  search: string
  category: MarketplaceCategory | "all"
  riskFilter: MarketplaceRiskLevel | "all"
  initialSelectedAppSlug?: string | null
  onSearchChange?: (search: string) => void
  onCategoryChange?: (category: MarketplaceCategory | "all") => void
  onSelectedAppSlugChange?: (slug: string | null) => void
  onConnectionComplete?: (input: {
    appName: string
    operatorAgentId: string
    message: string
  }) => Promise<void> | void
  onCreateCompatibleAgent?: (input: MarketplaceAgentRecoveryRequest) => void
  onOpenRuntimePairing?: (input: MarketplaceAgentRecoveryRequest) => void
}

export function assertMarketplaceManagementAllowed(canManage: boolean) {
  if (!canManage) {
    throw new Error(
      "Only workspace owners and admins can manage Marketplace apps."
    )
  }
}

export const MARKETPLACE_BETA_SAFETY_NOTICE = {
  title: "Application availability",
  body: "All Marketplace apps are shown. Connect is offered when an app's authentication setup is ready; live-provider verification is tracked separately.",
}

export const CONNECTOR_OAUTH_APP_SLUGS = new Set([
  "outlook",
  "linkedin",
  "slack",
  "bynder",
  "canto",
  "frontify",
  "asset-bank",
])

export const RELAY_OWNED_CONNECTOR_OAUTH_TYPES = new Set([
  "relay_owned_github_app",
])

export function marketplaceAppUsesConnectorOAuth(
  app: Pick<MarketplaceApp, "slug" | "connectionTypes"> | null | undefined
) {
  if (!app) return false
  return (
    CONNECTOR_OAUTH_APP_SLUGS.has(app.slug) ||
    app.connectionTypes.includes("oauth_connector") ||
    app.connectionTypes.includes("oauth1_xauth") ||
    app.connectionTypes.some((type) =>
      RELAY_OWNED_CONNECTOR_OAUTH_TYPES.has(type)
    )
  )
}

export function marketplaceConnectorOAuthReturnTo(appSlug: string) {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set("marketplace_app", appSlug)
  return url.toString()
}

export function marketplaceAppUsesNativeConnector(
  app: Pick<MarketplaceApp, "slug" | "connectionTypes"> | null | undefined
) {
  if (!app) return false
  return (
    app.slug === "exa" ||
    marketplaceAppUsesConnectorOAuth(app) ||
    app.connectionTypes.some((type) => type.endsWith("_connector"))
  )
}

export type MarketplaceBetaGate = {
  betaMode?: boolean
  available?: boolean
  reason?: string
  hiddenFromCatalog?: boolean
  message?: string | null
}

export function marketplaceBetaGateForApp(
  app: MarketplaceApp | null | undefined
): MarketplaceBetaGate | null {
  const raw = app?.sourceMetadata?.marketplaceBetaGate
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as MarketplaceBetaGate)
    : null
}

export function marketplaceReleaseForApp(
  app: MarketplaceApp | null | undefined
) {
  return app?.release ?? null
}

export function isMarketplaceConnectEligible(
  app: MarketplaceApp | null | undefined
) {
  if (!app) return false
  const release = marketplaceReleaseForApp(app)
  if (release) {
    return release.connectEligible
  }
  return app.sourceType === "local_repo" || app.availability === "available"
}

export function isMarketplaceBetaUnavailable(
  app: MarketplaceApp | null | undefined
) {
  if (app?.release && !isMarketplaceConnectEligible(app)) return true
  const gate = marketplaceBetaGateForApp(app)
  return Boolean(gate?.betaMode && gate.available === false)
}

export function marketplaceBetaUnavailableMessage(
  app: MarketplaceApp | null | undefined
) {
  return (
    (app?.release && !isMarketplaceConnectEligible(app)
      ? `${app.release.label}. ${app.release.reason}`
      : null) ||
    marketplaceBetaGateForApp(app)?.message ||
    "This app is not included in the current Relay Console beta."
  )
}

export const externalPolicyKeys = [
  "browserNavigation",
  "externalSearch",
  "publicFormFill",
  "publicFormSubmit",
  "emailDraft",
  "emailSend",
  "accountCreation",
  "credentialUse",
  "externalPublishing",
  "backlinkVerification",
  "indexChecking",
] as const

export const lifecyclePolicyKeys = [
  "markContacted",
  "markSubmitted",
  "markLive",
  "markIndexed",
] as const

export function defaultAutonomyPolicy(
  mode: LocalAppAutonomyMode = "safe_default"
): LocalAppAutonomyPolicy {
  const internalWrite = true
  const externalDefault =
    mode === "dangerously_skip_permissions"
      ? "allowed"
      : mode === "supervised_external"
        ? "approval_required"
        : "disabled"
  const lifecycleDefault =
    mode === "dangerously_skip_permissions"
      ? "allowed_with_evidence"
      : mode === "supervised_external"
        ? "approval_required"
        : "disabled"
  return {
    mode,
    internal: {
      readRecords: true,
      draftRecords: true,
      writeInternalRecords: internalWrite,
      createTasks: internalWrite,
      updateTasks: internalWrite,
      updateInternalStatuses: internalWrite,
    },
    external: Object.fromEntries(
      externalPolicyKeys.map((key) => [key, externalDefault])
    ) as LocalAppAutonomyPolicy["external"],
    lifecycleStatus: Object.fromEntries(
      lifecyclePolicyKeys.map((key) => [key, lifecycleDefault])
    ) as LocalAppAutonomyPolicy["lifecycleStatus"],
    hardStops: {
      payments: true,
      destructiveDataLoss: true,
      exposeSecrets: true,
      captchaBypass: true,
      legalCommitments: true,
    },
    evidenceRequired: true,
    staleContextPolicy:
      mode === "dangerously_skip_permissions"
        ? "current_policy_supersedes_old_chat"
        : "chat_history_may_restrict",
  }
}

export function policyFromApp(
  app: MarketplaceApp | null
): LocalAppAutonomyPolicy {
  const raw = app?.sourceMetadata?.autonomyPolicy
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return {
      ...defaultAutonomyPolicy((raw as LocalAppAutonomyPolicy).mode),
      ...(raw as LocalAppAutonomyPolicy),
    }
  }
  return defaultAutonomyPolicy()
}

export function linkcrestSyncFromApp(
  app: MarketplaceApp | null
): LinkCrestPolicySyncStatus | null {
  const raw = app?.sourceMetadata?.linkcrestPolicySync
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as LinkCrestPolicySyncStatus)
    : null
}

export function capabilitiesFromAutonomyPolicy(policy: LocalAppAutonomyPolicy) {
  const capabilities = new Set<string>()
  if (policy.internal.readRecords) capabilities.add("read")
  if (policy.internal.draftRecords) capabilities.add("draft")
  if (policy.internal.writeInternalRecords) capabilities.add("write_internal")
  const externalMap: Record<string, string> = {
    browserNavigation: "browser_external",
    externalSearch: "external_search",
    publicFormFill: "form_fill",
    publicFormSubmit: "form_submit",
    emailDraft: "email_draft",
    emailSend: "email_send",
    accountCreation: "account_create",
    credentialUse: "credential_use",
    externalPublishing: "external_publish",
    backlinkVerification: "backlink_verify",
    indexChecking: "index_check",
  }
  for (const key of externalPolicyKeys) {
    if (policy.external[key] !== "disabled") capabilities.add(externalMap[key])
  }
  if (
    policy.lifecycleStatus.markContacted !== "disabled" ||
    policy.lifecycleStatus.markSubmitted !== "disabled"
  ) {
    capabilities.add("lifecycle_contacted_submitted")
  }
  if (
    policy.lifecycleStatus.markLive !== "disabled" ||
    policy.lifecycleStatus.markIndexed !== "disabled"
  ) {
    capabilities.add("lifecycle_live_indexed")
  }
  return Array.from(capabilities)
}

export function marketplaceRoles(
  app: MarketplaceApp | null
): MarketplaceRoleManifestEntry[] {
  const roles = app?.roleManifest?.roles ?? []
  return roles.length
    ? roles
    : [
        {
          role: "worker",
          label: "Worker / Operator",
          purpose: "Operate the app and perform approved work.",
          docsSourcePath: null,
          runtimeOutputPath: "workspace_files/worker/",
          canWrite: true,
          readOnly: false,
          approvalRequiredFor: [],
          blockedActions: [],
          required: false,
          installAfterSetup: true,
          recommendedAgentName: null,
          recommendedAgentType: "worker",
          installable: true,
          notInstallableReason: null,
          source: "default",
        },
      ]
}

export function buildLocalRepoConnectionMetadata(app: MarketplaceApp) {
  const source = (app.sourceMetadata ?? {}) as Record<string, unknown>
  const lifecycle =
    source.lifecycle &&
    typeof source.lifecycle === "object" &&
    !Array.isArray(source.lifecycle)
      ? (source.lifecycle as Record<string, unknown>)
      : {}
  return {
    appSlug: app.slug,
    sourceHostType: source.sourceHostType ?? null,
    sourceHostId: source.sourceHostId ?? null,
    bridgeDeviceId: source.bridgeDeviceId ?? null,
    runtimeBindingId: source.runtimeBindingId ?? null,
    sourceHostLabel: source.sourceHostLabel ?? null,
    runtimeType: source.runtimeType ?? null,
    localRepoPath: source.repoPath ?? null,
    localAppUrl: source.localAppUrl ?? null,
    localApiUrl: source.localApiUrl ?? null,
    lifecycle,
    allowRuntimeHostStart: lifecycle.allowRuntimeHostStart === true,
    lifecycleApprovalPolicy:
      typeof lifecycle.approvalPolicy === "string"
        ? lifecycle.approvalPolicy
        : "approval_required_for_start_or_restart",
  }
}

export function runtimeProfileFromApp(app: MarketplaceApp | null) {
  const source = (app?.sourceMetadata ?? {}) as Record<string, unknown>
  const profile =
    source.runtimeProfile &&
    typeof source.runtimeProfile === "object" &&
    !Array.isArray(source.runtimeProfile)
      ? (source.runtimeProfile as Record<string, unknown>)
      : {}
  const isLinkCrest = `${app?.slug ?? ""} ${app?.name ?? ""}`
    .toLowerCase()
    .includes("linkcrest")
  return {
    repoPath: String(
      profile.repoPath ??
        source.repoPath ??
        (isLinkCrest ? "/home/alexkerss/repos/LinkCrest" : "")
    ),
    appUrl: String(
      profile.appUrl ??
        source.localAppUrl ??
        (isLinkCrest ? "http://localhost:3052" : "")
    ),
    agentApiUrl: String(
      profile.agentApiUrl ??
        (isLinkCrest ? "http://localhost:3052/api/openclaw" : "")
    ),
    startCommand: String(
      profile.startCommand ?? (isLinkCrest ? "pnpm dev" : "")
    ),
    healthCheckUrl: String(
      profile.healthCheckUrl ??
        source.localAppUrl ??
        (isLinkCrest ? "http://localhost:3052" : "")
    ),
    backendHealthCheckUrl: String(
      profile.backendHealthCheckUrl ??
        (isLinkCrest ? "http://localhost:3210" : "")
    ),
    autoStartAllowed:
      profile.autoStartAllowed === true ||
      (source.lifecycle &&
        typeof source.lifecycle === "object" &&
        !Array.isArray(source.lifecycle) &&
        (source.lifecycle as Record<string, unknown>).allowRuntimeHostStart ===
          true),
    hardStopConditions: Array.isArray(profile.hardStopConditions)
      ? profile.hardStopConditions.map(String)
      : isLinkCrest
        ? [
            "install",
            "migration",
            "reset",
            "destructive data loss",
            "secret exposure",
            "payment",
            "CAPTCHA bypass",
            "legal commitment",
            "unknown interactive prompt",
          ]
        : [],
    expectedPorts: Array.isArray(profile.expectedPorts)
      ? profile.expectedPorts.map(String)
      : isLinkCrest
        ? ["3052", "3210"]
        : [],
    sourceHostId: String(
      profile.sourceHostId ?? source.sourceHostId ?? source.bridgeDeviceId ?? ""
    ),
  }
}

export function getMarketplaceAppStatus({
  app,
  connection,
  installedCount,
}: {
  app: MarketplaceApp
  connection?: MarketplaceConnection
  installedCount: number
}) {
  if (app.release && !isMarketplaceConnectEligible(app)) {
    return app.release.label
  }
  if (isMarketplaceBetaUnavailable(app)) return "Not in beta"
  if (connection?.executionAuthority === "swift") return "Mac required"
  const verification = connection?.metadata?.connectionVerification
  const customerStatus =
    verification && typeof verification === "object"
      ? String((verification as Record<string, unknown>).customerStatus ?? "")
      : ""
  if (customerStatus === "configured_unverified")
    return "Configured — unverified"
  if (customerStatus === "credentials_rejected") return "Credentials required"
  return installedCount
    ? "Installed"
    : connection
      ? "Connected"
      : (app.release?.label ??
        (app.availability === "available" ? "Available" : "Coming later"))
}

export function preferredMarketplaceConnection(
  connections: MarketplaceConnection[]
) {
  return (
    connections.find(
      (connection) => connection.executionAuthority !== "swift"
    ) ?? connections[0]
  )
}

export type SourceHostDisplayStatus =
  | "READY"
  | "OFFLINE"
  | "NEEDS BRIDGE UPDATE"

export function sourceHostDisplayStatus(
  host: MarketplaceLocalRepoSourceHost | null | undefined
): SourceHostDisplayStatus {
  if (!host) return "OFFLINE"
  if (host.status !== "available") return "OFFLINE"
  if (!host.supportsLocalRepoDocsRead) {
    return "NEEDS BRIDGE UPDATE"
  }
  return "READY"
}

export function sourceHostKindLabel(host: MarketplaceLocalRepoSourceHost) {
  if (host.type === "hermes_bridge") return "Hermes bridge"
  if (host.type === "openclaw_bridge") return "OpenClaw bridge"
  return "Runtime host"
}

export function sourceHostCapabilitiesLabel(
  host: MarketplaceLocalRepoSourceHost | null | undefined
) {
  const capabilities = host?.capabilities?.filter(Boolean) ?? []
  const orderedCapabilities = capabilities.includes(
    MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY
  )
    ? [
        MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY,
        ...capabilities.filter(
          (capability) =>
            capability !== MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY
        ),
      ]
    : capabilities
  return orderedCapabilities.length ? orderedCapabilities.join(", ") : "unknown"
}

export function sourceHostDisplayName(
  host: MarketplaceLocalRepoSourceHost | null | undefined,
  fallback: unknown
) {
  if (host) return `${sourceHostKindLabel(host)} / ${host.label}`
  return String(fallback ?? "Source host not selected")
}

export function sourceHostOptionLabel(host: MarketplaceLocalRepoSourceHost) {
  const status = sourceHostDisplayStatus(host)
  const capabilities = sourceHostCapabilitiesLabel(host)
  return `${sourceHostDisplayName(host, host.label)} · ${status} · ${capabilities}`
}

export function isMarketplaceAgentRecoveryRuntime(
  value: MarketplaceRuntimeFormat
): value is MarketplaceAgentRecoveryRuntime {
  return value === "openclaw" || value === "hermes"
}

export function findSourceHostForMetadata(
  sourceHosts: MarketplaceLocalRepoSourceHost[],
  source: Record<string, unknown>
) {
  const sourceHostId = String(source.sourceHostId ?? "")
  const bridgeDeviceId = String(source.bridgeDeviceId ?? "")
  if (!sourceHostId && !bridgeDeviceId) return null
  return (
    sourceHosts.find(
      (host) =>
        host.id === sourceHostId ||
        host.bridgeDeviceId === bridgeDeviceId ||
        host.id === bridgeDeviceId
    ) ?? null
  )
}
