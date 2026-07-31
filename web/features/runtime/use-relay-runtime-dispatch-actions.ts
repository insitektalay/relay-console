"use client"

import { useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import type { Message, Thread } from "@clawchat/contracts"
import { toast } from "sonner"
import type { RuntimeDispatchUiState } from "@/hooks/use-clawchat-realtime"
import { sdk } from "@/lib/sdk"

type RuntimeApprovalMode = "ask_for_approval" | "approve_for_me" | "full_access"

type SendMessageInput = {
  threadId: string
  content: string
  attachments?: Message["attachments"]
  runtimeApprovalMode: RuntimeApprovalMode
  runtimeDispatchConfirmed: boolean
}

type RelayRuntimeDispatchActionsInput = {
  messages: Message[]
  runtimeExperience: {
    approvalMode: RuntimeApprovalMode
    confirmRuntimeActions: boolean
  }
  selectedThread?: Thread | null
  sendMessageMutation: {
    isPending: boolean
    mutate: (input: SendMessageInput) => void
  }
  setSelectedWrappedTranscript: (value: null) => void
  viewedWrappedTranscript: unknown
}

export function useRelayRuntimeDispatchActions({
  messages,
  runtimeExperience,
  selectedThread,
  sendMessageMutation,
  setSelectedWrappedTranscript,
  viewedWrappedTranscript,
}: RelayRuntimeDispatchActionsInput) {
  const cancelRuntimeDispatchMutation = useMutation({
    mutationFn: (dispatchId: string) =>
      sdk.runtimeDispatches.cancel(dispatchId),
    onSuccess: (result) => {
      toast.success(
        result.cancelled
          ? "Runtime dispatch cancelled"
          : "Runtime dispatch already finished"
      )
    },
    onError: (error: Error) =>
      toast.error(`Could not cancel runtime dispatch: ${error.message}`),
  })

  const handleCancelRuntimeDispatch = useCallback(
    (dispatch: RuntimeDispatchUiState) => {
      if (!["queued", "started", "streaming"].includes(dispatch.status)) {
        toast.message("This runtime dispatch already finished")
        return
      }
      if (
        runtimeExperience.confirmRuntimeActions &&
        !window.confirm("Cancel this running agent action?")
      ) {
        return
      }
      cancelRuntimeDispatchMutation.mutate(dispatch.dispatchId)
    },
    [cancelRuntimeDispatchMutation, runtimeExperience.confirmRuntimeActions]
  )

  const handleRetryRuntimeDispatch = useCallback(
    (dispatch: RuntimeDispatchUiState) => {
      if (!selectedThread || dispatch.threadId !== selectedThread.id) {
        toast.error("Open the original thread before retrying this dispatch")
        return
      }
      if (dispatch.retryable !== true) {
        toast.error("This runtime failure was not marked retryable")
        return
      }
      if (!dispatch.messageId) {
        toast.error("This runtime failure is missing its source message")
        return
      }
      if (sendMessageMutation.isPending) {
        toast.message("Wait for the current message to finish sending first")
        return
      }

      const sourceMessage = messages.find(
        (message) =>
          message.id === dispatch.messageId &&
          message.threadId === selectedThread.id &&
          message.isFromUser
      )
      if (!sourceMessage) {
        toast.error("Could not find the original user message to retry")
        return
      }

      const content = sourceMessage.content.trim()
      const attachments = sourceMessage.attachments ?? []
      if (!content && !attachments.length) {
        toast.error("The original message has no retryable content")
        return
      }

      if (
        runtimeExperience.confirmRuntimeActions &&
        !window.confirm("Retry this agent action using the original message?")
      ) {
        return
      }

      if (viewedWrappedTranscript) {
        setSelectedWrappedTranscript(null)
      }

      sendMessageMutation.mutate({
        threadId: selectedThread.id,
        content,
        attachments,
        runtimeApprovalMode: runtimeExperience.approvalMode,
        runtimeDispatchConfirmed: true,
      })
      toast.success("Retry queued")
    },
    [
      messages,
      runtimeExperience.approvalMode,
      runtimeExperience.confirmRuntimeActions,
      selectedThread,
      sendMessageMutation,
      setSelectedWrappedTranscript,
      viewedWrappedTranscript,
    ]
  )

  return {
    handleCancelRuntimeDispatch,
    handleRetryRuntimeDispatch,
  }
}
