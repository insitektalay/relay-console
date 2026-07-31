"use client"

import {
  capabilitiesFromAutonomyPolicy,
  DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
  getPackQuality,
  linkcrestSyncFromApp,
  marketplaceAppUsesConnectorOAuth,
  marketplaceAppUsesNativeConnector,
  marketplacePolicyActions,
  marketplaceRoles,
  ordinaryMarketplaceApprovalProfiles,
  runtimeProfileFromApp,
} from "@/components/marketplace/marketplace-domain"
import { dedupeMarketplaceInstalls } from "@/components/marketplace/marketplace-install-controls"
import { sdk } from "@/lib/sdk"
import type {
  LocalAppAutonomyPolicy,
  MarketplaceApp,
  MarketplaceConnection,
  MarketplaceInstall,
} from "@clawchat/contracts"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

export function useMarketplaceDetailData({
  approvalProfileId,
  auditEvents,
  autonomyPolicy,
  canManageMarketplace,
  connectionAuthType,
  connectionId,
  connections,
  installs,
  selectedApp,
  selectedAppBetaUnavailable,
  selectedCapabilities,
  workspaceId,
}: {
  approvalProfileId: string
  auditEvents: Array<Record<string, unknown>>
  autonomyPolicy: LocalAppAutonomyPolicy
  canManageMarketplace: boolean
  connectionAuthType: string
  connectionId: string
  connections: MarketplaceConnection[]
  installs: MarketplaceInstall[]
  selectedApp: MarketplaceApp | null
  selectedAppBetaUnavailable: boolean
  selectedCapabilities: Set<string>
  workspaceId: string
}) {
  const toolRequestsQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "tool-requests", selectedApp?.slug],
    queryFn: () =>
      sdk.marketplace.toolRequests(workspaceId, {
        appSlug: selectedApp?.slug,
      }),
    enabled: Boolean(canManageMarketplace && selectedApp?.slug),
  })
  const selectedPackQuality = selectedApp ? getPackQuality(selectedApp) : null
  const selectedAppConnections = connections.filter(
    (connection) => connection.appSlug === selectedApp?.slug
  )
  const selectedAppConnectionKey = selectedAppConnections
    .map((connection) => connection.id)
    .join("|")
  const selectedAppConnection = selectedAppConnections.find(
    (connection) => connection.id === connectionId
  )
  const selectedConnectionRequiresDevice =
    selectedAppConnection?.executionAuthority === "swift"
  const selectedAppInstalls = useMemo(
    () => installs.filter((install) => install.appSlug === selectedApp?.slug),
    [installs, selectedApp?.slug]
  )
  const selectedAppActiveInstalls = useMemo(
    () =>
      selectedAppInstalls.filter(
        (install) => install.installStatus !== "removed"
      ),
    [selectedAppInstalls]
  )
  const defaultOperatorAgentId = useMemo(
    () =>
      dedupeMarketplaceInstalls(selectedAppActiveInstalls).find((item) =>
        ["worker", "operator"].includes(item.install.role)
      )?.install.agentId ?? "",
    [selectedAppActiveInstalls]
  )
  const existingOperatorInstalled = Boolean(defaultOperatorAgentId)
  const selectedAppRoles = useMemo(
    () => marketplaceRoles(selectedApp),
    [selectedApp]
  )
  const linkcrestPolicySync = linkcrestSyncFromApp(selectedApp)
  const isLinkCrestApp =
    selectedApp?.sourceType === "local_repo" &&
    `${selectedApp.slug} ${selectedApp.name}`
      .toLowerCase()
      .includes("linkcrest")
  const selectedRuntimeProfile = runtimeProfileFromApp(selectedApp)
  const linkcrestOpenClawStatus =
    selectedApp?.sourceMetadata?.linkcrestOpenClawStatus &&
    typeof selectedApp.sourceMetadata.linkcrestOpenClawStatus === "object"
      ? (selectedApp.sourceMetadata.linkcrestOpenClawStatus as Record<
          string,
          unknown
        >)
      : null
  const marketplaceAudit = auditEvents.filter((event) => {
    const eventType = String(event.eventType ?? "")
    const metadata = (event.metadata ?? {}) as Record<string, unknown>
    return (
      eventType.startsWith("marketplace.") &&
      (!selectedApp ||
        metadata.appSlug === selectedApp.slug ||
        event.resourceId === selectedApp.slug)
    )
  })
  const effectiveCapabilities = useMemo(() => {
    if (!selectedApp) return []
    if (selectedCapabilities.size) return Array.from(selectedCapabilities)
    if (selectedApp.sourceType === "local_repo") {
      const valid = new Set(
        selectedApp.capabilities.map((capability) => capability.id)
      )
      return capabilitiesFromAutonomyPolicy(autonomyPolicy).filter((id) =>
        valid.has(id)
      )
    }
    return selectedApp.capabilities
      .filter((capability) => capability.defaultEnabled)
      .map((capability) => capability.id)
  }, [autonomyPolicy, selectedApp, selectedCapabilities])
  const selectedApprovalProfile =
    selectedApp?.approvalProfiles.find(
      (profile) => profile.id === approvalProfileId
    ) ??
    selectedApp?.approvalProfiles.find((profile) => profile.defaultSelected) ??
    selectedApp?.approvalProfiles[0] ??
    null
  const ordinaryApprovalProfiles = useMemo(
    () =>
      ordinaryMarketplaceApprovalProfiles(selectedApp?.approvalProfiles ?? []),
    [selectedApp?.approvalProfiles]
  )
  const dangerousApprovalProfile = selectedApp?.approvalProfiles.find(
    (profile) => profile.id === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID
  )
  const selectedPolicy = useMemo(() => {
    if (!selectedApp) return null
    const actions = marketplacePolicyActions(
      selectedApp,
      selectedApprovalProfile
    )
    return {
      profileId: selectedApprovalProfile?.id ?? selectedApp.approvalProfile,
      profileLabel: selectedApprovalProfile?.label ?? "Default",
      profileDescription:
        selectedApprovalProfile?.description ??
        "Use the marketplace default approval policy for this app.",
      riskLevel: selectedApp.riskLevel,
      ...actions,
    }
  }, [selectedApp, selectedApprovalProfile])
  const selectedAppNeedsUserOAuth = selectedApp?.slug === "x"
  const selectedAppUsesConnectorOAuth =
    marketplaceAppUsesConnectorOAuth(selectedApp)
  const selectedAppUsesNativeConnector =
    marketplaceAppUsesNativeConnector(selectedApp)
  const selectedXConnection = selectedAppNeedsUserOAuth
    ? selectedAppConnections.find(
        (connection) => connection.id === connectionId
      )
    : undefined
  const selectedXConnectionReady = Boolean(
    selectedXConnection?.status === "ready" &&
    selectedXConnection.executionAuthority !== "swift" &&
    selectedXConnection.metadata?.tokenStatus !== "disconnected"
  )
  const selectedXConnectedNotInstalled = Boolean(
    selectedAppNeedsUserOAuth &&
    connectionId &&
    selectedXConnectionReady &&
    !selectedAppActiveInstalls.length
  )
  const xOAuthConfigQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "x-oauth-config"],
    queryFn: () => sdk.marketplace.xOAuthConfig(workspaceId),
    enabled:
      canManageMarketplace &&
      selectedAppNeedsUserOAuth &&
      !selectedAppBetaUnavailable,
  })
  const connectorOAuthConfigQuery = useQuery({
    queryKey: [
      "marketplace",
      workspaceId,
      selectedApp?.slug,
      "connector-oauth-config",
    ],
    queryFn: () =>
      sdk.marketplace.connectorOAuthConfig(workspaceId, selectedApp!.slug),
    enabled:
      canManageMarketplace &&
      selectedAppUsesConnectorOAuth &&
      !selectedAppBetaUnavailable,
  })
  const selectedConnectorConnection = selectedAppUsesNativeConnector
    ? selectedAppConnections.find(
        (connection) => connection.id === connectionId
      )
    : undefined
  const connectorHealthQuery = useQuery({
    queryKey: [
      "marketplace",
      workspaceId,
      selectedApp?.slug,
      connectionId,
      "connector-health",
    ],
    queryFn: () =>
      sdk.marketplace.connectorHealth(
        workspaceId,
        selectedApp!.slug,
        connectionId
      ),
    enabled:
      selectedAppUsesNativeConnector &&
      canManageMarketplace &&
      Boolean(connectionId) &&
      !selectedConnectionRequiresDevice &&
      !selectedAppBetaUnavailable,
  })
  const visibleCredentialRequirements = useMemo(
    () =>
      selectedApp?.credentialRequirements.filter(
        (credential) =>
          (!credential.requiredForAuthTypes?.length ||
            credential.requiredForAuthTypes.includes(connectionAuthType)) &&
          !(
            selectedApp.slug === "outlook" &&
            (credential.name === "MICROSOFT_AUTHORITY_MODE" ||
              credential.name === "MICROSOFT_TENANT_ID")
          )
      ) ?? [],
    [connectionAuthType, selectedApp]
  )

  return {
    connectorHealthQuery,
    connectorOAuthConfigQuery,
    dangerousApprovalProfile,
    defaultOperatorAgentId,
    effectiveCapabilities,
    existingOperatorInstalled,
    isLinkCrestApp,
    linkcrestOpenClawStatus,
    linkcrestPolicySync,
    marketplaceAudit,
    ordinaryApprovalProfiles,
    selectedAppActiveInstalls,
    selectedAppConnection,
    selectedAppConnectionKey,
    selectedAppConnections,
    selectedAppInstalls,
    selectedAppNeedsUserOAuth,
    selectedAppRoles,
    selectedAppUsesConnectorOAuth,
    selectedAppUsesNativeConnector,
    selectedApprovalProfile,
    selectedConnectionRequiresDevice,
    selectedConnectorConnection,
    selectedPackQuality,
    selectedPolicy,
    selectedRuntimeProfile,
    selectedXConnectedNotInstalled,
    selectedXConnection,
    selectedXConnectionReady,
    toolRequestsQuery,
    visibleCredentialRequirements,
    xOAuthConfigQuery,
  }
}
