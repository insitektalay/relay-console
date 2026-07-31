"use client"

import {
  DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
  isMarketplaceAgentRecoveryRuntime,
  type MarketplaceAgentRecoveryRequest,
  type MarketplaceAgentRecoveryRuntime,
} from "@/components/marketplace/marketplace-domain"
import { MarketplaceAgentRecoveryActions } from "@/components/marketplace/marketplace-install-controls"
import {
  getAgentRuntimeType,
  hasAgentRuntimeCapability,
} from "@/components/marketplace/marketplace-preview-ui"
import type {
  Agent,
  BridgeDevice,
  LocalAppAutonomyPolicy,
  MarketplaceApp,
  MarketplacePackPreviewFile,
  MarketplaceRoleManifestEntry,
  MarketplaceRuntimeFormat,
} from "@clawchat/contracts"
import { MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY } from "@clawchat/contracts"
import { useMemo } from "react"

export function useMarketplaceAgentCompatibility({
  acknowledgeGeneratedDraftRisk,
  agents,
  approvalProfileId,
  apps,
  autonomyPolicy,
  bridgeDevices,
  connectionId,
  credentialDrafts,
  dangerousAutonomyAcknowledged,
  dangerousPolicyAcknowledged,
  existingOperatorInstalled,
  generatedPackPublicationStatus,
  isLinkCrestApp,
  onCreateCompatibleAgent,
  onOpenRuntimePairing,
  packPreviewFiles,
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
}: {
  acknowledgeGeneratedDraftRisk: boolean
  agents: Agent[]
  approvalProfileId: string
  apps: MarketplaceApp[]
  autonomyPolicy: LocalAppAutonomyPolicy
  bridgeDevices: BridgeDevice[]
  connectionId: string
  credentialDrafts: Record<string, string>
  dangerousAutonomyAcknowledged: boolean
  dangerousPolicyAcknowledged: boolean
  existingOperatorInstalled: boolean
  generatedPackPublicationStatus: string | null
  isLinkCrestApp: boolean
  onCreateCompatibleAgent?: (input: MarketplaceAgentRecoveryRequest) => void
  onOpenRuntimePairing?: (input: MarketplaceAgentRecoveryRequest) => void
  packPreviewFiles: MarketplacePackPreviewFile[]
  runtimeFormat: MarketplaceRuntimeFormat
  selectedAgentIds: Set<string>
  selectedApp: MarketplaceApp | null
  selectedAppBetaUnavailable: boolean
  selectedAppBetaUnavailableMessage: string
  selectedAppNeedsUserOAuth: boolean
  selectedAppRoles: MarketplaceRoleManifestEntry[]
  selectedAppUnavailableMessage: string | null
  selectedAppUsesConnectorOAuth: boolean
  selectedAuditorAgentId: string
  selectedConnectionRequiresDevice: boolean
  selectedFilePath: string | null
  selectedManagerAgentId: string
  selectedPackQuality: MarketplaceApp["packQuality"] | null | undefined
  selectedXConnectionReady: boolean
  visibleCredentialRequirements: MarketplaceApp["credentialRequirements"]
}) {
  const previewFiles = packPreviewFiles
  const selectedFile =
    previewFiles.find((file) => file.relativePath === selectedFilePath) ??
    previewFiles[0] ??
    null
  const hasCatalogApps = apps.length > 0
  const workspaceHermesSkillInstallAvailable = Boolean(
    bridgeDevices.some(
      (device) =>
        device.status === "active" &&
        device.capabilities?.includes("clawchat.runtime.hermes") &&
        device.capabilities?.includes(
          MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY
        )
    )
  )
  const agentCards = useMemo(
    () =>
      agents.map((agent) => {
        const runtimeType = getAgentRuntimeType(agent)
        const hasHermesSkillInstall = hasAgentRuntimeCapability(
          agent,
          MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY
        )
        const hermesInstallAvailable =
          runtimeType === "hermes" &&
          (hasHermesSkillInstall || workspaceHermesSkillInstallAvailable)
        const openClawSupported = Boolean(
          selectedApp?.runtimeSupport.some(
            (support) =>
              support.format === "openclaw" &&
              support.installSupport === "installable"
          )
        )
        const hermesSupported = Boolean(
          selectedApp?.runtimeSupport.some(
            (support) =>
              support.format === "hermes" &&
              support.installSupport === "installable"
          )
        )
        const installable =
          runtimeType === "openclaw"
            ? openClawSupported
            : runtimeType === "hermes"
              ? hermesSupported && hermesInstallAvailable
              : false
        return {
          agent,
          runtimeType,
          installable,
          hasHermesSkillInstall,
          hermesInstallAvailable,
        }
      }),
    [agents, selectedApp?.runtimeSupport, workspaceHermesSkillInstallAvailable]
  )
  const generatedPackDetail = {
    publicationStatus: generatedPackPublicationStatus,
  }
  const generatedPackNeedsAcknowledgement = Boolean(
    selectedApp &&
    selectedPackQuality?.level !== "curated" &&
    (selectedApp.riskLevel === "high" ||
      selectedApp.riskLevel === "critical") &&
    generatedPackDetail?.publicationStatus !== "published"
  )
  const selectedOperatorAgentId = Array.from(selectedAgentIds)[0] ?? ""
  const selectedOperatorAgentCard =
    agentCards.find(({ agent }) => agent.id === selectedOperatorAgentId) ?? null

  const supportAgentOptions = agentCards.filter((card) => card.installable)
  const compatibleOperatorAgentCards = agentCards.filter(
    (card) => card.installable
  )
  const installableRecoveryRuntimes = useMemo(
    () =>
      selectedApp?.runtimeSupport
        .filter(
          (
            support
          ): support is typeof support & {
            format: MarketplaceAgentRecoveryRuntime
          } =>
            support.installSupport === "installable" &&
            isMarketplaceAgentRecoveryRuntime(support.format)
        )
        .map((support) => support.format) ?? [],
    [selectedApp?.runtimeSupport]
  )
  const selectedRecoveryRuntime =
    isMarketplaceAgentRecoveryRuntime(runtimeFormat) &&
    installableRecoveryRuntimes.includes(runtimeFormat)
      ? runtimeFormat
      : (installableRecoveryRuntimes[0] ?? "openclaw")
  const compatibleAgentRecoveryActions =
    selectedApp && installableRecoveryRuntimes.length ? (
      <MarketplaceAgentRecoveryActions
        appName={selectedApp.name}
        appSlug={selectedApp.slug}
        runtimeType={selectedRecoveryRuntime}
        onCreateCompatibleAgent={onCreateCompatibleAgent}
        onOpenRuntimePairing={onOpenRuntimePairing}
      />
    ) : null
  const selectedAuditorAgentCard =
    supportAgentOptions.find(
      ({ agent }) => agent.id === selectedAuditorAgentId
    ) ?? null
  const selectedManagerAgentCard =
    supportAgentOptions.find(
      ({ agent }) => agent.id === selectedManagerAgentId
    ) ?? null
  const managerRole =
    selectedAppRoles.find((role) => role.role === "manager") ?? null
  const auditorRole =
    selectedAppRoles.find((role) => role.role === "auditor") ?? null
  const selectedSourceMetadata = (selectedApp?.sourceMetadata ?? {}) as Record<
    string,
    unknown
  >
  const localRepoSourceConfigured =
    selectedApp?.sourceType === "local_repo" &&
    selectedSourceMetadata.sourceHostConfigured !== false
  const localRepoAutomaticRoleInstall =
    selectedApp?.sourceType === "local_repo" && localRepoSourceConfigured
  const managerRoleSupported =
    selectedAppRoles.some(
      (role) => role.role === "manager" && role.installable
    ) || localRepoAutomaticRoleInstall
  const auditorRoleSupported =
    selectedAppRoles.some(
      (role) => role.role === "auditor" && role.installable
    ) || localRepoAutomaticRoleInstall
  const managerRoleDisabledReason = managerRoleSupported
    ? null
    : selectedApp?.sourceType === "local_repo"
      ? managerRole
        ? "Manager docs are not available in this app's .clawchat source yet."
        : "This app does not define a manager role yet."
      : (managerRole?.notInstallableReason ??
        "The current published pack does not expose an installable manager role.")
  const auditorRoleDisabledReason = auditorRoleSupported
    ? null
    : (auditorRole?.notInstallableReason ??
      "The current published pack does not expose an installable auditor role.")
  const hasRequiredCredentialDrafts =
    Boolean(connectionId && !selectedConnectionRequiresDevice) ||
    (selectedAppNeedsUserOAuth
      ? Boolean(credentialDrafts.X_CLIENT_ID?.trim())
      : visibleCredentialRequirements.every(
          (credential) =>
            !credential.required ||
            Boolean(credentialDrafts[credential.name]?.trim())
        ))
  const supportAgentSelected = Boolean(
    selectedAuditorAgentId || selectedManagerAgentId
  )
  const connectBlockedReason = selectedAppBetaUnavailable
    ? selectedAppBetaUnavailableMessage
    : selectedAppUnavailableMessage
      ? selectedAppUnavailableMessage
      : selectedConnectionRequiresDevice
        ? "This synchronized connection runs on your Mac and cannot be executed by the Relay control plane. Keep the Mac and bridge online, or create a control-plane connection for this app."
        : approvalProfileId === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID &&
            !dangerousPolicyAcknowledged
          ? "Acknowledge the advanced dangerous-policy warning before connecting this app."
          : autonomyPolicy.mode === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID &&
              !dangerousAutonomyAcknowledged
            ? "Acknowledge the advanced dangerous-autonomy warning before connecting this local app."
            : generatedPackNeedsAcknowledgement &&
                !acknowledgeGeneratedDraftRisk
              ? "Acknowledge the generated-pack warning before connecting this high-risk draft."
              : selectedAppNeedsUserOAuth && !connectionId
                ? "Authorize your X account before connecting it to an agent."
                : selectedAppUsesConnectorOAuth && !connectionId
                  ? `Authorize ${selectedApp?.name ?? "this app"} before connecting it to an agent.`
                  : selectedAppNeedsUserOAuth &&
                      connectionId &&
                      !selectedXConnectionReady
                    ? "Re-authorize the selected X account before connecting it to an agent."
                    : !selectedOperatorAgentCard && !existingOperatorInstalled
                      ? "Select an operator agent."
                      : !selectedOperatorAgentCard &&
                          existingOperatorInstalled &&
                          !supportAgentSelected
                        ? "Select a manager or auditor agent, or choose an operator to reinstall."
                        : selectedOperatorAgentCard &&
                            !selectedOperatorAgentCard.installable
                          ? "Selected operator agent cannot install this app pack."
                          : !isLinkCrestApp && !hasRequiredCredentialDrafts
                            ? "Enter the required credentials."
                            : null
  const connectButtonLabel = isLinkCrestApp
    ? "Connect LinkCrest to agents"
    : selectedAuditorAgentId || selectedManagerAgentId
      ? `Connect ${selectedApp?.name ?? "app"} to agents`
      : `Connect ${selectedApp?.name ?? "app"} to agent`

  return {
    agentCards,
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
  }
}
