"use client"

import { AppLogo } from "@/components/marketplace/app-logo"
import {
  AddAppChoice,
  ConnectionsOverview,
  InstalledPacksOverview,
  LocalAppsEmptyState,
  LocalAppsSection,
  MarketplaceBetaSafetyNotice,
  MarketplaceCatalogStatistic,
  MarketplaceAppGrid,
  MarketplaceReadOnlyDetails,
  MarketplaceUnavailableNotice,
  MarketplaceViewTabs,
  ReviewEmptyState,
  ReviewUpdatesOverview,
} from "@/components/marketplace/marketplace-catalog-ui"
import {
  ApiKeyConnectorStatusCard,
  ConnectorOAuthSetupNotice,
  OutlookCapabilitySelector,
  XOAuthSetupNotice,
  marketplaceSummaryBullets,
} from "@/components/marketplace/marketplace-connector-setup"
import type {
  MarketplaceScreenProps,
  MarketplaceView,
} from "@/components/marketplace/marketplace-domain"
import {
  DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
  DANGEROUS_MARKETPLACE_POLICY_WARNING,
  LOCAL_AUTONOMY_MODE_LABELS,
  RELAY_OWNED_CONNECTOR_OAUTH_TYPES,
  assertMarketplaceManagementAllowed,
  defaultAutonomyPolicy,
  externalPolicyKeys,
  getMarketplaceAppStatus,
  getPackQuality,
  hermesRouterTargetRoot,
  lifecyclePolicyKeys,
  marketplaceConnectorOAuthReturnTo,
  policyFromApp,
  preferredMarketplaceConnection,
} from "@/components/marketplace/marketplace-domain"
import {
  ExistingInstallsPanel,
  NeededToolsPanel,
  PolicyPanel,
  PolicyToggleGroup,
  RemoveInstallDialog,
  SupportAgentPicker,
} from "@/components/marketplace/marketplace-install-controls"
import {
  AgentAvatar,
  AgentDocsStatusPill,
  AppSummaryBullet,
  DocumentationHistoryPanel,
  LocalAppForm,
  LocalRepoDocsWorkspace,
  SourcePanel,
  StepBadge,
} from "@/components/marketplace/marketplace-local-docs"
import {
  AuditPanel,
  GeneratedPackReviewPanel,
  InstallResultPanel,
  MarketplaceDiagnostics,
  NoResultsCard,
  PackPreview,
  SecretCredentialInput,
  StatusPill,
  credentialDisplayLabel,
  credentialHelpUrl,
  marketplaceRuntimeForAgent,
  policySummary,
  runtimeLabel,
} from "@/components/marketplace/marketplace-preview-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useMarketplaceAgentCompatibility } from "@/features/marketplace/use-marketplace-agent-compatibility"
import { useMarketplaceCatalogData } from "@/features/marketplace/use-marketplace-catalog-data"
import { useMarketplaceConnectApp } from "@/features/marketplace/use-marketplace-connect-app"
import { useMarketplaceConnectionActions } from "@/features/marketplace/use-marketplace-connection-actions"
import { useMarketplaceConnectionFormState } from "@/features/marketplace/use-marketplace-connection-form-state"
import { useMarketplaceDetailData } from "@/features/marketplace/use-marketplace-detail-data"
import { useMarketplaceGeneratedPackActions } from "@/features/marketplace/use-marketplace-generated-pack-actions"
import { useMarketplaceLocalActions } from "@/features/marketplace/use-marketplace-local-actions"
import { useMarketplaceViewData } from "@/features/marketplace/use-marketplace-view-data"
import {
  MARKETPLACE_CATEGORY_LABELS,
  MARKETPLACE_CATEGORY_ORDER,
} from "@/lib/marketplace-taxonomy"
import { cn } from "@/lib/utils"
import type {
  AutoConnectLocalAppResult,
  LocalAppAutonomyMode,
  LocalAppAutonomyPolicy,
  MarketplaceInstall,
  MarketplaceInstallResult,
  MarketplaceRuntimeFormat,
} from "@clawchat/contracts"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
export {
  outlookMissingScopeRequirements,
  outlookProviderCapabilitiesFromScopes,
  outlookRuntimeToolsForCapabilities,
} from "@/components/marketplace/marketplace-connector-setup"
export * from "@/components/marketplace/marketplace-domain"

export function MarketplaceScreen({
  workspaceId,
  agents,
  canManageMarketplace = false,
  search,
  category,
  riskFilter,
  initialSelectedAppSlug,
  onSearchChange,
  onCategoryChange,
  onSelectedAppSlugChange,
  onConnectionComplete,
  onCreateCompatibleAgent,
  onOpenRuntimePairing,
}: MarketplaceScreenProps) {
  const queryClient = useQueryClient()
  const {
    connectionAuthType,
    connectionId,
    connectionName,
    connectorOptionalScopes,
    credentialDrafts,
    environment,
    isReplacingConnectionCredentials,
    localappconnectorBearerKeyDraft,
    localappconnectorOpenClawBaseUrlDraft,
    microsoftAuthorityMode,
    microsoftTenantId,
    outlookInstallSenderDrafts,
    outlookSenderEmail,
    retainUnverifiedCredentials,
    revealedCredentialDrafts,
    revealedLocalAppConnectorBearerKeySlug,
    selectedAgentIds,
    selectedAuditorAgentId,
    selectedCapabilities,
    selectedFilePath,
    selectedManagerAgentId,
    selectedSlug,
    selectMarketplaceApp,
    setConnectionAuthType,
    setConnectionId,
    setConnectionName,
    setConnectorOptionalScopes,
    setCredentialDrafts,
    setEnvironment,
    setIsReplacingConnectionCredentials,
    setLocalAppConnectorBearerKeyDraft,
    setLocalAppConnectorOpenClawBaseUrlDraft,
    setMicrosoftAuthorityMode,
    setMicrosoftTenantId,
    setOutlookInstallSenderDrafts,
    setOutlookSenderEmail,
    setRetainUnverifiedCredentials,
    setRevealedCredentialDrafts,
    setRevealedLocalAppConnectorBearerKeySlug,
    setSelectedAgentIds,
    setSelectedAuditorAgentId,
    setSelectedCapabilities,
    setSelectedFilePath,
    setSelectedManagerAgentId,
    setSelectedSlug,
    setXOptionalScopes,
    xOptionalScopes,
  } = useMarketplaceConnectionFormState(initialSelectedAppSlug)
  const [approvalProfileId, setApprovalProfileId] = useState("")
  const [dangerousPolicyAdvancedOpen, setDangerousPolicyAdvancedOpen] =
    useState(false)
  const [dangerousPolicyAcknowledged, setDangerousPolicyAcknowledged] =
    useState(false)
  const [autonomyPolicy, setAutonomyPolicy] = useState<LocalAppAutonomyPolicy>(
    defaultAutonomyPolicy()
  )
  const [dangerousAutonomyAdvancedOpen, setDangerousAutonomyAdvancedOpen] =
    useState(false)
  const [dangerousAutonomyAcknowledged, setDangerousAutonomyAcknowledged] =
    useState(false)
  const [localappconnectorCampaignIdDraft, setLocalAppConnectorCampaignIdDraft] = useState("")
  const [localappconnectorCampaignNameDraft, setLocalAppConnectorCampaignNameDraft] =
    useState("")
  const [runtimeFormat, setRuntimeFormat] =
    useState<MarketplaceRuntimeFormat>("openclaw")
  const [lastInstallResult, setLastInstallResult] =
    useState<MarketplaceInstallResult | null>(null)
  const [lastAutoConnectResult, setLastAutoConnectResult] =
    useState<AutoConnectLocalAppResult | null>(null)
  const [acknowledgeGeneratedDraftRisk, setAcknowledgeGeneratedDraftRisk] =
    useState(false)
  const [assignmentSearch, setAssignmentSearch] = useState("")
  const [agentPickerOpen, setAgentPickerOpen] = useState(false)
  const [policyPickerOpen, setPolicyPickerOpen] = useState(false)
  const [auditorPickerOpen, setAuditorPickerOpen] = useState(false)
  const [managerPickerOpen, setManagerPickerOpen] = useState(false)
  const agentPickerRef = useRef<HTMLDivElement | null>(null)
  const policyPickerRef = useRef<HTMLDivElement | null>(null)
  const auditorPickerRef = useRef<HTMLDivElement | null>(null)
  const managerPickerRef = useRef<HTMLDivElement | null>(null)
  const [marketplaceView, setMarketplaceView] = useState<MarketplaceView>("all")
  const [addAppMode, setAddAppMode] = useState<"choice" | "local" | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [removeInstallTarget, setRemoveInstallTarget] = useState<{
    install: MarketplaceInstall
    agentName: string
    appName: string
  } | null>(null)
  const [localAppDraft, setLocalAppDraft] = useState({
    name: "",
    sourceHostId: "",
    repoPath: "",
    localAppUrl: "",
    localApiUrl: "",
    openApiSpecPath: "",
    docsSourcePath: ".clawchat/",
    checkCommandRef: "",
    startCommandRef: "",
    allowRuntimeHostStart: false,
    lifecycleApprovalPolicy: "approval_required_for_start_or_restart",
  })
  const {
    apps,
    auditQuery,
    bridgeDevicesQuery,
    catalogQuery,
    catalogTotalCount,
    catalogUnavailable,
    connections,
    effectiveMarketplaceView,
    externalApps,
    installs,
    localApps,
    localSourceHostsQuery,
    marketplaceBetaMode,
    selectedApp,
    selectedAppBetaUnavailable,
    selectedAppBetaUnavailableMessage,
    selectedAppUnavailableMessage,
  } = useMarketplaceCatalogData({
    canManageMarketplace,
    category,
    marketplaceView,
    search,
    selectedSlug,
    workspaceId,
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const appSlug =
      params.get("marketplace_app") ??
      params.get("app") ??
      params.get("connector_oauth")
    if (!appSlug) return
    const callbackApp = apps.find((app) => app.slug === appSlug)
    if (!callbackApp) return
    // OAuth callback routing intentionally reopens the connector detail panel.
    selectMarketplaceApp(callbackApp)
  }, [apps, selectMarketplaceApp])
  const {
    connectorHealthQuery,
    connectorOAuthConfigQuery,
    dangerousApprovalProfile,
    defaultOperatorAgentId,
    effectiveCapabilities,
    existingOperatorInstalled,
    isLocalAppConnectorApp,
    localappconnectorOpenClawStatus,
    localappconnectorPolicySync,
    marketplaceAudit,
    ordinaryApprovalProfiles,
    selectedAppActiveInstalls,
    selectedAppConnectionKey,
    selectedAppConnections,
    selectedAppNeedsUserOAuth,
    selectedAppRoles,
    selectedAppUsesConnectorOAuth,
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
  } = useMarketplaceDetailData({
    approvalProfileId,
    auditEvents: (auditQuery.data?.data ?? []) as Array<
      Record<string, unknown>
    >,
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
  })

  const microsoftTenantIdValue =
    microsoftTenantId.trim() ||
    credentialDrafts.MICROSOFT_TENANT_ID?.trim() ||
    ""
  const microsoftClientIdValue =
    credentialDrafts.MICROSOFT_CLIENT_ID?.trim() ||
    (selectedApp
      ? credentialDrafts[`${selectedApp.slug.toUpperCase()}_CLIENT_ID`]?.trim()
      : "") ||
    ""
  const selectedConnectorClientSecretValue =
    selectedApp?.slug === "linkedin"
      ? credentialDrafts.LINKEDIN_CLIENT_SECRET?.trim() || ""
      : credentialDrafts.MICROSOFT_CLIENT_SECRET?.trim() || ""
  const connectorAuthorizeMissingFields = selectedApp?.connectionTypes.includes(
    "oauth1_xauth"
  )
    ? [
        !credentialDrafts.INSTAPAPER_USERNAME?.trim()
          ? "Instapaper email or username"
          : null,
      ].filter((field): field is string => Boolean(field))
    : selectedApp?.connectionTypes.some((type) =>
          RELAY_OWNED_CONNECTOR_OAUTH_TYPES.has(type)
        )
      ? []
      : selectedApp?.connectionTypes.includes("oauth_connector") &&
          !["bynder", "canto", "frontify", "asset-bank"].includes(
            selectedApp.slug
          )
        ? []
        : selectedApp?.slug === "outlook"
          ? [
              !microsoftAuthorityMode ? "authority mode" : null,
              microsoftAuthorityMode === "single_tenant" &&
              !microsoftTenantIdValue
                ? "tenant ID"
                : null,
              !microsoftClientIdValue ? "client ID" : null,
              !selectedConnectorClientSecretValue ? "client secret" : null,
            ].filter((field): field is string => Boolean(field))
          : selectedApp?.slug === "slack"
            ? []
            : [
                !microsoftClientIdValue ? "client ID" : null,
                !selectedConnectorClientSecretValue ? "client secret" : null,
              ].filter((field): field is string => Boolean(field))
  const connectorAuthorizeReady =
    Boolean(connectorOAuthConfigQuery.data?.callbackUrl) &&
    connectorAuthorizeMissingFields.length === 0

  useEffect(() => {
    if (!selectedApp) return
    setConnectionAuthType(selectedApp.connectionTypes[0] ?? "")
    setConnectionName((current) =>
      current.trim() ? current : `${selectedApp.name} connection`
    )
    setCredentialDrafts((current) => {
      const next = { ...current }
      for (const credential of selectedApp.credentialRequirements) {
        if (
          next[credential.name] === undefined &&
          credential.defaultValue !== undefined
        ) {
          next[credential.name] = credential.defaultValue
        }
      }
      return next
    })
    setApprovalProfileId(
      selectedApp.approvalProfiles.find((profile) => profile.defaultSelected)
        ?.id ?? selectedApp.approvalProfile
    )
    setDangerousPolicyAdvancedOpen(false)
    setDangerousPolicyAcknowledged(false)
    setRetainUnverifiedCredentials(false)
    setAutonomyPolicy(policyFromApp(selectedApp))
    setDangerousAutonomyAdvancedOpen(false)
    setDangerousAutonomyAcknowledged(false)
    setLocalAppConnectorCampaignIdDraft(
      String(selectedApp.sourceMetadata?.localappconnectorCampaignId ?? "")
    )
    setLocalAppConnectorCampaignNameDraft(
      String(selectedApp.sourceMetadata?.localappconnectorCampaignName ?? "")
    )
    setLocalAppConnectorOpenClawBaseUrlDraft(
      String(selectedApp.sourceMetadata?.localappconnectorOpenClawBaseUrl ?? "")
    )
    setLocalAppConnectorBearerKeyDraft("")
    setRuntimeFormat(selectedApp.runtimeSupport[0]?.format ?? "openclaw")
    setLastInstallResult(null)
    setAcknowledgeGeneratedDraftRisk(false)
    setSelectedAgentIds(new Set())
    setSelectedAuditorAgentId("")
    setSelectedManagerAgentId("")
    setAdvancedOpen(false)
    setAgentPickerOpen(false)
    setPolicyPickerOpen(false)
    setAuditorPickerOpen(false)
    setManagerPickerOpen(false)
    setXOptionalScopes(new Set())
    setConnectorOptionalScopes(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Connection-form state setters are stable.
  }, [selectedApp])

  useEffect(() => {
    if (!selectedAppNeedsUserOAuth) return
    const params = new URLSearchParams(window.location.search)
    const connectedConnectionId = params.get("x_connection_id")
    if (!connectedConnectionId) return
    if (
      !selectedAppConnections.some(
        (connection) => connection.id === connectedConnectionId
      )
    )
      return
    // OAuth callback reconciliation intentionally syncs URL state into the selected connection once.
    setConnectionId(connectedConnectionId)
    params.delete("x_oauth")
    params.delete("x_connection_id")
    const nextSearch = params.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
    )
    toast.success("X account authorized")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Connection-form state setters are stable.
  }, [selectedAppConnections, selectedAppNeedsUserOAuth])

  useEffect(() => {
    if (!selectedAppUsesConnectorOAuth || !selectedApp) return
    const params = new URLSearchParams(window.location.search)
    const oauthSlug = params.get("connector_oauth")
    const status = params.get("status")
    const message = params.get("message")
    const connectedConnectionId =
      params.get("connectionId") ??
      params.get("connection_id") ??
      params.get("marketplace_connection_id")
    if (oauthSlug !== selectedApp.slug) return
    if (status === "error") {
      toast.error(message || `${selectedApp.name} authorization failed`)
      params.delete("connector_oauth")
      params.delete("status")
      params.delete("message")
      const nextSearch = params.toString()
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
      )
      return
    }
    if (!connectedConnectionId) return
    if (
      !selectedAppConnections.some(
        (connection) => connection.id === connectedConnectionId
      )
    )
      return
    // OAuth callback reconciliation intentionally syncs URL state into the selected connection once.
    setConnectionId(connectedConnectionId)
    params.delete("connector_oauth")
    params.delete("status")
    params.delete("connectionId")
    params.delete("connection_id")
    params.delete("marketplace_connection_id")
    const nextSearch = params.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
    )
    toast.success(`${selectedApp.name} account authorized`)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Connection-form state setters are stable.
  }, [selectedApp, selectedAppConnections, selectedAppUsesConnectorOAuth])

  useEffect(() => {
    if (
      !agentPickerOpen &&
      !policyPickerOpen &&
      !auditorPickerOpen &&
      !managerPickerOpen
    ) {
      return
    }

    function closePickers() {
      setAgentPickerOpen(false)
      setPolicyPickerOpen(false)
      setAuditorPickerOpen(false)
      setManagerPickerOpen(false)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (
        agentPickerRef.current?.contains(target) ||
        policyPickerRef.current?.contains(target) ||
        auditorPickerRef.current?.contains(target) ||
        managerPickerRef.current?.contains(target)
      ) {
        return
      }
      closePickers()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePickers()
    }

    window.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [agentPickerOpen, auditorPickerOpen, managerPickerOpen, policyPickerOpen])

  useEffect(() => {
    if (!selectedApp) return
    const firstExistingConnection =
      preferredMarketplaceConnection(selectedAppConnections)?.id ?? ""
    // Keep the simple connect form pointed at the app's existing connection.
    setConnectionId((current) => {
      if (
        current &&
        selectedAppConnections.some((connection) => connection.id === current)
      ) {
        return current
      }
      return firstExistingConnection
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- The connection key is the semantic dependency.
  }, [selectedApp, selectedAppConnectionKey])

  useEffect(() => {
    if (!connectionId) return
    const existing = selectedAppConnections.find(
      (connection) => connection.id === connectionId
    )
    if (!existing) return
    // Mirror the selected stored connection into the editable draft fields.
    setEnvironment(existing.environment || "default")
    setConnectionName(existing.displayName)
    setIsReplacingConnectionCredentials(false)
    setConnectionAuthType(
      existing.authType || selectedApp?.connectionTypes[0] || ""
    )
    const metadata = existing.metadata ?? {}
    const mode = String(metadata.microsoftAuthorityMode ?? "")
    if (
      mode === "single_tenant" ||
      mode === "multi_tenant_org" ||
      mode === "multi_tenant_common"
    ) {
      setMicrosoftAuthorityMode(mode)
    }
    if (typeof metadata.microsoftAuthorityTenantId === "string") {
      setMicrosoftTenantId(metadata.microsoftAuthorityTenantId)
    }
    const primaryMailbox =
      typeof metadata.primaryMailboxAddress === "string"
        ? metadata.primaryMailboxAddress
        : ""
    if (selectedApp?.slug === "outlook" && primaryMailbox) {
      setOutlookSenderEmail((current) => current || primaryMailbox)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Connection-form state setters are stable.
  }, [connectionId, selectedApp?.connectionTypes, selectedAppConnections])

  const {
    connectedAppSlugs,
    connectedFilteredApps,
    documentationHistoryQuery,
    filteredApps,
    generatedPackDetailQuery,
    installedAppSlugs,
    localFilteredApps,
    localRepoDocsStatusQuery,
    packCoverageQuery,
    previewQuery,
    reviewApps,
    unconnectedFilteredApps,
  } = useMarketplaceViewData({
    approvalProfileId,
    apps,
    canManageMarketplace,
    category,
    connectionId,
    connections,
    effectiveCapabilities,
    effectiveMarketplaceView,
    externalApps,
    installs,
    localApps,
    riskFilter,
    runtimeFormat,
    search,
    selectedApp,
    selectedAppBetaUnavailable,
    selectedPackQuality,
    workspaceId,
  })

  const assertCanManageMarketplace = () =>
    assertMarketplaceManagementAllowed(canManageMarketplace)

  const {
    disconnectConnectorOAuthMutation,
    disconnectXOAuthMutation,
    reauthorizeXOAuthMutation,
    removeInstallMutation,
    startConnectorOAuthMutation,
    startXOAuthMutation,
    updateInstallPolicyMutation,
    updateOutlookInstallSenderMutation,
    validateOutlookSenderMutation,
  } = useMarketplaceConnectionActions({
    agents,
    assertCanManageMarketplace,
    connectionId,
    connectionName,
    connectorOAuthReturnTo: marketplaceConnectorOAuthReturnTo,
    connectorOptionalScopes,
    credentialDrafts,
    effectiveCapabilities,
    environment,
    microsoftAuthorityMode,
    microsoftTenantId,
    outlookSenderEmail,
    queryClient,
    selectedApp,
    selectedConnectorConnection,
    setConnectionId,
    setRemoveInstallTarget,
    workspaceId,
    xOptionalScopes,
  })

  const { assignAgentMutation, connectAppMutation, updateConnectionMutation } =
    useMarketplaceConnectApp({
      acknowledgeGeneratedDraftRisk,
      agents,
      approvalProfileId,
      assertCanManageMarketplace,
      autonomyPolicy,
      connectionAuthType,
      connectionId,
      connectionName,
      credentialDrafts,
      dangerousAutonomyAcknowledged,
      dangerousPolicyAcknowledged,
      defaultOperatorAgentId,
      effectiveCapabilities,
      environment,
      isReplacingConnectionCredentials,
      existingOperatorInstalled,
      isLocalAppConnectorApp,
      localappconnectorCampaignIdDraft,
      localappconnectorCampaignNameDraft,
      onConnectionComplete,
      outlookSenderEmail,
      queryClient,
      retainUnverifiedCredentials,
      selectedApp,
      selectedAppRoles,
      selectedAppUsesConnectorOAuth,
      selectedAgentIds,
      selectedAuditorAgentId,
      selectedManagerAgentId,
      setConnectionId,
      setCredentialDrafts,
      setIsReplacingConnectionCredentials,
      setLastAutoConnectResult,
      setLastInstallResult,
      visibleCredentialRequirements,
      workspaceId,
    })

  const {
    importGeneratedPackSourcesMutation,
    manualReviewGeneratedPackMutation,
    promoteGeneratedPackMutation,
    publishGeneratedPackMutation,
    rejectGeneratedPackMutation,
    rerunGeneratedPackMutation,
  } = useMarketplaceGeneratedPackActions({
    assertCanManageMarketplace,
    queryClient,
    selectedApp,
    workspaceId,
  })

  const {
    analyzeLocalRepoDocsMutation,
    applyLocalRepoDocsProposalMutation,
    configureLocalAppConnectorOpenClawMutation,
    createLocalAppMutation,
    persistAutonomyPolicy,
    refreshAgentDocsMutation,
    syncLocalAppConnectorPolicyMutation,
    updateDocumentationAutomationMutation,
    updateLocalAppSourceMutation,
    updatePackMutation,
    updateToolRequestStatusMutation,
  } = useMarketplaceLocalActions({
    assertCanManageMarketplace,
    localAppDraft,
    localSourceHosts: localSourceHostsQuery.data ?? [],
    queryClient,
    selectedApp,
    setAddAppMode,
    setAutonomyPolicy,
    setLocalAppConnectorBearerKeyDraft,
    setLocalAppDraft,
    workspaceId,
  })

  const {
    auditorRoleDisabledReason,
    compatibleAgentRecoveryActions,
    compatibleOperatorAgentCards,
    connectBlockedReason,
    connectButtonLabel,
    generatedPackNeedsAcknowledgement,
    hasCatalogApps,
    managerRoleDisabledReason,
    managerRoleSupported,
    auditorRoleSupported,
    selectedAuditorAgentCard,
    selectedFile,
    selectedManagerAgentCard,
    selectedOperatorAgentCard,
    selectedOperatorAgentId,
    supportAgentOptions,
  } = useMarketplaceAgentCompatibility({
    acknowledgeGeneratedDraftRisk,
    agents,
    approvalProfileId,
    apps,
    autonomyPolicy,
    bridgeDevices: bridgeDevicesQuery.data ?? [],
    connectionId,
    credentialDrafts,
    dangerousAutonomyAcknowledged,
    dangerousPolicyAcknowledged,
    existingOperatorInstalled,
    generatedPackPublicationStatus:
      generatedPackDetailQuery.data?.publicationStatus ?? null,
    isLocalAppConnectorApp,
    onCreateCompatibleAgent,
    onOpenRuntimePairing,
    packPreviewFiles: previewQuery.data?.files ?? [],
    runtimeFormat,
    selectedAgentIds,
    selectedApp,
    selectedAppBetaUnavailable,
    selectedAppBetaUnavailableMessage,
    selectedAppNeedsUserOAuth,
    selectedAppRoles,
    selectedAppUnavailableMessage,
    selectedAppUsesConnectorOAuth,
    selectedAuditorAgentId,
    selectedConnectionRequiresDevice,
    selectedFilePath,
    selectedManagerAgentId,
    selectedPackQuality,
    selectedXConnectionReady,
    visibleCredentialRequirements,
  })
  const generatedPackDetail = generatedPackDetailQuery.data
  const previewFiles = previewQuery.data?.files ?? []

  useEffect(() => {
    onSelectedAppSlugChange?.(selectedSlug)
  }, [onSelectedAppSlugChange, selectedSlug])

  return (
    <>
      <main className="min-h-full bg-[var(--claw-bg-page)] text-[var(--claw-text-primary)]">
        <div
          className={`border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-5 py-3 ${selectedApp ? "hidden" : ""}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-[6px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_24%,var(--claw-border))] bg-[var(--claw-bg-surface)] text-[#b9d6f8] shadow-[0_0_24px_rgba(80,142,255,0.12)]">
                <KeyRound className="size-4" />
              </div>
              <h1 className="text-lg font-semibold tracking-[-0.02em]">
                Applications Marketplace
              </h1>
            </div>
            <div className="flex gap-2">
              {canManageMarketplace ? (
                <Button
                  size="sm"
                  className="bg-blue-500 text-white shadow-[0_0_28px_rgba(59,130,246,0.2)] hover:bg-blue-400"
                  onClick={() =>
                    setAddAppMode((mode) =>
                      mode === "choice" ? null : "choice"
                    )
                  }
                >
                  <Plus className="mr-2 size-4" />
                  Add App
                </Button>
              ) : null}
              <StatusPill label="Apps" value={catalogTotalCount} />
              {canManageMarketplace ? (
                <StatusPill label="Local" value={localApps.length} />
              ) : null}
              <StatusPill label="Connections" value={connections.length} />
              <StatusPill label="Installs" value={installs.length} />
            </div>
          </div>
        </div>

        <section className="min-h-[calc(100vh-114px)] overflow-auto p-3">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {selectedApp ? (
              <Button
                size="sm"
                type="button"
                variant="outline"
                className="size-9 px-0"
                onClick={() => setSelectedSlug(null)}
              >
                <span className="sr-only">Back to marketplace</span>
                <ArrowLeft className="size-4" />
              </Button>
            ) : (
              <div className="flex w-full flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-[240px] flex-1">
                    <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-[var(--claw-text-muted)]" />
                    <Input
                      aria-label="Search marketplace apps"
                      className="h-9 pl-9"
                      placeholder="Search marketplace apps"
                      value={search}
                      onChange={(event) => onSearchChange?.(event.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Application category"
                    className="h-9 min-w-48 rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-surface)] px-3 text-sm"
                    value={category}
                    onChange={(event) =>
                      onCategoryChange?.(
                        event.target.value as
                          | (typeof MARKETPLACE_CATEGORY_ORDER)[number]
                          | "all"
                      )
                    }
                  >
                    <option value="all">All categories</option>
                    {MARKETPLACE_CATEGORY_ORDER.map((categoryOption) => (
                      <option key={categoryOption} value={categoryOption}>
                        {MARKETPLACE_CATEGORY_LABELS[categoryOption]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MarketplaceViewTabs
                    active={effectiveMarketplaceView}
                    canManageMarketplace={canManageMarketplace}
                    counts={{
                      all: apps.length,
                      external: externalApps.length,
                      local: localApps.length,
                      connections: connections.length,
                      installed: installedAppSlugs.size,
                      review: reviewApps.length,
                    }}
                    onChange={(next) => {
                      setMarketplaceView(next)
                      setSelectedSlug(null)
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {!selectedApp ? (
            <div
              className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
              data-testid="marketplace-catalog-statistics"
            >
              <MarketplaceCatalogStatistic
                label="Railway catalog"
                value={catalogTotalCount}
                detail="apps available to this workspace"
              />
              <MarketplaceCatalogStatistic
                label="Showing now"
                value={filteredApps.length}
                detail={
                  filteredApps.length === apps.length
                    ? "no view or search exclusions"
                    : `of ${catalogTotalCount} workspace apps after this view and filters`
                }
              />
              <MarketplaceCatalogStatistic
                label="Connected"
                value={connectedAppSlugs.size}
                detail="apps with a saved connection"
              />
              <MarketplaceCatalogStatistic
                label="Installed"
                value={installedAppSlugs.size}
                detail="apps assigned to at least one agent"
              />
            </div>
          ) : null}
          {marketplaceBetaMode ? <MarketplaceBetaSafetyNotice /> : null}
          {canManageMarketplace && addAppMode === "choice" ? (
            <AddAppChoice
              onExternal={() => {
                setMarketplaceView("external")
                setAddAppMode(null)
              }}
              onLocal={() => setAddAppMode("local")}
              onCancel={() => setAddAppMode(null)}
            />
          ) : null}
          {canManageMarketplace && addAppMode === "local" ? (
            <LocalAppForm
              draft={localAppDraft}
              sourceHosts={localSourceHostsQuery.data ?? []}
              busy={createLocalAppMutation.isPending}
              onChange={setLocalAppDraft}
              onCancel={() => setAddAppMode(null)}
              onSubmit={() => createLocalAppMutation.mutate()}
            />
          ) : null}
          {selectedApp ? (
            <div className="space-y-3">
              <Card className="relative overflow-hidden border-[color-mix(in_srgb,var(--claw-border)_58%,transparent)] bg-[linear-gradient(105deg,var(--claw-bg-surface),color-mix(in_srgb,var(--claw-accent-blue)_8%,var(--claw-bg-surface)))]">
                <CardContent className="flex min-h-[132px] items-center gap-5 p-6">
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_65%,var(--claw-border))] bg-[var(--claw-bg-page)]">
                    <AppLogo app={selectedApp} size="lg" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--claw-text-primary)]">
                        {selectedApp.name}
                      </h2>
                      <Badge variant="secondary">
                        {MARKETPLACE_CATEGORY_LABELS[selectedApp.category]}
                      </Badge>
                      <Badge variant="secondary">
                        {getMarketplaceAppStatus({
                          app: selectedApp,
                          connection: preferredMarketplaceConnection(
                            selectedAppConnections
                          ),
                          installedCount: selectedAppActiveInstalls.length,
                        })}
                      </Badge>
                    </div>
                    <p className="mt-3 max-w-5xl text-base leading-6 font-medium text-[var(--claw-text-secondary)]">
                      {selectedApp.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {selectedConnectionRequiresDevice ? (
                <Card className="border-amber-400/35 bg-amber-400/10">
                  <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-100">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <div className="font-semibold">
                        Available through your Mac
                      </div>
                      <div className="mt-1 leading-5 text-amber-100/85">
                        This connection is synchronized for visibility, but its
                        credentials remain on your Mac. Keep the Mac and bridge
                        online to use it remotely, or create a control-plane
                        connection for this app. Relay will not silently use
                        different credentials.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="border-[color-mix(in_srgb,var(--claw-border)_58%,transparent)] bg-[var(--claw-bg-page)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">
                    Agents with {selectedApp.name}
                  </CardTitle>
                  <div className="text-sm text-[var(--claw-text-secondary)]">
                    Select which agents should use the active {selectedApp.name}{" "}
                    connection.
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm text-[var(--claw-text-secondary)]">
                      Active connection:
                    </label>
                    <select
                      aria-label="Active connection"
                      className="h-10 min-w-56 rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-surface)] px-3 text-sm"
                      value={connectionId}
                      onChange={(event) => setConnectionId(event.target.value)}
                    >
                      <option value="">No connection selected</option>
                      {selectedAppConnections.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.displayName}
                          {connection.executionAuthority === "swift"
                            ? " (Mac required)"
                            : ""}
                        </option>
                      ))}
                    </select>
                    <div className="relative min-w-64 flex-1 md:max-w-sm">
                      <Search className="pointer-events-none absolute top-3 left-3 size-4 text-[var(--claw-text-muted)]" />
                      <Input
                        className="h-10 pl-9"
                        placeholder="Search agents..."
                        value={assignmentSearch}
                        onChange={(event) =>
                          setAssignmentSearch(event.target.value)
                        }
                      />
                    </div>
                  </div>
                  {agents.filter((agent) =>
                    `${agent.name} ${agent.role}`
                      .toLowerCase()
                      .includes(assignmentSearch.trim().toLowerCase())
                  ).length ? (
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {agents
                        .filter((agent) =>
                          `${agent.name} ${agent.role}`
                            .toLowerCase()
                            .includes(assignmentSearch.trim().toLowerCase())
                        )
                        .map((agent) => {
                          const activeInstall = selectedAppActiveInstalls.find(
                            (install) =>
                              install.agentId === agent.id &&
                              (!connectionId ||
                                install.connectionId === connectionId)
                          )
                          const directAssignmentAvailable =
                            selectedConnectorConnection?.status === "ready" &&
                            !selectedConnectionRequiresDevice &&
                            canManageMarketplace
                          const assignmentUnavailable =
                            Boolean(connectionId) && !directAssignmentAvailable
                          const selected =
                            Boolean(activeInstall) ||
                            (!connectionId && selectedAgentIds.has(agent.id))
                          const assignmentReady =
                            selected && agent.executionAvailable !== false
                          const assignmentPending =
                            (assignAgentMutation.isPending &&
                              assignAgentMutation.variables === agent.id) ||
                            (removeInstallMutation.isPending &&
                              removeInstallMutation.variables?.agentId ===
                                agent.id)
                          return (
                            <button
                              key={agent.id}
                              type="button"
                              aria-pressed={selected}
                              aria-label={`${selected ? "Disconnect" : "Connect"} ${agent.name} ${selected ? "from" : "to"} ${selectedApp.name}`}
                              disabled={
                                assignmentPending || assignmentUnavailable
                              }
                              className={`flex items-center gap-3 rounded-[4px] border p-3 text-left ${
                                assignmentReady
                                  ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_10%,transparent)]"
                                  : selected
                                    ? "border-amber-500/60 bg-amber-500/10"
                                  : "border-[var(--claw-border)] bg-[var(--claw-bg-surface)]"
                              } disabled:cursor-wait disabled:opacity-60`}
                              onClick={() => {
                                if (activeInstall) {
                                  removeInstallMutation.mutate(activeInstall)
                                  return
                                }
                                if (directAssignmentAvailable) {
                                  assignAgentMutation.mutate(agent.id)
                                  return
                                }
                                setSelectedAgentIds((current) => {
                                  const next = new Set(current)
                                  if (next.has(agent.id)) next.delete(agent.id)
                                  else next.add(agent.id)
                                  return next
                                })
                              }}
                            >
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--claw-bg-page)] text-xs font-semibold">
                                {agent.name.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">
                                  {agent.name}
                                </span>
                                <span className="block truncate text-xs text-[var(--claw-text-muted)]">
                                  {selected && !assignmentReady
                                    ? "Assigned — runtime unavailable"
                                    : agent.role}
                                </span>
                              </span>
                              {assignmentPending ? (
                                <RefreshCw className="size-4 animate-spin text-[var(--claw-text-muted)]" />
                              ) : (
                                <span
                                  className={`h-5 w-9 rounded-full p-0.5 ${assignmentReady ? "bg-emerald-500" : selected ? "bg-amber-500" : "bg-zinc-700"}`}
                                >
                                  <span
                                    className={`block size-4 rounded-full bg-white transition ${assignmentReady ? "translate-x-4" : ""}`}
                                  />
                                </span>
                              )}
                            </button>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-[var(--claw-text-muted)]">
                      No matching agents
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid w-full gap-3">
                <Card className="hidden bg-[color-mix(in_srgb,var(--claw-bg-surface)_82%,transparent)]">
                  <CardContent className="flex h-full min-h-[420px] flex-col items-center p-4 text-center">
                    <div className="flex size-28 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--claw-accent-blue)_28%,var(--claw-border))] bg-[var(--claw-bg-page)]">
                      <AppLogo app={selectedApp} size="lg" />
                    </div>
                    <div className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
                      {selectedApp.name}
                    </div>
                    {!selectedAppNeedsUserOAuth ? (
                      <div className="mt-2 max-w-44 text-sm leading-5 text-[var(--claw-text-secondary)]">
                        {selectedApp.description}
                      </div>
                    ) : null}
                    <Badge variant="secondary" className="mt-3">
                      {getMarketplaceAppStatus({
                        app: selectedApp,
                        connection: selectedAppConnections[0],
                        installedCount: selectedAppActiveInstalls.length,
                      })}
                    </Badge>
                    {selectedAppBetaUnavailable ? (
                      <MarketplaceUnavailableNotice
                        message={selectedAppBetaUnavailableMessage}
                        compact
                      />
                    ) : null}
                    {!selectedAppNeedsUserOAuth ? (
                      <div className="mt-6 w-full space-y-3 border-t border-[color-mix(in_srgb,var(--claw-border)_24%,transparent)] pt-5 text-left text-sm">
                        {marketplaceSummaryBullets(selectedApp).map(
                          (bullet) => (
                            <AppSummaryBullet key={bullet}>
                              {bullet}
                            </AppSummaryBullet>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="mt-5 border-t border-[color-mix(in_srgb,var(--claw-border)_24%,transparent)] pt-4 text-sm leading-6 text-[var(--claw-text-secondary)]">
                        Read X activity and draft posts. Publishing requires
                        approval.
                      </div>
                    )}
                    {selectedAppNeedsUserOAuth &&
                    selectedAppActiveInstalls.length ? (
                      <div className="mt-5 w-full border-t border-[color-mix(in_srgb,var(--claw-border)_24%,transparent)] pt-4 text-left">
                        <ExistingInstallsPanel
                          installs={selectedAppActiveInstalls}
                          agents={agents}
                          compact
                          appName={selectedApp.name}
                          busyInstallId={
                            removeInstallMutation.isPending
                              ? removeInstallMutation.variables?.id
                              : null
                          }
                          onRequestRemove={
                            canManageMarketplace
                              ? (install, agentName) =>
                                  setRemoveInstallTarget({
                                    install,
                                    agentName,
                                    appName: selectedApp.name,
                                  })
                              : undefined
                          }
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <div className="min-w-0 space-y-3">
                  <Card className="border-[color-mix(in_srgb,var(--claw-border)_58%,transparent)] bg-[var(--claw-bg-page)]">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <span className="flex size-9 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_35%,var(--claw-border))] bg-[var(--claw-bg-surface)] text-[#87bfff]">
                          <KeyRound className="size-4" />
                        </span>
                        Manage API Connection
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  {selectedAppActiveInstalls.length &&
                  !selectedAppNeedsUserOAuth ? (
                    <ExistingInstallsPanel
                      installs={selectedAppActiveInstalls}
                      agents={agents}
                      appName={selectedApp.name}
                      busyInstallId={
                        removeInstallMutation.isPending
                          ? removeInstallMutation.variables?.id
                          : null
                      }
                      onRequestRemove={
                        canManageMarketplace
                          ? (install, agentName) =>
                              setRemoveInstallTarget({
                                install,
                                agentName,
                                appName: selectedApp.name,
                              })
                          : undefined
                      }
                    />
                  ) : null}

                  {canManageMarketplace ? (
                    <>
                      <AgentDocsStatusPill
                        app={selectedApp}
                        installs={selectedAppActiveInstalls}
                        busy={refreshAgentDocsMutation.isPending}
                        onRefresh={() =>
                          refreshAgentDocsMutation.mutate(undefined)
                        }
                      />
                      {selectedApp.sourceType === "local_repo" ? (
                        <>
                          <LocalRepoDocsWorkspace
                            app={selectedApp}
                            status={localRepoDocsStatusQuery.data ?? null}
                            loading={localRepoDocsStatusQuery.isLoading}
                            analyzing={analyzeLocalRepoDocsMutation.isPending}
                            applying={
                              applyLocalRepoDocsProposalMutation.isPending ||
                              updateDocumentationAutomationMutation.isPending
                            }
                            onAnalyze={() =>
                              analyzeLocalRepoDocsMutation.mutate()
                            }
                            onAutomationModeChange={(mode) =>
                              updateDocumentationAutomationMutation.mutate({
                                appSlug: selectedApp.slug,
                                mode,
                              })
                            }
                            onApply={(
                              proposalId,
                              approvedFileIds,
                              rejectedFileIds
                            ) =>
                              applyLocalRepoDocsProposalMutation.mutate({
                                proposalId,
                                approvedFileIds,
                                rejectedFileIds,
                              })
                            }
                          />
                          <DocumentationHistoryPanel
                            history={documentationHistoryQuery.data ?? null}
                            installs={selectedAppActiveInstalls}
                            agents={agents}
                            loading={documentationHistoryQuery.isLoading}
                          />
                        </>
                      ) : null}

                      {selectedAppNeedsUserOAuth ? (
                        <XOAuthSetupNotice
                          unavailableReason={
                            selectedAppBetaUnavailable
                              ? selectedAppBetaUnavailableMessage
                              : null
                          }
                          callbackUrl={
                            xOAuthConfigQuery.data?.callbackUrl ?? ""
                          }
                          requiredScopes={
                            xOAuthConfigQuery.data?.requiredScopes ?? [
                              "tweet.read",
                              "tweet.write",
                              "users.read",
                              "offline.access",
                            ]
                          }
                          optionalScopes={
                            xOAuthConfigQuery.data?.optionalScopes ?? []
                          }
                          selectedOptionalScopes={xOptionalScopes}
                          connection={selectedXConnection}
                          busy={
                            startXOAuthMutation.isPending ||
                            reauthorizeXOAuthMutation.isPending
                          }
                          disconnectBusy={disconnectXOAuthMutation.isPending}
                          clientIdPresent={Boolean(
                            credentialDrafts.X_CLIENT_ID?.trim()
                          )}
                          onToggleScope={(scope, checked) =>
                            setXOptionalScopes((current) => {
                              const next = new Set(current)
                              if (checked) next.add(scope)
                              else next.delete(scope)
                              return next
                            })
                          }
                          onAuthorize={() => startXOAuthMutation.mutate()}
                          onReauthorize={() =>
                            reauthorizeXOAuthMutation.mutate()
                          }
                          onDisconnect={() => disconnectXOAuthMutation.mutate()}
                        />
                      ) : null}

                      {selectedAppUsesConnectorOAuth ? (
                        <ConnectorOAuthSetupNotice
                          unavailableReason={
                            selectedAppBetaUnavailable
                              ? selectedAppBetaUnavailableMessage
                              : null
                          }
                          appName={selectedApp.name}
                          appSlug={selectedApp.slug}
                          accountCreationUrl={selectedApp.accountCreationUrl}
                          callbackUrl={
                            connectorOAuthConfigQuery.data?.callbackUrl ?? ""
                          }
                          requiredScopes={
                            connectorOAuthConfigQuery.data?.requiredScopes ?? []
                          }
                          optionalScopes={
                            connectorOAuthConfigQuery.data?.optionalScopes ?? []
                          }
                          selectedOptionalScopes={connectorOptionalScopes}
                          connection={selectedConnectorConnection}
                          health={connectorHealthQuery.data ?? null}
                          authorityMode={microsoftAuthorityMode}
                          tenantId={microsoftTenantId}
                          senderEmail={outlookSenderEmail}
                          installs={installs.filter(
                            (install) => install.appSlug === selectedApp.slug
                          )}
                          agents={agents}
                          approvalProfiles={selectedApp.approvalProfiles}
                          installSenderDrafts={outlookInstallSenderDrafts}
                          checkingAlias={
                            validateOutlookSenderMutation.isPending
                          }
                          savingInstallAlias={
                            updateOutlookInstallSenderMutation.isPending
                          }
                          savingInstallPolicy={
                            updateInstallPolicyMutation.isPending
                          }
                          busy={
                            startConnectorOAuthMutation.isPending
                          }
                          disconnectBusy={
                            disconnectConnectorOAuthMutation.isPending
                          }
                          authorizeReady={connectorAuthorizeReady}
                          authorizeMissingFields={
                            connectorAuthorizeMissingFields
                          }
                          onToggleScope={(scope, checked) =>
                            setConnectorOptionalScopes((current) => {
                              const next = new Set(current)
                              if (checked) next.add(scope)
                              else next.delete(scope)
                              return next
                            })
                          }
                          onAuthorityModeChange={setMicrosoftAuthorityMode}
                          onTenantIdChange={setMicrosoftTenantId}
                          onSenderEmailChange={setOutlookSenderEmail}
                          onCheckSenderAlias={() =>
                            validateOutlookSenderMutation.mutate({})
                          }
                          onInstallSenderDraftChange={(installId, email) =>
                            setOutlookInstallSenderDrafts((current) => ({
                              ...current,
                              [installId]: email,
                            }))
                          }
                          onSaveInstallSenderAlias={(install, email) =>
                            updateOutlookInstallSenderMutation.mutate({
                              install,
                              email,
                            })
                          }
                          onSaveInstallPolicy={(install, approvalProfileId) =>
                            updateInstallPolicyMutation.mutate({
                              install,
                              approvalProfileId: approvalProfileId.id,
                              acknowledgeDangerouslySkipPermissions:
                                approvalProfileId.acknowledged,
                            })
                          }
                          onAuthorize={() =>
                            startConnectorOAuthMutation.mutate()
                          }
                          onDisconnect={() =>
                            disconnectConnectorOAuthMutation.mutate()
                          }
                        />
                      ) : null}

                      {selectedApp?.slug === "exa" ? (
                        <ApiKeyConnectorStatusCard
                          app={selectedApp}
                          connection={selectedConnectorConnection}
                          health={connectorHealthQuery.data ?? null}
                          connections={selectedAppConnections}
                        />
                      ) : null}

                      {selectedXConnectedNotInstalled ? (
                        <Card className="border-[color-mix(in_srgb,var(--claw-accent-blue)_32%,var(--claw-border))] bg-[var(--claw-bg-surface)]">
                          <CardContent className="p-3 text-sm text-[var(--claw-text-secondary)]">
                            <div className="font-semibold text-[var(--claw-text-primary)]">
                              X account connected, agent skill not installed yet
                            </div>
                            <div className="mt-1">
                              Select Social Hermes as the operator agent, then
                              click Connect X to agent. OAuth saves the X
                              account connection; this separate step installs
                              the Hermes skill under{" "}
                              {hermesRouterTargetRoot("worker", "x")}.
                            </div>
                          </CardContent>
                        </Card>
                      ) : null}

                      <div className="grid gap-2.5 lg:grid-cols-2">
                        <div className="rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
                          <div className="mb-2 flex items-center gap-3">
                            <StepBadge value={1} />
                            <div className="text-base font-semibold">
                              Operator agent{" "}
                              <span className="text-[var(--claw-danger)]">
                                *
                              </span>
                            </div>
                          </div>
                          <div
                            ref={agentPickerRef}
                            className="relative max-w-[360px]"
                          >
                            <button
                              type="button"
                              className="flex h-10 w-full items-center justify-between gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-3 text-left text-sm transition outline-none hover:border-white/20"
                              onClick={() =>
                                setAgentPickerOpen((open) => !open)
                              }
                            >
                              {selectedOperatorAgentCard ? (
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <AgentAvatar
                                    agent={selectedOperatorAgentCard.agent}
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold">
                                      {selectedOperatorAgentCard.agent.name}
                                    </span>
                                    <span className="claw-caption block truncate text-[var(--claw-text-secondary)]">
                                      {runtimeLabel(
                                        selectedOperatorAgentCard.runtimeType
                                      )}
                                    </span>
                                  </span>
                                </span>
                              ) : existingOperatorInstalled ? (
                                <span className="text-[var(--claw-text-secondary)]">
                                  No operator change
                                </span>
                              ) : (
                                <span className="text-[var(--claw-text-secondary)]">
                                  Select an operator agent
                                </span>
                              )}
                              <span className="text-[var(--claw-text-muted)]">
                                ⌄
                              </span>
                            </button>
                            {agentPickerOpen ? (
                              <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-page)] p-1 shadow-xl">
                                {compatibleOperatorAgentCards.length ? (
                                  <>
                                    {existingOperatorInstalled ? (
                                      <button
                                        type="button"
                                        className={cn(
                                          "flex w-full items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[var(--claw-bg-surface)]",
                                          !selectedOperatorAgentId &&
                                            "bg-[color-mix(in_srgb,var(--claw-accent-blue)_18%,var(--claw-bg-surface))]"
                                        )}
                                        onClick={() => {
                                          setSelectedAgentIds(new Set())
                                          setAgentPickerOpen(false)
                                        }}
                                      >
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate font-semibold">
                                            No operator change
                                          </span>
                                          <span className="claw-caption block truncate text-[var(--claw-text-secondary)]">
                                            Keep the existing operator install
                                          </span>
                                        </span>
                                      </button>
                                    ) : null}
                                    {compatibleOperatorAgentCards.map(
                                      ({ agent, runtimeType }) => (
                                        <button
                                          key={agent.id}
                                          type="button"
                                          className={cn(
                                            "flex w-full items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[var(--claw-bg-surface)]",
                                            selectedOperatorAgentId ===
                                              agent.id &&
                                              "bg-[color-mix(in_srgb,var(--claw-accent-blue)_18%,var(--claw-bg-surface))]"
                                          )}
                                          onClick={() => {
                                            const inferredRuntime =
                                              marketplaceRuntimeForAgent(agent)
                                            setSelectedAgentIds(
                                              new Set([agent.id])
                                            )
                                            if (inferredRuntime)
                                              setRuntimeFormat(inferredRuntime)
                                            setAgentPickerOpen(false)
                                          }}
                                        >
                                          <AgentAvatar agent={agent} />
                                          <span className="min-w-0 flex-1">
                                            <span className="block truncate font-semibold">
                                              {agent.name}
                                            </span>
                                            <span className="claw-caption block truncate text-[var(--claw-text-secondary)]">
                                              {runtimeLabel(runtimeType)}
                                            </span>
                                          </span>
                                        </button>
                                      )
                                    )}
                                  </>
                                ) : (
                                  <div className="space-y-3 px-3 py-5 text-sm text-[var(--claw-text-secondary)]">
                                    <div className="text-center">
                                      No compatible OpenClaw or Hermes agents.
                                    </div>
                                    {compatibleAgentRecoveryActions}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
                          <div className="mb-2 flex items-center gap-3">
                            <StepBadge value={2} />
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                              <div className="text-base font-semibold">
                                {selectedApp.name} credentials
                              </div>
                              {credentialHelpUrl(selectedApp) ? (
                                <a
                                  href={credentialHelpUrl(selectedApp)!}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 text-sm font-medium text-[#8bbcff] hover:text-white"
                                >
                                  Get token
                                </a>
                              ) : null}
                            </div>
                          </div>
                          {selectedAppConnections.length ? (
                            <select
                              className="h-10 w-full rounded-[4px] border bg-transparent px-3 text-sm"
                              value={connectionId}
                              onChange={(event) =>
                                setConnectionId(event.target.value)
                              }
                            >
                              {selectedAppConnections.map((connection) => (
                                <option
                                  key={connection.id}
                                  value={connection.id}
                                >
                                  {connection.metadata?.xHandle
                                    ? `Use @${String(connection.metadata.xHandle)}`
                                    : `Use ${connection.displayName}`}
                                  {connection.executionAuthority === "swift"
                                    ? " (Mac required)"
                                    : ""}
                                  {connection.status !== "ready"
                                    ? ` (${connection.status})`
                                    : ""}
                                </option>
                              ))}
                              <option value="">Add a new connection</option>
                            </select>
                          ) : null}
                          <div
                            key={selectedApp.slug}
                            className="grid max-w-[460px] gap-2"
                          >
                            <label className="grid gap-1">
                              <span className="text-xs font-semibold text-[var(--claw-text-secondary)]">
                                Connection name
                              </span>
                              <Input
                                autoComplete="off"
                                name={`${selectedApp.slug}__connection_name`}
                                placeholder={`${selectedApp.name} connection`}
                                type="text"
                                value={connectionName}
                                onChange={(event) =>
                                  setConnectionName(event.target.value)
                                }
                              />
                            </label>
                            {connectionId &&
                            !isReplacingConnectionCredentials ? (
                              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-3 text-xs leading-5 text-[var(--claw-text-secondary)]">
                                <div>
                                  The encrypted credentials saved in Relay
                                  remain active.
                                </div>
                                <Button
                                  className="mt-2"
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={selectedConnectionRequiresDevice}
                                  onClick={() => {
                                    setCredentialDrafts(
                                      Object.fromEntries(
                                        selectedApp.credentialRequirements.flatMap(
                                          (credential) =>
                                            credential.defaultValue ===
                                            undefined
                                              ? []
                                              : [
                                                  [
                                                    credential.name,
                                                    credential.defaultValue,
                                                  ],
                                                ]
                                        )
                                      )
                                    )
                                    setIsReplacingConnectionCredentials(true)
                                  }}
                                >
                                  Replace saved credentials
                                </Button>
                                {selectedConnectionRequiresDevice ? (
                                  <div className="mt-2 text-amber-300">
                                    This connection stores its credentials on
                                    the Mac where it was created.
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <>
                                {visibleCredentialRequirements.map(
                                  (credential) => {
                                    const label = credentialDisplayLabel(
                                      selectedApp,
                                      credential
                                    )
                                    const revealKey = `${selectedApp.slug}:${credential.name}`
                                    const value =
                                      credentialDrafts[credential.name] ?? ""
                                    const onValueChange = (next: string) =>
                                      setCredentialDrafts((current) => ({
                                        ...current,
                                        [credential.name]: next,
                                      }))
                                    if (
                                      credential.inputType === "select" &&
                                      credential.options?.length
                                    ) {
                                      return (
                                        <label
                                          key={credential.name}
                                          className="grid gap-1"
                                        >
                                          <span className="text-xs font-semibold text-[var(--claw-text-secondary)]">
                                            {label}
                                          </span>
                                          <select
                                            className="h-10 w-full rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-3 text-sm"
                                            name={`${selectedApp.slug}__${credential.name}`}
                                            value={value}
                                            onChange={(event) =>
                                              onValueChange(event.target.value)
                                            }
                                          >
                                            {credential.options.map(
                                              (option) => (
                                                <option
                                                  key={option.value}
                                                  value={option.value}
                                                >
                                                  {option.label}
                                                </option>
                                              )
                                            )}
                                          </select>
                                        </label>
                                      )
                                    }
                                    if (credential.secret) {
                                      return (
                                        <SecretCredentialInput
                                          key={credential.name}
                                          inputName={`${selectedApp.slug}__${credential.name}`}
                                          label={label}
                                          value={value}
                                          revealed={
                                            revealedCredentialDrafts[
                                              revealKey
                                            ] === true
                                          }
                                          onChange={onValueChange}
                                          onToggleReveal={() =>
                                            setRevealedCredentialDrafts(
                                              (current) => ({
                                                ...current,
                                                [revealKey]:
                                                  !current[revealKey],
                                              })
                                            )
                                          }
                                        />
                                      )
                                    }
                                    return (
                                      <Input
                                        key={credential.name}
                                        autoComplete="off"
                                        data-1p-ignore
                                        data-bwignore="true"
                                        data-form-type="other"
                                        data-lpignore="true"
                                        name={`${selectedApp.slug}__${credential.name}`}
                                        placeholder={label}
                                        type="text"
                                        value={value}
                                        onChange={(event) =>
                                          onValueChange(event.target.value)
                                        }
                                      />
                                    )
                                  }
                                )}
                                {selectedApp.sourceType !== "local_repo" ? (
                                  <label className="mt-1 flex items-start gap-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-2 text-xs leading-5 text-[var(--claw-text-secondary)]">
                                    <input
                                      type="checkbox"
                                      className="mt-1"
                                      checked={retainUnverifiedCredentials}
                                      onChange={(event) =>
                                        setRetainUnverifiedCredentials(
                                          event.target.checked
                                        )
                                      }
                                    />
                                    <span>
                                      If this provider has no harmless
                                      verification endpoint, keep the credential
                                      encrypted as configured but unverified.
                                      Failed verification attempts are still
                                      deleted.
                                    </span>
                                  </label>
                                ) : null}
                              </>
                            )}
                            {connectionId &&
                            !selectedConnectionRequiresDevice ? (
                              <Button
                                className="mt-2"
                                type="button"
                                disabled={updateConnectionMutation.isPending}
                                onClick={() =>
                                  updateConnectionMutation.mutate()
                                }
                              >
                                {updateConnectionMutation.isPending
                                  ? "Saving changes…"
                                  : "Save connection changes"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <details className="rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold">
                          <span className="flex items-center gap-3">
                            <StepBadge value={3} />
                            Add support agents{" "}
                            <span className="text-[var(--claw-text-secondary)]">
                              (optional)
                            </span>
                          </span>
                          <span className="text-[var(--claw-text-muted)]">
                            ⌄
                          </span>
                        </summary>
                        <div className="mt-3 grid max-w-[760px] gap-3 md:grid-cols-2">
                          <SupportAgentPicker
                            refObject={auditorPickerRef}
                            label="Auditor agent"
                            selectedCard={selectedAuditorAgentCard}
                            options={supportAgentOptions}
                            open={auditorPickerOpen}
                            disabled={!auditorRoleSupported}
                            disabledReason={auditorRoleDisabledReason}
                            recoveryActions={compatibleAgentRecoveryActions}
                            onOpenChange={setAuditorPickerOpen}
                            onSelect={(agentId) => {
                              setSelectedAuditorAgentId(agentId)
                              setAuditorPickerOpen(false)
                            }}
                          />
                          <SupportAgentPicker
                            refObject={managerPickerRef}
                            label="Manager agent"
                            selectedCard={selectedManagerAgentCard}
                            options={supportAgentOptions}
                            open={managerPickerOpen}
                            disabled={!managerRoleSupported}
                            disabledReason={managerRoleDisabledReason}
                            recoveryActions={compatibleAgentRecoveryActions}
                            onOpenChange={setManagerPickerOpen}
                            onSelect={(agentId) => {
                              setSelectedManagerAgentId(agentId)
                              setManagerPickerOpen(false)
                            }}
                          />
                        </div>
                      </details>

                      <div className="rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
                        <div className="grid gap-3 lg:grid-cols-[minmax(360px,0.58fr)_minmax(0,0.42fr)]">
                          <div
                            ref={policyPickerRef}
                            className="relative space-y-2"
                          >
                            <div className="flex items-center gap-3">
                              <StepBadge value={4} />
                              <div className="text-base font-semibold">
                                Policy
                              </div>
                            </div>
                            <button
                              type="button"
                              className="flex h-11 w-full max-w-[520px] items-center justify-between gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-3 text-left text-sm transition outline-none hover:border-white/20"
                              onClick={() =>
                                setPolicyPickerOpen((open) => !open)
                              }
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">
                                  {selectedApprovalProfile?.label
                                    ? `${selectedApprovalProfile.label} policy`
                                    : "Default policy"}
                                </span>
                                <span className="claw-caption block truncate text-[var(--claw-text-secondary)]">
                                  {selectedApprovalProfile?.description ??
                                    "Use the marketplace default approval policy."}
                                </span>
                              </span>
                              <span className="text-[var(--claw-text-muted)]">
                                ⌄
                              </span>
                            </button>
                            {policyPickerOpen ? (
                              <div className="absolute z-40 mt-1 max-h-60 w-full max-w-[520px] overflow-auto rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-page)] p-1 shadow-xl">
                                {ordinaryApprovalProfiles.map((profile) => (
                                  <button
                                    key={profile.id}
                                    type="button"
                                    className={cn(
                                      "w-full rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[var(--claw-bg-surface)]",
                                      approvalProfileId === profile.id &&
                                        "bg-[color-mix(in_srgb,var(--claw-accent-blue)_18%,var(--claw-bg-surface))]"
                                    )}
                                    onClick={() => {
                                      setApprovalProfileId(profile.id)
                                      setDangerousPolicyAcknowledged(false)
                                      setPolicyPickerOpen(false)
                                    }}
                                  >
                                    <span className="block truncate font-semibold">
                                      {profile.label} policy
                                    </span>
                                    <span className="claw-caption block truncate text-[var(--claw-text-secondary)]">
                                      {profile.description}
                                    </span>
                                  </button>
                                ))}
                                {dangerousApprovalProfile ? (
                                  <button
                                    type="button"
                                    className="mt-1 w-full border-t border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] px-2 pt-2 pb-1 text-left text-xs font-semibold text-amber-300 hover:text-amber-200"
                                    onClick={() => {
                                      setDangerousPolicyAdvancedOpen(true)
                                      setPolicyPickerOpen(false)
                                    }}
                                  >
                                    Advanced: remove per-action approvals…
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            <div className="text-xs font-medium text-[var(--claw-text-secondary)]">
                              {selectedApprovalProfile?.description ??
                                "Use the marketplace default approval policy for this app."}
                            </div>
                            {selectedApprovalProfile?.id ===
                            DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID ? (
                              <div className="space-y-2 rounded-[4px] border border-red-400/40 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
                                <div className="font-semibold">
                                  Advanced dangerous policy active
                                </div>
                                <div>
                                  {DANGEROUS_MARKETPLACE_POLICY_WARNING}
                                </div>
                                <button
                                  type="button"
                                  className="font-semibold text-white underline underline-offset-2"
                                  onClick={() => {
                                    const safeProfile =
                                      ordinaryApprovalProfiles.find(
                                        (profile) => profile.defaultSelected
                                      ) ?? ordinaryApprovalProfiles[0]
                                    if (safeProfile) {
                                      setApprovalProfileId(safeProfile.id)
                                      setDangerousPolicyAcknowledged(false)
                                      setDangerousPolicyAdvancedOpen(false)
                                    }
                                  }}
                                >
                                  Return to the safe policy
                                </button>
                              </div>
                            ) : null}
                            {dangerousPolicyAdvancedOpen &&
                            dangerousApprovalProfile &&
                            selectedApprovalProfile?.id !==
                              DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID ? (
                              <div className="space-y-3 rounded-[4px] border border-red-400/40 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
                                <div className="font-semibold">
                                  Advanced policy warning
                                </div>
                                <div>
                                  {DANGEROUS_MARKETPLACE_POLICY_WARNING}
                                </div>
                                <label className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={dangerousPolicyAcknowledged}
                                    onChange={(event) =>
                                      setDangerousPolicyAcknowledged(
                                        event.target.checked
                                      )
                                    }
                                  />
                                  <span>
                                    I understand that selected actions can run
                                    without asking me each time.
                                  </span>
                                </label>
                                <div className="flex gap-3">
                                  <button
                                    type="button"
                                    disabled={!dangerousPolicyAcknowledged}
                                    className="font-semibold text-white underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => {
                                      setApprovalProfileId(
                                        dangerousApprovalProfile.id
                                      )
                                      setDangerousPolicyAdvancedOpen(false)
                                    }}
                                  >
                                    Activate dangerous policy
                                  </button>
                                  <button
                                    type="button"
                                    className="text-red-100 underline underline-offset-2"
                                    onClick={() => {
                                      setDangerousPolicyAdvancedOpen(false)
                                      setDangerousPolicyAcknowledged(false)
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                          {selectedPolicy ? (
                            <div className="border-t border-[color-mix(in_srgb,var(--claw-border)_24%,transparent)] pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                              <div className="max-w-md text-sm leading-6 text-[var(--claw-text-primary)]">
                                {policySummary(selectedPolicy)}
                              </div>
                              <details className="mt-3 text-sm">
                                <summary className="cursor-pointer text-[#8bbcff]">
                                  View policy details
                                </summary>
                                <div className="mt-3">
                                  <PolicyPanel policy={selectedPolicy} />
                                </div>
                              </details>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {selectedApp.sourceType === "local_repo" ? (
                        <div className="rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-base font-semibold">
                                Autonomy & Tools
                              </div>
                              <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
                                Separate from documentation automation.
                                Installed packs and Hermes dispatches use this
                                current policy.
                              </div>
                            </div>
                            <select
                              className="h-10 rounded-[4px] border bg-transparent px-3 text-sm"
                              value={autonomyPolicy.mode}
                              onChange={(event) => {
                                const next = defaultAutonomyPolicy(
                                  event.target.value as LocalAppAutonomyMode
                                )
                                persistAutonomyPolicy(next)
                              }}
                            >
                              {autonomyPolicy.mode ===
                              DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID ? (
                                <option
                                  value={DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID}
                                >
                                  {
                                    LOCAL_AUTONOMY_MODE_LABELS.dangerously_skip_permissions
                                  }
                                </option>
                              ) : null}
                              {Object.entries(LOCAL_AUTONOMY_MODE_LABELS)
                                .filter(
                                  ([mode]) =>
                                    mode !==
                                    DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID
                                )
                                .map(([mode, label]) => (
                                  <option key={mode} value={mode}>
                                    {label}
                                  </option>
                                ))}
                            </select>
                          </div>
                          {autonomyPolicy.mode ===
                          "dangerously_skip_permissions" ? (
                            <div className="mt-3 space-y-2 rounded-[4px] border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
                              <div className="font-semibold">
                                Advanced dangerous autonomy is active
                              </div>
                              <div>{DANGEROUS_MARKETPLACE_POLICY_WARNING}</div>
                              <label className="flex items-start gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={dangerousAutonomyAcknowledged}
                                  onChange={(event) =>
                                    setDangerousAutonomyAcknowledged(
                                      event.target.checked
                                    )
                                  }
                                />
                                <span>
                                  I understand this warning for the next agent
                                  connection.
                                </span>
                              </label>
                              <button
                                type="button"
                                className="text-xs font-semibold text-white underline underline-offset-2"
                                onClick={() => {
                                  persistAutonomyPolicy(
                                    defaultAutonomyPolicy("safe_default")
                                  )
                                  setDangerousAutonomyAcknowledged(false)
                                  setDangerousAutonomyAdvancedOpen(false)
                                }}
                              >
                                Return to safe default
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3">
                              {!dangerousAutonomyAdvancedOpen ? (
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-amber-300 underline underline-offset-2"
                                  onClick={() =>
                                    setDangerousAutonomyAdvancedOpen(true)
                                  }
                                >
                                  Advanced: allow actions without per-action
                                  approval…
                                </button>
                              ) : (
                                <div className="space-y-3 rounded-[4px] border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
                                  <div className="font-semibold">
                                    Advanced autonomy warning
                                  </div>
                                  <div>
                                    {DANGEROUS_MARKETPLACE_POLICY_WARNING}
                                  </div>
                                  <label className="flex items-start gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      className="mt-1"
                                      checked={dangerousAutonomyAcknowledged}
                                      onChange={(event) =>
                                        setDangerousAutonomyAcknowledged(
                                          event.target.checked
                                        )
                                      }
                                    />
                                    <span>
                                      I understand that configured external
                                      actions can run without asking me each
                                      time.
                                    </span>
                                  </label>
                                  <div className="flex gap-3 text-xs">
                                    <button
                                      type="button"
                                      disabled={!dangerousAutonomyAcknowledged}
                                      className="font-semibold text-white underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                                      onClick={() => {
                                        persistAutonomyPolicy(
                                          defaultAutonomyPolicy(
                                            "dangerously_skip_permissions"
                                          ),
                                          true
                                        )
                                        setDangerousAutonomyAdvancedOpen(false)
                                      }}
                                    >
                                      Activate dangerous autonomy
                                    </button>
                                    <button
                                      type="button"
                                      className="underline underline-offset-2"
                                      onClick={() => {
                                        setDangerousAutonomyAdvancedOpen(false)
                                        setDangerousAutonomyAcknowledged(false)
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-3 grid gap-3 lg:grid-cols-3">
                            <PolicyToggleGroup
                              title="Internal"
                              rows={[
                                ["readRecords", "read records"],
                                [
                                  "draftRecords",
                                  "draft records/content/messages",
                                ],
                                [
                                  "writeInternalRecords",
                                  "write/update internal records",
                                ],
                                ["createTasks", "create tasks"],
                                ["updateTasks", "update tasks"],
                                [
                                  "updateInternalStatuses",
                                  "update internal statuses",
                                ],
                              ].map(([key, label]) => ({
                                key,
                                label,
                                value:
                                  autonomyPolicy.internal[
                                    key as keyof LocalAppAutonomyPolicy["internal"]
                                  ],
                                status: "allowed by policy",
                                onToggle: () =>
                                  persistAutonomyPolicy({
                                    ...autonomyPolicy,
                                    mode: "custom_policy",
                                    internal: {
                                      ...autonomyPolicy.internal,
                                      [key]:
                                        !autonomyPolicy.internal[
                                          key as keyof LocalAppAutonomyPolicy["internal"]
                                        ],
                                    },
                                  }),
                              }))}
                            />
                            <PolicyToggleGroup
                              title="External"
                              rows={externalPolicyKeys.map((key) => ({
                                key,
                                label: key
                                  .replace(/[A-Z]/g, " $&")
                                  .toLowerCase(),
                                value:
                                  autonomyPolicy.external[key] !== "disabled",
                                status: autonomyPolicy.external[key].replaceAll(
                                  "_",
                                  " "
                                ),
                                onToggle: () => {
                                  const current = autonomyPolicy.external[key]
                                  const next =
                                    current === "disabled"
                                      ? "approval_required"
                                      : current === "approval_required"
                                        ? "allowed"
                                        : "disabled"
                                  persistAutonomyPolicy({
                                    ...autonomyPolicy,
                                    mode: "custom_policy",
                                    external: {
                                      ...autonomyPolicy.external,
                                      [key]: next,
                                    },
                                  })
                                },
                              }))}
                            />
                            <PolicyToggleGroup
                              title="Lifecycle"
                              rows={lifecyclePolicyKeys.map((key) => ({
                                key,
                                label: key
                                  .replace(/^mark/, "mark ")
                                  .replace(/[A-Z]/g, " $&")
                                  .toLowerCase(),
                                value:
                                  autonomyPolicy.lifecycleStatus[key] !==
                                  "disabled",
                                status: autonomyPolicy.lifecycleStatus[
                                  key
                                ].replaceAll("_", " "),
                                onToggle: () => {
                                  const current =
                                    autonomyPolicy.lifecycleStatus[key]
                                  const next =
                                    current === "disabled"
                                      ? "approval_required"
                                      : current === "approval_required"
                                        ? "allowed_with_evidence"
                                        : "disabled"
                                  persistAutonomyPolicy({
                                    ...autonomyPolicy,
                                    mode: "custom_policy",
                                    lifecycleStatus: {
                                      ...autonomyPolicy.lifecycleStatus,
                                      [key]: next,
                                    },
                                  })
                                },
                              }))}
                            />
                          </div>
                          <div className="mt-3 text-xs text-[var(--claw-text-secondary)]">
                            Tool inventory is policy-aware but Hermes
                            availability is best-effort until Hermes advertises
                            granular tool categories; unavailable tools must be
                            reported as tool unavailable.
                          </div>
                          {!isLocalAppConnectorApp ? (
                            <details className="mt-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-3">
                              <summary className="cursor-pointer text-sm font-medium">
                                Advanced / Runtime
                              </summary>
                              <div className="mt-2 text-xs text-[var(--claw-text-secondary)]">
                                Runtime recovery profile passed to
                                Hermes/source-host. Relay Console does not call
                                local URLs from Railway.
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-[var(--claw-text-secondary)] md:grid-cols-2">
                                <div className="min-w-0">
                                  Repo path:{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.repoPath ||
                                      "not set"}
                                  </code>
                                </div>
                                <div className="min-w-0">
                                  App URL:{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.appUrl || "not set"}
                                  </code>
                                </div>
                                <div className="min-w-0">
                                  Agent API URL:{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.agentApiUrl ||
                                      "not set"}
                                  </code>
                                </div>
                                <div className="min-w-0">
                                  Start command:{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.startCommand ||
                                      "not set"}
                                  </code>
                                </div>
                                <div className="min-w-0">
                                  Health check:{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.healthCheckUrl ||
                                      "not set"}
                                  </code>
                                </div>
                                <div>
                                  Auto-start:{" "}
                                  {selectedRuntimeProfile.autoStartAllowed
                                    ? "allowed"
                                    : "disabled"}
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-[var(--claw-text-secondary)]">
                                Hard stops:{" "}
                                {selectedRuntimeProfile.hardStopConditions.join(
                                  ", "
                                ) || "none configured"}
                              </div>
                            </details>
                          ) : null}
                        </div>
                      ) : null}

                      {isLocalAppConnectorApp ? (
                        <div className="rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-semibold">
                                LocalAppConnector Agent API connection
                              </div>
                              <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
                                Use Connect to auto-detect the local app,
                                configure the Agent API, map the campaign, sync
                                policy, refresh docs, and install packs. Legacy
                                route namespace: /api/openclaw.
                              </div>
                            </div>
                            <Badge
                              variant={
                                localappconnectorPolicySync?.status === "synced" &&
                                !localappconnectorPolicySync.mismatch
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {localappconnectorPolicySync?.status ?? "unsynced"}
                            </Badge>
                          </div>
                          {lastAutoConnectResult ? (
                            <div className="mt-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_24%,var(--claw-border))] bg-[var(--claw-bg-muted)] p-3 text-sm">
                              <div className="font-medium">
                                {lastAutoConnectResult.message}
                              </div>
                              <div className="mt-2 grid gap-2 text-xs text-[var(--claw-text-secondary)] md:grid-cols-3">
                                {Object.entries(
                                  lastAutoConnectResult.checklist
                                ).map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="flex items-center gap-2"
                                  >
                                    <span
                                      className={cn(
                                        "size-2 rounded-full",
                                        value
                                          ? "bg-emerald-400"
                                          : "bg-yellow-400"
                                      )}
                                    />
                                    <span>
                                      {key
                                        .replace(/[A-Z]/g, " $&")
                                        .toLowerCase()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <div className="mt-3 grid gap-2 text-xs text-[var(--claw-text-secondary)] md:grid-cols-4">
                            <div>
                              Agent API:{" "}
                              {localappconnectorOpenClawStatus?.connected
                                ? "connected"
                                : "not configured"}
                            </div>
                            <div>
                              Connection:{" "}
                              {localappconnectorOpenClawStatus?.useMockMode
                                ? "mock"
                                : localappconnectorOpenClawStatus?.connected
                                  ? "real"
                                  : "none"}
                            </div>
                            <div>
                              Bearer key:{" "}
                              {localappconnectorOpenClawStatus?.hasBearerKey
                                ? "stored"
                                : "missing"}
                            </div>
                            <div>
                              Hermes credential attached:{" "}
                              {localappconnectorOpenClawStatus?.hermesCredentialAttached
                                ? "yes"
                                : "not confirmed"}
                            </div>
                          </div>
                          <details className="mt-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-3">
                            <summary className="cursor-pointer text-sm font-medium">
                              Advanced / troubleshooting
                            </summary>
                            <div className="mt-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_24%,transparent)] bg-[var(--claw-bg-muted)] p-3">
                              <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                                Runtime
                              </div>
                              <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
                                Used by Hermes/source-host runtime recovery when
                                the local app is unreachable. Relay Console does
                                not call local URLs from Railway.
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-[var(--claw-text-secondary)] md:grid-cols-2">
                                <div className="min-w-0">
                                  <span className="font-medium text-[var(--claw-text-primary)]">
                                    Repo path:
                                  </span>{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.repoPath ||
                                      "not set"}
                                  </code>
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-[var(--claw-text-primary)]">
                                    App URL:
                                  </span>{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.appUrl || "not set"}
                                  </code>
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-[var(--claw-text-primary)]">
                                    Agent API URL:
                                  </span>{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.agentApiUrl ||
                                      "not set"}
                                  </code>
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-[var(--claw-text-primary)]">
                                    Start command:
                                  </span>{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.startCommand ||
                                      "not set"}
                                  </code>
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-[var(--claw-text-primary)]">
                                    Health check:
                                  </span>{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.healthCheckUrl ||
                                      "not set"}
                                  </code>
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-[var(--claw-text-primary)]">
                                    Backend health:
                                  </span>{" "}
                                  <code className="break-all">
                                    {selectedRuntimeProfile.backendHealthCheckUrl ||
                                      "not set"}
                                  </code>
                                </div>
                                <div>
                                  <span className="font-medium text-[var(--claw-text-primary)]">
                                    Auto-start:
                                  </span>{" "}
                                  {selectedRuntimeProfile.autoStartAllowed
                                    ? "allowed"
                                    : "disabled"}
                                </div>
                                <div>
                                  <span className="font-medium text-[var(--claw-text-primary)]">
                                    Expected ports:
                                  </span>{" "}
                                  {selectedRuntimeProfile.expectedPorts.join(
                                    ", "
                                  ) || "not set"}
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-[var(--claw-text-secondary)]">
                                Hard stops:{" "}
                                {selectedRuntimeProfile.hardStopConditions.join(
                                  ", "
                                ) || "none configured"}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-[var(--claw-text-secondary)]">
                              Agent API base URL. Legacy route namespace:{" "}
                              /api/openclaw.
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                              <Input
                                value={localappconnectorOpenClawBaseUrlDraft}
                                onChange={(event) =>
                                  setLocalAppConnectorOpenClawBaseUrlDraft(
                                    event.target.value
                                  )
                                }
                                placeholder="Agent API base URL"
                              />
                              <SecretCredentialInput
                                inputName={`${selectedApp.slug}__bearer_key`}
                                value={localappconnectorBearerKeyDraft}
                                revealed={
                                  revealedLocalAppConnectorBearerKeySlug ===
                                  selectedApp.slug
                                }
                                label={
                                  localappconnectorOpenClawStatus?.hasBearerKey
                                    ? "Bearer key saved"
                                    : "Bearer key"
                                }
                                onChange={setLocalAppConnectorBearerKeyDraft}
                                onToggleReveal={() =>
                                  setRevealedLocalAppConnectorBearerKeySlug(
                                    (current) =>
                                      current === selectedApp.slug
                                        ? null
                                        : selectedApp.slug
                                  )
                                }
                              />
                              <Button
                                type="button"
                                disabled={
                                  configureLocalAppConnectorOpenClawMutation.isPending ||
                                  !localappconnectorOpenClawBaseUrlDraft.trim()
                                }
                                onClick={() => {
                                  if (!selectedApp) return
                                  configureLocalAppConnectorOpenClawMutation.mutate({
                                    appSlug: selectedApp.slug,
                                    openclawBaseUrl:
                                      localappconnectorOpenClawBaseUrlDraft,
                                    bearerKey: localappconnectorBearerKeyDraft || null,
                                    campaignId:
                                      localappconnectorCampaignIdDraft || null,
                                    campaignName:
                                      localappconnectorCampaignNameDraft || null,
                                  })
                                }}
                              >
                                Save Agent API
                              </Button>
                            </div>
                            <div className="mt-2 grid gap-2 text-xs text-[var(--claw-text-secondary)] md:grid-cols-3">
                              <div>
                                Agent API:{" "}
                                {localappconnectorOpenClawStatus?.connected
                                  ? "connected"
                                  : "not configured"}
                              </div>
                              <div>
                                Connection:{" "}
                                {localappconnectorOpenClawStatus?.useMockMode
                                  ? "mock"
                                  : localappconnectorOpenClawStatus?.connected
                                    ? "real"
                                    : "none"}
                              </div>
                              <div>
                                Bearer key:{" "}
                                {localappconnectorOpenClawStatus?.hasBearerKey
                                  ? "stored"
                                  : "missing"}
                              </div>
                            </div>
                            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                              <div>
                                <div className="text-xs text-[var(--claw-text-secondary)]">
                                  Relay Console app mode
                                </div>
                                <div className="font-mono">
                                  {autonomyPolicy.mode}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--claw-text-secondary)]">
                                  LocalAppConnector campaign mode
                                </div>
                                <div className="font-mono">
                                  {localappconnectorPolicySync?.localappconnectorMode ??
                                    "not synced"}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--claw-text-secondary)]">
                                  Last sync
                                </div>
                                <div>
                                  {localappconnectorPolicySync?.lastSyncAt ?? "never"}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--claw-text-secondary)]">
                                  Result
                                </div>
                                <div>
                                  {localappconnectorPolicySync?.message ??
                                    "Relay Console mode set, but LocalAppConnector campaign policy not synced."}
                                </div>
                              </div>
                            </div>
                            {localappconnectorPolicySync?.mismatch ? (
                              <div className="mt-3 rounded-[4px] border border-yellow-400/35 bg-yellow-500/10 p-3 text-sm text-yellow-100">
                                Relay Console mode and LocalAppConnector campaign policy
                                may not match.
                              </div>
                            ) : null}
                            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                              <Input
                                value={localappconnectorCampaignIdDraft}
                                onChange={(event) =>
                                  setLocalAppConnectorCampaignIdDraft(
                                    event.target.value
                                  )
                                }
                                placeholder="LocalAppConnector campaign ID"
                              />
                              <Input
                                value={localappconnectorCampaignNameDraft}
                                onChange={(event) =>
                                  setLocalAppConnectorCampaignNameDraft(
                                    event.target.value
                                  )
                                }
                                placeholder="Campaign name"
                              />
                              <Button
                                type="button"
                                disabled={syncLocalAppConnectorPolicyMutation.isPending}
                                onClick={() => {
                                  if (!selectedApp) return
                                  syncLocalAppConnectorPolicyMutation.mutate({
                                    appSlug: selectedApp.slug,
                                    campaignId:
                                      localappconnectorCampaignIdDraft || null,
                                    campaignName:
                                      localappconnectorCampaignNameDraft || null,
                                  })
                                }}
                              >
                                Sync policy
                              </Button>
                            </div>
                          </details>
                        </div>
                      ) : null}

                      {selectedApp.sourceType === "local_repo" ? (
                        <NeededToolsPanel
                          requests={toolRequestsQuery.data ?? []}
                          appSlug={selectedApp.slug}
                          queryStatus={
                            toolRequestsQuery.isFetching
                              ? "refreshing"
                              : toolRequestsQuery.isError
                                ? "error"
                                : "ready"
                          }
                          connections={connections}
                          onStatusChange={(id, status) =>
                            updateToolRequestStatusMutation.mutate({
                              id,
                              status,
                            })
                          }
                          updating={updateToolRequestStatusMutation.isPending}
                        />
                      ) : null}

                      {generatedPackNeedsAcknowledgement ? (
                        <label className="flex items-start gap-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-danger)_28%,var(--claw-border))] p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={acknowledgeGeneratedDraftRisk}
                            onChange={(event) =>
                              setAcknowledgeGeneratedDraftRisk(
                                event.target.checked
                              )
                            }
                          />
                          <span>
                            <span className="font-medium">
                              Generated draft warning
                            </span>
                            <span className="mt-1 block text-xs text-[var(--claw-text-secondary)]">
                              This high-risk pack is generated and not
                              published. Approval gates still apply.
                            </span>
                          </span>
                        </label>
                      ) : null}

                      {selectedAppNeedsUserOAuth &&
                      selectedXConnectionReady &&
                      selectedXConnection ? (
                        <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_28%,var(--claw-border))] bg-[var(--claw-bg-surface)] text-sm">
                          <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.45fr)] lg:items-center">
                            <div>
                              <div>
                                <span className="font-semibold text-[var(--claw-text-primary)]">
                                  Connected X account:
                                </span>{" "}
                                <span className="text-[var(--claw-text-secondary)]">
                                  @
                                  {String(
                                    selectedXConnection.metadata?.xHandle ??
                                      "unknown"
                                  )}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    reauthorizeXOAuthMutation.isPending ||
                                    selectedAppBetaUnavailable
                                  }
                                  onClick={() =>
                                    reauthorizeXOAuthMutation.mutate()
                                  }
                                >
                                  <RefreshCw className="mr-2 size-4" />
                                  Re-authorize X account
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={disconnectXOAuthMutation.isPending}
                                  onClick={() =>
                                    disconnectXOAuthMutation.mutate()
                                  }
                                >
                                  Disconnect X account
                                </Button>
                              </div>
                            </div>
                            <div>
                              <Button
                                className="h-11 w-full text-base"
                                disabled={
                                  Boolean(connectBlockedReason) ||
                                  connectAppMutation.isPending
                                }
                                onClick={() => connectAppMutation.mutate()}
                              >
                                {connectButtonLabel}
                              </Button>
                              {connectBlockedReason ? (
                                <div className="mt-2 text-sm font-medium text-[var(--claw-text-secondary)]">
                                  {connectBlockedReason}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-5">
                          <Button
                            className="h-12 min-w-[320px] text-base"
                            disabled={
                              Boolean(connectBlockedReason) ||
                              connectAppMutation.isPending
                            }
                            onClick={() => connectAppMutation.mutate()}
                          >
                            {connectButtonLabel}
                          </Button>
                          {connectBlockedReason ? (
                            <div className="text-sm font-medium text-[var(--claw-text-secondary)]">
                              {connectBlockedReason}
                            </div>
                          ) : null}
                        </div>
                      )}

                      <details
                        open={advancedOpen}
                        onToggle={(event) =>
                          setAdvancedOpen(event.currentTarget.open)
                        }
                        className="rounded-[4px] border bg-[var(--claw-bg-surface)]"
                      >
                        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                          Advanced
                        </summary>
                        <div className="space-y-4 border-t p-4">
                          <SourcePanel
                            app={selectedApp}
                            detail={generatedPackDetail}
                            sourceHosts={localSourceHostsQuery.data ?? []}
                            sourceHostsLoading={localSourceHostsQuery.isLoading}
                            sourceHostsError={localSourceHostsQuery.isError}
                            busy={updatePackMutation.isPending}
                            onUpdatePack={() =>
                              updatePackMutation.mutate(undefined)
                            }
                            onSelectSourceHost={(hostId) =>
                              updateLocalAppSourceMutation.mutate({
                                appSlug: selectedApp.slug,
                                hostId,
                              })
                            }
                            sourceHostBusy={
                              updateLocalAppSourceMutation.isPending
                            }
                          />
                          {selectedPackQuality?.level !== "curated" ? (
                            <GeneratedPackReviewPanel
                              detail={generatedPackDetail}
                              coverage={packCoverageQuery.data}
                              loading={generatedPackDetailQuery.isLoading}
                              onRerun={() =>
                                rerunGeneratedPackMutation.mutate()
                              }
                              onPromote={() =>
                                promoteGeneratedPackMutation.mutate()
                              }
                              onPublish={() =>
                                publishGeneratedPackMutation.mutate()
                              }
                              onReject={() =>
                                rejectGeneratedPackMutation.mutate()
                              }
                              onNeedsManualReview={() =>
                                manualReviewGeneratedPackMutation.mutate()
                              }
                              onImportSources={(input) =>
                                importGeneratedPackSourcesMutation.mutate(input)
                              }
                              busy={
                                rerunGeneratedPackMutation.isPending ||
                                promoteGeneratedPackMutation.isPending ||
                                publishGeneratedPackMutation.isPending ||
                                rejectGeneratedPackMutation.isPending ||
                                manualReviewGeneratedPackMutation.isPending ||
                                importGeneratedPackSourcesMutation.isPending
                              }
                            />
                          ) : null}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">
                                Capabilities
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {selectedApp.slug === "outlook" ? (
                                <OutlookCapabilitySelector
                                  app={selectedApp}
                                  effectiveCapabilities={effectiveCapabilities}
                                  onChange={setSelectedCapabilities}
                                />
                              ) : (
                                <div className="grid gap-2 md:grid-cols-2">
                                  {selectedApp.capabilities.map(
                                    (capability) => {
                                      const checked =
                                        effectiveCapabilities.includes(
                                          capability.id
                                        )
                                      return (
                                        <label
                                          key={capability.id}
                                          className="flex gap-2 rounded-[4px] border p-3 text-sm"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(event) => {
                                              const next = new Set(
                                                effectiveCapabilities
                                              )
                                              if (event.target.checked)
                                                next.add(capability.id)
                                              else next.delete(capability.id)
                                              setSelectedCapabilities(next)
                                            }}
                                          />
                                          <span>
                                            <span className="font-medium">
                                              {capability.label}
                                            </span>
                                            <span className="mt-1 block text-xs text-[var(--claw-text-secondary)]">
                                              {capability.description}
                                            </span>
                                          </span>
                                        </label>
                                      )
                                    }
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                          <PackPreview
                            appSlug={selectedApp.slug}
                            runtimeFormat={
                              previewQuery.data?.runtimeFormat ?? runtimeFormat
                            }
                            installSupport={String(
                              previewQuery.data?.metadata?.installSupport ??
                                "installable"
                            )}
                            qualityLevel={String(
                              previewQuery.data?.metadata?.qualityLevel ??
                                getPackQuality(selectedApp).level
                            )}
                            publicationStatus={String(
                              previewQuery.data?.metadata?.publicationStatus ??
                                getPackQuality(selectedApp).publicationStatus
                            )}
                            confidence={String(
                              previewQuery.data?.metadata?.confidence ??
                                getPackQuality(selectedApp).confidence
                            )}
                            previewMetadata={previewQuery.data?.metadata ?? {}}
                            sourceMetadata={
                              (selectedApp.sourceMetadata ?? {}) as Record<
                                string,
                                unknown
                              >
                            }
                            files={previewFiles}
                            selectedFile={selectedFile}
                            onSelectFile={setSelectedFilePath}
                          />
                          {lastInstallResult ? (
                            <InstallResultPanel result={lastInstallResult} />
                          ) : null}
                          <AuditPanel events={marketplaceAudit} />
                        </div>
                      </details>
                    </>
                  ) : (
                    <MarketplaceReadOnlyDetails
                      app={selectedApp}
                      connections={selectedAppConnections}
                      installs={selectedAppActiveInstalls}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : catalogUnavailable ? (
            <MarketplaceDiagnostics
              endpoint={`/workspaces/${workspaceId}/marketplace/catalog`}
              responseCount={0}
              selectedCategory={category}
              riskFilter={riskFilter}
              search={search}
              error={catalogQuery.error}
              isLoading={catalogQuery.isLoading}
              isRetrying={catalogQuery.isFetching}
              onRetry={() => {
                void catalogQuery.refetch()
              }}
            />
          ) : effectiveMarketplaceView === "local" && canManageMarketplace ? (
            localFilteredApps.length ? (
              <LocalAppsSection
                apps={localFilteredApps}
                installs={installs}
                sourceHosts={localSourceHostsQuery.data ?? []}
                sourceHostsLoading={localSourceHostsQuery.isLoading}
                sourceHostsError={localSourceHostsQuery.isError}
                onSelectSourceHost={(app, hostId) =>
                  updateLocalAppSourceMutation.mutate({
                    appSlug: app.slug,
                    hostId,
                  })
                }
                sourceHostBusy={updateLocalAppSourceMutation.isPending}
                onUpdatePack={(app) => {
                  selectMarketplaceApp(app)
                  updatePackMutation.mutate(app.slug)
                }}
                updatePackBusy={updatePackMutation.isPending}
                onSelectApp={(app) => {
                  selectMarketplaceApp(app)
                }}
              />
            ) : (
              <LocalAppsEmptyState onAdd={() => setAddAppMode("local")} />
            )
          ) : effectiveMarketplaceView === "connections" ? (
            <ConnectionsOverview
              connectedApps={connectedFilteredApps}
              unconnectedApps={unconnectedFilteredApps}
              connections={connections}
              installs={installs}
              canManageMarketplace={canManageMarketplace}
              onSelectApp={selectMarketplaceApp}
            />
          ) : effectiveMarketplaceView === "installed" ? (
            filteredApps.length ? (
              <InstalledPacksOverview
                apps={filteredApps}
                installs={installs}
                connections={connections}
                onSelectApp={selectMarketplaceApp}
              />
            ) : (
              <NoResultsCard
                selectedCategory={category}
                riskFilter={riskFilter}
                search={search}
              />
            )
          ) : effectiveMarketplaceView === "review" ? (
            filteredApps.length ? (
              <ReviewUpdatesOverview
                apps={filteredApps}
                installs={installs}
                onSelectApp={selectMarketplaceApp}
              />
            ) : (
              <ReviewEmptyState />
            )
          ) : filteredApps.length ? (
            <MarketplaceAppGrid
              apps={filteredApps}
              connections={connections}
              installs={installs}
              onSelectApp={selectMarketplaceApp}
            />
          ) : hasCatalogApps ? (
            <NoResultsCard
              selectedCategory={category}
              riskFilter={riskFilter}
              search={search}
            />
          ) : (
            <MarketplaceDiagnostics
              endpoint={`/workspaces/${workspaceId}/marketplace/catalog`}
              responseCount={catalogTotalCount}
              selectedCategory={category}
              riskFilter={riskFilter}
              search={search}
              error={catalogQuery.error}
              isLoading={catalogQuery.isLoading}
              isRetrying={catalogQuery.isFetching}
              onRetry={() => {
                void catalogQuery.refetch()
              }}
            />
          )}
          {catalogQuery.hasNextPage && !selectedApp ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                disabled={catalogQuery.isFetchingNextPage}
                onClick={() => void catalogQuery.fetchNextPage()}
              >
                {catalogQuery.isFetchingNextPage
                  ? "Loading applications…"
                  : "Load more applications"}
              </Button>
            </div>
          ) : null}
        </section>
      </main>
      {canManageMarketplace ? (
        <RemoveInstallDialog
          target={removeInstallTarget}
          busy={removeInstallMutation.isPending}
          onCancel={() => {
            if (!removeInstallMutation.isPending) setRemoveInstallTarget(null)
          }}
          onConfirm={() => {
            if (removeInstallTarget) {
              removeInstallMutation.mutate(removeInstallTarget.install)
            }
          }}
        />
      ) : null}
    </>
  )
}
