"use client"

import type { DocumentationAutomationMode } from "@/components/marketplace/marketplace-domain"
import { showError } from "@/components/marketplace/marketplace-preview-ui"
import { sdk } from "@/lib/sdk"
import type {
  LocalAppAutonomyPolicy,
  MarketplaceApp,
  MarketplaceLocalRepoSourceHost,
  ToolRequestStatus,
} from "@clawchat/contracts"
import type { QueryClient } from "@tanstack/react-query"
import { useMutation } from "@tanstack/react-query"
import type { Dispatch, SetStateAction } from "react"
import { toast } from "sonner"

export type LocalAppDraft = {
  name: string
  sourceHostId: string
  repoPath: string
  localAppUrl: string
  localApiUrl: string
  openApiSpecPath: string
  docsSourcePath: string
  checkCommandRef: string
  startCommandRef: string
  allowRuntimeHostStart: boolean
  lifecycleApprovalPolicy: string
}

export function useMarketplaceLocalActions({
  assertCanManageMarketplace,
  localAppDraft,
  localSourceHosts,
  queryClient,
  selectedApp,
  setAddAppMode,
  setAutonomyPolicy,
  setLinkcrestBearerKeyDraft,
  setLocalAppDraft,
  workspaceId,
}: {
  assertCanManageMarketplace: () => void
  localAppDraft: LocalAppDraft
  localSourceHosts: MarketplaceLocalRepoSourceHost[]
  queryClient: QueryClient
  selectedApp: MarketplaceApp | null
  setAddAppMode: Dispatch<SetStateAction<"choice" | "local" | null>>
  setAutonomyPolicy: Dispatch<SetStateAction<LocalAppAutonomyPolicy>>
  setLinkcrestBearerKeyDraft: Dispatch<SetStateAction<string>>
  setLocalAppDraft: Dispatch<SetStateAction<LocalAppDraft>>
  workspaceId: string
}) {
  const createLocalAppMutation = useMutation({
    mutationFn: () => {
      assertCanManageMarketplace()
      const sourceHost =
        localSourceHosts.find(
          (host) => host.id === localAppDraft.sourceHostId
        ) ??
        localSourceHosts.find(
          (host) =>
            host.status === "available" && host.supportsLocalRepoDocsRead
        )
      if (!sourceHost) {
        throw new Error("Select a source host for this local repo app.")
      }
      return sdk.marketplace.createLocalApp(workspaceId, {
        name: localAppDraft.name.trim(),
        sourceHostType: sourceHost.type,
        sourceHostId: sourceHost.id,
        bridgeDeviceId: sourceHost.bridgeDeviceId ?? undefined,
        runtimeBindingId: sourceHost.runtimeBindingId ?? undefined,
        sourceHostLabel: sourceHost.label,
        runtimeType: sourceHost.runtimeType ?? undefined,
        repoPath: localAppDraft.repoPath.trim(),
        localAppUrl: localAppDraft.localAppUrl.trim() || undefined,
        localApiUrl: localAppDraft.localApiUrl.trim() || undefined,
        openApiSpecPath: localAppDraft.openApiSpecPath.trim() || undefined,
        docsSourcePath: localAppDraft.docsSourcePath.trim() || ".clawchat/",
        lifecycle: {
          checkCommandRef: localAppDraft.checkCommandRef.trim() || undefined,
          startCommandRef: localAppDraft.startCommandRef.trim() || undefined,
          allowRuntimeHostStart: localAppDraft.allowRuntimeHostStart,
          approvalPolicy:
            localAppDraft.lifecycleApprovalPolicy.trim() ||
            "approval_required_for_start_or_restart",
        },
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId],
      })
      setAddAppMode(null)
      setLocalAppDraft({
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
      toast.success("Local app added")
    },
    onError: showError,
  })
  const updatePackMutation = useMutation({
    mutationFn: (appSlug?: string) => {
      assertCanManageMarketplace()
      return sdk.marketplace.updatePack(
        workspaceId,
        appSlug ?? selectedApp!.slug
      )
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "marketplace",
            workspaceId,
            "generated-pack",
            selectedApp?.slug,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "marketplace",
            workspaceId,
            "documentation-history",
            selectedApp?.slug,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "preview"],
        }),
      ])
      toast.success("Pack update prepared for review")
    },
    onError: showError,
  })
  const refreshAgentDocsMutation = useMutation({
    mutationFn: (appSlug?: string) => {
      assertCanManageMarketplace()
      return sdk.marketplace.refreshAgentDocs(
        workspaceId,
        appSlug ?? selectedApp!.slug
      )
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "installs"],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "marketplace",
            workspaceId,
            "generated-pack",
            selectedApp?.slug,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "marketplace",
            workspaceId,
            "documentation-history",
            selectedApp?.slug,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "preview"],
        }),
      ])
      toast.success("Agent docs updated")
    },
    onError: showError,
  })
  const analyzeLocalRepoDocsMutation = useMutation({
    mutationFn: () => {
      assertCanManageMarketplace()
      return sdk.marketplace.analyzeLocalRepoDocs(
        workspaceId,
        selectedApp!.slug
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          "marketplace",
          workspaceId,
          "local-repo-docs-status",
          selectedApp?.slug,
        ],
      })
      toast.success("Local repo docs proposal generated")
    },
    onError: showError,
  })
  const applyLocalRepoDocsProposalMutation = useMutation({
    mutationFn: (input: {
      proposalId: string
      approvedFileIds: string[]
      rejectedFileIds: string[]
    }) => {
      assertCanManageMarketplace()
      return sdk.marketplace.applyLocalRepoDocsProposal(
        workspaceId,
        selectedApp!.slug,
        input.proposalId,
        {
          approvedFileIds: input.approvedFileIds,
          rejectedFileIds: input.rejectedFileIds,
        }
      )
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "installs"],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "marketplace",
            workspaceId,
            "documentation-history",
            selectedApp?.slug,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "marketplace",
            workspaceId,
            "local-repo-docs-status",
            selectedApp?.slug,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "marketplace",
            workspaceId,
            "generated-pack",
            selectedApp?.slug,
          ],
        }),
      ])
      toast.success("Approved docs applied and agent docs refreshed")
    },
    onError: showError,
  })
  const updateDocumentationAutomationMutation = useMutation({
    mutationFn: (input: {
      appSlug: string
      mode: DocumentationAutomationMode
    }) => {
      assertCanManageMarketplace()
      return sdk.marketplace.updateLocalApp(workspaceId, input.appSlug, {
        documentationAutomationMode: input.mode,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "marketplace",
            workspaceId,
            "local-repo-docs-status",
            selectedApp?.slug,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "marketplace",
            workspaceId,
            "documentation-history",
            selectedApp?.slug,
          ],
        }),
      ])
      toast.success("Documentation automation updated")
    },
    onError: showError,
  })
  const updateLocalAppSourceMutation = useMutation({
    mutationFn: (input: { appSlug: string; hostId: string }) => {
      assertCanManageMarketplace()
      const sourceHost = localSourceHosts.find(
        (host) => host.id === input.hostId
      )
      if (!sourceHost)
        throw new Error("Select a source host for this local repo app.")
      return sdk.marketplace.updateLocalApp(workspaceId, input.appSlug, {
        sourceHostType: sourceHost.type,
        sourceHostId: sourceHost.id,
        bridgeDeviceId: sourceHost.bridgeDeviceId ?? null,
        runtimeBindingId: sourceHost.runtimeBindingId ?? null,
        sourceHostLabel: sourceHost.label,
        runtimeType: sourceHost.runtimeType ?? null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId],
      })
      toast.success("Local app source host updated")
    },
    onError: showError,
  })
  const updateAutonomyPolicyMutation = useMutation({
    mutationFn: (input: {
      appSlug: string
      policy: LocalAppAutonomyPolicy
      acknowledgeDangerouslySkipPermissions?: boolean
    }) => {
      assertCanManageMarketplace()
      return sdk.marketplace.updateLocalApp(workspaceId, input.appSlug, {
        autonomyPolicy: input.policy,
        acknowledgeDangerouslySkipPermissions:
          input.acknowledgeDangerouslySkipPermissions,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "preview"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "local-repo-docs-status"],
        }),
      ])
      toast.success("Autonomy policy updated")
    },
    onError: showError,
  })

  const updateToolRequestStatusMutation = useMutation({
    mutationFn: (input: {
      id: string
      status: ToolRequestStatus
      resolutionNotes?: string | null
    }) => {
      assertCanManageMarketplace()
      return sdk.marketplace.updateToolRequestStatus(workspaceId, input.id, {
        status: input.status,
        resolutionNotes: input.resolutionNotes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId, "tool-requests"],
      })
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Failed to update tool request"
      ),
  })
  const syncLinkCrestPolicyMutation = useMutation({
    mutationFn: (input: {
      appSlug: string
      campaignId?: string | null
      campaignName?: string | null
    }) => {
      assertCanManageMarketplace()
      return sdk.marketplace.syncLinkCrestPolicy(workspaceId, input.appSlug, {
        campaignId: input.campaignId,
        campaignName: input.campaignName,
      })
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId],
      })
      if (result.status === "synced") toast.success("LinkCrest policy synced")
      else toast.warning(result.message)
    },
    onError: showError,
  })
  const configureLinkCrestOpenClawMutation = useMutation({
    mutationFn: (input: {
      appSlug: string
      openclawBaseUrl: string
      bearerKey?: string | null
      campaignId?: string | null
      campaignName?: string | null
    }) => {
      assertCanManageMarketplace()
      return sdk.marketplace.configureLinkCrestOpenClaw(
        workspaceId,
        input.appSlug,
        {
          openclawBaseUrl: input.openclawBaseUrl,
          bearerKey: input.bearerKey,
          campaignId: input.campaignId,
          campaignName: input.campaignName,
        }
      )
    },
    onSuccess: async () => {
      setLinkcrestBearerKeyDraft("")
      await queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId],
      })
      toast.success("LinkCrest Agent API configured")
    },
    onError: showError,
  })
  const persistAutonomyPolicy = (
    policy: LocalAppAutonomyPolicy,
    acknowledgeDangerouslySkipPermissions = false
  ) => {
    setAutonomyPolicy(policy)
    if (!selectedApp) return
    updateAutonomyPolicyMutation.mutate({
      appSlug: selectedApp.slug,
      policy,
      acknowledgeDangerouslySkipPermissions,
    })
  }

  return {
    analyzeLocalRepoDocsMutation,
    applyLocalRepoDocsProposalMutation,
    configureLinkCrestOpenClawMutation,
    createLocalAppMutation,
    persistAutonomyPolicy,
    refreshAgentDocsMutation,
    syncLinkCrestPolicyMutation,
    updateAutonomyPolicyMutation,
    updateDocumentationAutomationMutation,
    updateLocalAppSourceMutation,
    updatePackMutation,
    updateToolRequestStatusMutation,
  }
}
