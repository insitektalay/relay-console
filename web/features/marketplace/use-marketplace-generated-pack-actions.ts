"use client"

import { showError } from "@/components/marketplace/marketplace-preview-ui"
import { sdk } from "@/lib/sdk"
import type { MarketplaceApp } from "@clawchat/contracts"
import type { QueryClient } from "@tanstack/react-query"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

export function useMarketplaceGeneratedPackActions({
  assertCanManageMarketplace,
  queryClient,
  selectedApp,
  workspaceId,
}: {
  assertCanManageMarketplace: () => void
  queryClient: QueryClient
  selectedApp: MarketplaceApp | null
  workspaceId: string
}) {
  const refreshGeneratedPack = async () => {
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
        queryKey: ["marketplace", workspaceId, "generated-pack-coverage"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId, "preview"],
      }),
    ])
  }
  const rerunGeneratedPackMutation = useMutation({
    mutationFn: () => {
      assertCanManageMarketplace()
      return sdk.marketplace.rerunGeneratedPack(workspaceId, selectedApp!.slug)
    },
    onSuccess: async () => {
      await refreshGeneratedPack()
      toast.success("Pack generation rerun")
    },
    onError: showError,
  })
  const promoteGeneratedPackMutation = useMutation({
    mutationFn: () => {
      assertCanManageMarketplace()
      return sdk.marketplace.promoteGeneratedPack(
        workspaceId,
        selectedApp!.slug
      )
    },
    onSuccess: async () => {
      await refreshGeneratedPack()
      toast.success("Pack promoted to generated reviewed")
    },
    onError: showError,
  })
  const publishGeneratedPackMutation = useMutation({
    mutationFn: () => {
      assertCanManageMarketplace()
      return sdk.marketplace.publishGeneratedPack(
        workspaceId,
        selectedApp!.slug
      )
    },
    onSuccess: async () => {
      await refreshGeneratedPack()
      toast.success("Generated pack published")
    },
    onError: showError,
  })
  const rejectGeneratedPackMutation = useMutation({
    mutationFn: () => {
      assertCanManageMarketplace()
      return sdk.marketplace.rejectGeneratedPack(workspaceId, selectedApp!.slug)
    },
    onSuccess: async () => {
      await refreshGeneratedPack()
      toast.success("Generated pack rejected")
    },
    onError: showError,
  })
  const manualReviewGeneratedPackMutation = useMutation({
    mutationFn: () => {
      assertCanManageMarketplace()
      return sdk.marketplace.markGeneratedPackNeedsManualReview(
        workspaceId,
        selectedApp!.slug
      )
    },
    onSuccess: async () => {
      await refreshGeneratedPack()
      toast.success("Pack marked for manual review")
    },
    onError: showError,
  })
  const importGeneratedPackSourcesMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => {
      assertCanManageMarketplace()
      return sdk.marketplace.importGeneratedPackSources(
        workspaceId,
        selectedApp!.slug,
        input
      )
    },
    onSuccess: async () => {
      await refreshGeneratedPack()
      toast.success("Source material imported")
    },
    onError: showError,
  })

  return {
    importGeneratedPackSourcesMutation,
    manualReviewGeneratedPackMutation,
    promoteGeneratedPackMutation,
    publishGeneratedPackMutation,
    rejectGeneratedPackMutation,
    rerunGeneratedPackMutation,
  }
}
