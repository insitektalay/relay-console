"use client"

import {
  buildLocalRepoConnectionMetadata,
  DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
  marketplaceRoleLabel,
} from "@/components/marketplace/marketplace-domain"
import {
  credentialDisplayLabel,
  marketplaceRuntimeForAgent,
  showError,
} from "@/components/marketplace/marketplace-preview-ui"
import { sdk } from "@/lib/sdk"
import type {
  Agent,
  AutoConnectLocalAppResult,
  LocalAppAutonomyPolicy,
  MarketplaceApp,
  MarketplaceInstallResult,
  MarketplaceInstallRole,
  MarketplaceRoleManifestEntry,
} from "@clawchat/contracts"
import type { QueryClient } from "@tanstack/react-query"
import { useMutation } from "@tanstack/react-query"
import type { Dispatch, SetStateAction } from "react"
import { toast } from "sonner"

type ConnectionCompleteInput = {
  appName: string
  operatorAgentId: string
  message: string
}

export function useMarketplaceConnectApp({
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
  isLinkCrestApp,
  linkcrestCampaignIdDraft,
  linkcrestCampaignNameDraft,
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
}: {
  acknowledgeGeneratedDraftRisk: boolean
  agents: Agent[]
  approvalProfileId: string
  assertCanManageMarketplace: () => void
  autonomyPolicy: LocalAppAutonomyPolicy
  connectionAuthType: string
  connectionId: string
  connectionName: string
  credentialDrafts: Record<string, string>
  dangerousAutonomyAcknowledged: boolean
  dangerousPolicyAcknowledged: boolean
  defaultOperatorAgentId: string
  effectiveCapabilities: string[]
  environment: string
  isReplacingConnectionCredentials: boolean
  existingOperatorInstalled: boolean
  isLinkCrestApp: boolean
  linkcrestCampaignIdDraft: string
  linkcrestCampaignNameDraft: string
  onConnectionComplete?: (
    input: ConnectionCompleteInput
  ) => void | Promise<void>
  outlookSenderEmail: string
  queryClient: QueryClient
  retainUnverifiedCredentials: boolean
  selectedApp: MarketplaceApp | null
  selectedAppRoles: MarketplaceRoleManifestEntry[]
  selectedAppUsesConnectorOAuth: boolean
  selectedAgentIds: Set<string>
  selectedAuditorAgentId: string
  selectedManagerAgentId: string
  setConnectionId: Dispatch<SetStateAction<string>>
  setCredentialDrafts: Dispatch<SetStateAction<Record<string, string>>>
  setIsReplacingConnectionCredentials: Dispatch<SetStateAction<boolean>>
  setLastAutoConnectResult: Dispatch<
    SetStateAction<AutoConnectLocalAppResult | null>
  >
  setLastInstallResult: Dispatch<
    SetStateAction<MarketplaceInstallResult | null>
  >
  visibleCredentialRequirements: MarketplaceApp["credentialRequirements"]
  workspaceId: string
}) {
  const connectAppMutation = useMutation({
    mutationFn: async () => {
      assertCanManageMarketplace()
      if (!selectedApp) throw new Error("Select an app first.")
      const operatorAgentId = Array.from(selectedAgentIds)[0] ?? ""
      const supportAgentSelected = Boolean(
        selectedAuditorAgentId || selectedManagerAgentId
      )
      if (!operatorAgentId && !existingOperatorInstalled) {
        throw new Error("Select an operator agent.")
      }
      if (!operatorAgentId && !supportAgentSelected) {
        throw new Error("Select an agent to connect.")
      }
      if (isLinkCrestApp && selectedApp.sourceType === "local_repo") {
        const autoConnectResult = await sdk.marketplace.autoConnectLocalApp(
          workspaceId,
          selectedApp.slug,
          {
            workerAgentIds: Array.from(selectedAgentIds),
            managerAgentId: selectedManagerAgentId || null,
            auditorAgentId: selectedAuditorAgentId || null,
            autonomyMode: autonomyPolicy.mode,
            autonomyPolicy,
            campaignId: linkcrestCampaignIdDraft || null,
            campaignName: linkcrestCampaignNameDraft || null,
            approvalProfileId: approvalProfileId || null,
            acknowledgeDangerouslySkipPermissions:
              dangerousAutonomyAcknowledged || dangerousPolicyAcknowledged,
          }
        )
        return {
          result: null,
          operatorAgentId: operatorAgentId || defaultOperatorAgentId,
          appName: selectedApp.name,
          autoConnectResult,
        }
      }
      const missingCredential = !connectionId
        ? visibleCredentialRequirements.find(
            (credential) =>
              credential.required && !credentialDrafts[credential.name]?.trim()
          )
        : null
      if (missingCredential) {
        throw new Error(
          `Enter ${credentialDisplayLabel(selectedApp, missingCredential)}.`
        )
      }
      if (selectedApp.slug === "x" && !connectionId) {
        throw new Error(
          "Authorize your X account before connecting it to an agent."
        )
      }
      if (selectedAppUsesConnectorOAuth && !connectionId) {
        throw new Error(
          `Authorize ${selectedApp.name} before connecting it to an agent.`
        )
      }

      let activeConnectionId = connectionId || undefined
      if (!activeConnectionId) {
        const connection = await sdk.marketplace.createConnection(workspaceId, {
          appSlug: selectedApp.slug,
          displayName:
            connectionName.trim() || `${selectedApp.name} connection`,
          environment,
          authType: connectionAuthType,
          credentials: credentialDrafts,
          retainUnverifiedCredentials,
          selectedCapabilities: effectiveCapabilities,
          metadata:
            selectedApp.sourceType === "local_repo"
              ? buildLocalRepoConnectionMetadata(selectedApp)
              : undefined,
        })
        if (connection.status !== "ready") {
          throw new Error(
            connection.lastErrorMessage ||
              "The provider rejected this connection; Relay deleted the encrypted credential."
          )
        }
        activeConnectionId = connection.id
      }

      const installForAgent = async (
        agentId: string,
        role: MarketplaceInstallRole
      ) => {
        const agent = agents.find((entry) => entry.id === agentId)
        const agentRuntime = agent ? marketplaceRuntimeForAgent(agent) : null
        if (!agentRuntime) {
          throw new Error(
            `Selected ${marketplaceRoleLabel(role)} agent is unavailable.`
          )
        }
        return sdk.marketplace.install(workspaceId, {
          appSlug: selectedApp.slug,
          connectionId: activeConnectionId,
          selectedCapabilities: effectiveCapabilities,
          approvalProfileId: approvalProfileId || undefined,
          acknowledgeDangerouslySkipPermissions:
            approvalProfileId === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID
              ? dangerousPolicyAcknowledged
              : undefined,
          runtimeFormat: agentRuntime,
          agentIds: [agentId],
          role,
          libraryTargetFolder: `marketplace/${selectedApp.slug}`,
          targetMode: "existing_agents",
          acknowledgeGeneratedDraftRisk,
          outlookSenderEmail:
            selectedApp.slug === "outlook"
              ? outlookSenderEmail.trim() || undefined
              : undefined,
        })
      }

      const operatorRole =
        selectedAppRoles.find((role) => role.role === "worker")?.role ??
        selectedAppRoles.find((role) => role.role === "operator")?.role ??
        "worker"
      const results: MarketplaceInstallResult[] = []
      if (operatorAgentId) {
        results.push(await installForAgent(operatorAgentId, operatorRole))
      }
      if (selectedAuditorAgentId) {
        results.push(await installForAgent(selectedAuditorAgentId, "auditor"))
      }
      if (selectedManagerAgentId) {
        results.push(await installForAgent(selectedManagerAgentId, "manager"))
      }
      const result = results[0]
      if (!result) throw new Error("Select an agent to connect.")
      return {
        result,
        operatorAgentId: operatorAgentId || defaultOperatorAgentId,
        appName: selectedApp.name,
      }
    },
    onSuccess: async ({
      result,
      operatorAgentId,
      appName,
      autoConnectResult,
    }) => {
      if (result) setLastInstallResult(result)
      if (autoConnectResult) {
        setLastAutoConnectResult(autoConnectResult)
        if (autoConnectResult.connectionId)
          setConnectionId(autoConnectResult.connectionId)
      }
      setCredentialDrafts({})
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "connections"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "installs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["agent-documentation", workspaceId],
        }),
      ])
      if (autoConnectResult?.status === "action_required") {
        toast.warning(autoConnectResult.message)
      } else if (autoConnectResult?.status === "partial") {
        toast.warning(autoConnectResult.message)
      } else {
        toast.success(`${appName} connected`)
      }
      await onConnectionComplete?.({
        appName,
        operatorAgentId,
        message: `${appName} has been connected. Briefly introduce what you can now help with in ${appName}, including any approval limits.`,
      })
    },
    onError: showError,
  })

  const assignAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      assertCanManageMarketplace()
      if (!selectedApp) throw new Error("Select an app first.")
      if (!connectionId) {
        throw new Error(`Select the ${selectedApp.name} connection first.`)
      }
      const agent = agents.find((entry) => entry.id === agentId)
      const agentRuntime = agent ? marketplaceRuntimeForAgent(agent) : null
      if (!agent || !agentRuntime) {
        throw new Error("Selected agent is unavailable.")
      }
      const role =
        selectedAppRoles.find((entry) => entry.role === "worker")?.role ??
        selectedAppRoles.find((entry) => entry.role === "operator")?.role ??
        "worker"
      const result = await sdk.marketplace.install(workspaceId, {
        appSlug: selectedApp.slug,
        connectionId,
        selectedCapabilities: effectiveCapabilities,
        approvalProfileId: approvalProfileId || undefined,
        acknowledgeDangerouslySkipPermissions:
          approvalProfileId === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID
            ? dangerousPolicyAcknowledged
            : undefined,
        runtimeFormat: agentRuntime,
        agentIds: [agentId],
        role,
        libraryTargetFolder: `marketplace/${selectedApp.slug}`,
        targetMode: "existing_agents",
        acknowledgeGeneratedDraftRisk: true,
        outlookSenderEmail:
          selectedApp.slug === "outlook"
            ? outlookSenderEmail.trim() || undefined
            : undefined,
      })
      if (result.status && result.status !== "installed") {
        throw new Error(
          result.message || `${selectedApp.name} could not be assigned.`
        )
      }
      return { agent, appName: selectedApp.name, result }
    },
    onSuccess: async ({ agent, appName, result }) => {
      setLastInstallResult(result)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "installs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["agent-documentation", workspaceId],
        }),
      ])
      toast.success(`${appName} connected to ${agent.name}`)
    },
    onError: showError,
  })

  const updateConnectionMutation = useMutation({
    mutationFn: async () => {
      assertCanManageMarketplace()
      if (!selectedApp || !connectionId) {
        throw new Error("Select a saved connection first.")
      }
      if (isReplacingConnectionCredentials) {
        const missingCredential = visibleCredentialRequirements.find(
          (credential) =>
            credential.required && !credentialDrafts[credential.name]?.trim()
        )
        if (missingCredential) {
          throw new Error(
            `Re-enter ${credentialDisplayLabel(selectedApp, missingCredential)} before replacing the saved credentials.`
          )
        }
      }
      const updated = await sdk.marketplace.updateConnection(
        workspaceId,
        connectionId,
        {
          displayName:
            connectionName.trim() || `${selectedApp.name} connection`,
          environment,
          credentials: isReplacingConnectionCredentials
            ? credentialDrafts
            : undefined,
          retainUnverifiedCredentials,
          selectedCapabilities: effectiveCapabilities,
        }
      )
      if (updated.status !== "ready") {
        throw new Error(
          updated.lastErrorMessage ||
            "The provider rejected the updated credentials."
        )
      }
      return updated
    },
    onSuccess: async (updated) => {
      setConnectionId(updated.id)
      setCredentialDrafts({})
      setIsReplacingConnectionCredentials(false)
      await queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId, "connections"],
      })
      toast.success(`${selectedApp?.name ?? "Connection"} updated`)
    },
    onError: showError,
  })

  return {
    assignAgentMutation,
    connectAppMutation,
    updateConnectionMutation,
  }
}
