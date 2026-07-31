"use client"

import type { Dispatch, SetStateAction } from "react"
import { useMutation, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"
import { captureProductEvent } from "@/lib/telemetry"

type RelayApprovalActionsInput = {
  approvalNote: string
  effectiveApprovalId?: string | null
  effectiveWorkspaceId?: string | null
  queryClient: QueryClient
  setApprovalNote: Dispatch<SetStateAction<string>>
}

export function useRelayApprovalActions({
  approvalNote,
  effectiveApprovalId,
  effectiveWorkspaceId,
  queryClient,
  setApprovalNote,
}: RelayApprovalActionsInput) {
  const approvalDecisionMutation = useMutation({
    mutationFn: (decision: "approve" | "reject") => {
      if (decision === "approve") {
        return sdk.approvals.approve(effectiveApprovalId!, {
          notes: approvalNote.trim() || undefined,
        })
      }
      return sdk.approvals.reject(effectiveApprovalId!, {
        notes: approvalNote.trim() || undefined,
      })
    },
    onSuccess: async (_, decision) => {
      captureProductEvent("product_action", {
        action: "approval.decide",
        outcome: "success",
        decision,
      })
      setApprovalNote("")
      await queryClient.invalidateQueries({
        queryKey: ["approvals", effectiveWorkspaceId],
      })
      if (effectiveApprovalId) {
        await queryClient.invalidateQueries({
          queryKey: ["approval", effectiveApprovalId],
        })
      }
      toast.success("Approval updated")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return { approvalDecisionMutation }
}
