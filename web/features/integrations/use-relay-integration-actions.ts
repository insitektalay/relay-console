"use client"

import type { Dispatch, SetStateAction } from "react"
import { useMutation, type QueryClient } from "@tanstack/react-query"
import type {
  BridgeEnrollment,
  CreatePaperclipConnectionInput,
  PutThreadPaperclipLinkInput,
  UpdatePaperclipConnectionInput,
} from "@clawchat/contracts"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"

type RelayIntegrationActionsInput = {
  bridgeDeviceLabelDraft: string
  connectionApiKeyDraft: string
  connectionUrlDraft: string
  effectiveWorkspaceId?: string | null
  queryClient: QueryClient
  setActiveBridgeEnrollment: Dispatch<SetStateAction<BridgeEnrollment | null>>
  setConnectionApiKeyDraft: Dispatch<SetStateAction<string>>
  setConnectionUrlDraft: Dispatch<SetStateAction<string>>
  setTestingPaperclipConnectionId: Dispatch<SetStateAction<string | null>>
}

export function useRelayIntegrationActions({
  bridgeDeviceLabelDraft,
  connectionApiKeyDraft,
  connectionUrlDraft,
  effectiveWorkspaceId,
  queryClient,
  setActiveBridgeEnrollment,
  setConnectionApiKeyDraft,
  setConnectionUrlDraft,
  setTestingPaperclipConnectionId,
}: RelayIntegrationActionsInput) {
  const bridgeConnectionCreateMutation = useMutation({
    mutationFn: () =>
      sdk.bridge.createConnection({
        workspaceId: effectiveWorkspaceId!,
        instanceUrl: connectionUrlDraft.trim(),
        apiKey: connectionApiKeyDraft.trim() || undefined,
      }),
    onSuccess: async () => {
      setConnectionUrlDraft("")
      setConnectionApiKeyDraft("")
      await queryClient.invalidateQueries({
        queryKey: ["bridge-connections", effectiveWorkspaceId],
      })
      toast.success("OpenClaw connection saved")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const bridgeEnrollmentCreateMutation = useMutation({
    mutationFn: () =>
      sdk.bridge.createEnrollment(effectiveWorkspaceId!, {
        deviceLabel: bridgeDeviceLabelDraft.trim() || "Local runtime bridge",
        expiresInMinutes: 10,
      }),
    onSuccess: async (result) => {
      setActiveBridgeEnrollment(result)
      await queryClient.invalidateQueries({
        queryKey: ["bridge-devices", effectiveWorkspaceId],
      })
      await queryClient.invalidateQueries({
        queryKey: [
          "workspace-openclaw-integration-status",
          effectiveWorkspaceId,
        ],
      })
      toast.success("Pairing code ready")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const revokeBridgeDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => sdk.bridge.revokeDevice(deviceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["bridge-devices", effectiveWorkspaceId],
      })
      await queryClient.invalidateQueries({
        queryKey: [
          "workspace-openclaw-integration-status",
          effectiveWorkspaceId,
        ],
      })
      toast.success("Paired device revoked")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const bridgeSyncMutation = useMutation({
    mutationFn: () => sdk.bridge.sync(effectiveWorkspaceId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["bridge-connections", effectiveWorkspaceId],
      })
      await queryClient.invalidateQueries({
        queryKey: ["agents", effectiveWorkspaceId],
      })
      toast.success("Agent sync requested")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const paperclipConnectionCreateMutation = useMutation({
    mutationFn: (input: CreatePaperclipConnectionInput) =>
      sdk.paperclip.createConnection(effectiveWorkspaceId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["paperclip-connections", effectiveWorkspaceId],
      })
      toast.success("Paperclip connection saved")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const paperclipConnectionUpdateMutation = useMutation({
    mutationFn: ({
      connectionId,
      input,
    }: {
      connectionId: string
      input: UpdatePaperclipConnectionInput
    }) =>
      sdk.paperclip.updateConnection(
        effectiveWorkspaceId!,
        connectionId,
        input
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["paperclip-connections", effectiveWorkspaceId],
      })
      await queryClient.invalidateQueries({
        queryKey: ["thread-paperclip-link"],
      })
      toast.success("Paperclip connection updated")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const paperclipConnectionTestMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      setTestingPaperclipConnectionId(connectionId)
      return sdk.paperclip.testConnection(effectiveWorkspaceId!, connectionId)
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["paperclip-connections", effectiveWorkspaceId],
      })
      await queryClient.invalidateQueries({
        queryKey: ["thread-paperclip-link"],
      })
      if (result.ok) {
        toast.success("Paperclip connection verified")
      } else {
        toast.error(result.errorMessage ?? "Paperclip connection test failed")
      }
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => {
      setTestingPaperclipConnectionId(null)
    },
  })

  const paperclipThreadLinkMutation = useMutation({
    mutationFn: ({
      threadId,
      input,
    }: {
      threadId: string
      input: PutThreadPaperclipLinkInput
    }) => sdk.paperclip.putThreadLink(threadId, input),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["thread-paperclip-link", variables.threadId],
      })
      toast.success("Paperclip link saved")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const paperclipThreadUnlinkMutation = useMutation({
    mutationFn: (threadId: string) => sdk.paperclip.deleteThreadLink(threadId),
    onSuccess: async (_, threadId) => {
      await queryClient.invalidateQueries({
        queryKey: ["thread-paperclip-link", threadId],
      })
      toast.success("Paperclip link removed")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return {
    bridgeConnectionCreateMutation,
    bridgeEnrollmentCreateMutation,
    revokeBridgeDeviceMutation,
    bridgeSyncMutation,
    paperclipConnectionCreateMutation,
    paperclipConnectionUpdateMutation,
    paperclipConnectionTestMutation,
    paperclipThreadLinkMutation,
    paperclipThreadUnlinkMutation,
  }
}
