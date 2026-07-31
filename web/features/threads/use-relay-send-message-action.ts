"use client"

import type { Dispatch, SetStateAction } from "react"
import { useMutation, type QueryClient } from "@tanstack/react-query"
import type {
  Message,
  Paginated,
  Thread,
  WebSession,
} from "@clawchat/contracts"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"
import { getCurrentUserAvatarUrl } from "@/lib/current-user-avatar"
import { captureProductEvent } from "@/lib/telemetry"
import {
  buildMessagesQueryKey,
  logMessageSyncDiagnostic,
  patchThreadForMessage,
  replaceOptimisticMessagePage,
} from "@/lib/message-cache"
import {
  mapThreadPages,
  type ThreadPages,
} from "@/features/threads/thread-pages"

type AwaitingAgentReply = {
  threadId: string
  baselineMessageId: string | null
} | null

type RelaySendMessageActionInput = {
  effectiveWorkspaceId?: string | null
  messageDraft: string
  queryClient: QueryClient
  selectedThread?: Thread | null
  session?: WebSession | null
  setAwaitingAgentReply: Dispatch<SetStateAction<AwaitingAgentReply>>
  setMessageDraft: Dispatch<SetStateAction<string>>
}

export function useRelaySendMessageAction({
  effectiveWorkspaceId,
  messageDraft,
  queryClient,
  selectedThread,
  session,
  setAwaitingAgentReply,
  setMessageDraft,
}: RelaySendMessageActionInput) {
  const sendMessageMutation = useMutation({
    mutationFn: ({
      threadId,
      content,
      attachments = [],
      runtimeApprovalMode,
      runtimeDispatchConfirmed,
    }: {
      threadId: string
      content: string
      attachments?: Message["attachments"]
      runtimeApprovalMode: "ask_for_approval" | "approve_for_me" | "full_access"
      runtimeDispatchConfirmed: boolean
    }) =>
      sdk.messages.create(threadId, {
        content,
        attachments,
        runtimeApprovalMode,
        runtimeDispatchConfirmed,
      }),
    onMutate: async ({
      threadId,
      content,
      attachments = [],
    }: {
      threadId: string
      content: string
      attachments?: Message["attachments"]
      runtimeApprovalMode: "ask_for_approval" | "approve_for_me" | "full_access"
      runtimeDispatchConfirmed: boolean
    }) => {
      if (!session?.user) {
        setAwaitingAgentReply(null)
        return {
          previousMessages: undefined,
          previousThreads: undefined,
          previousDraft: undefined,
          threadId,
          activeMessageQueryKey: buildMessagesQueryKey(threadId),
        }
      }

      await queryClient.cancelQueries({
        queryKey: ["messages", threadId],
      })
      await queryClient.cancelQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      })

      const activeMessageQueryKey = buildMessagesQueryKey(threadId)
      const previousMessages = queryClient.getQueryData<Paginated<Message>>(
        activeMessageQueryKey
      )
      const previousThreads = queryClient.getQueriesData<ThreadPages>({
        queryKey: ["threads", effectiveWorkspaceId],
      })
      const previousDraft = messageDraft
      const timestamp = new Date().toISOString()
      const tempId = `temp-${threadId}-${Date.now()}`
      const optimisticMessage: Message = {
        id: tempId,
        threadId,
        threadSessionId: selectedThread?.activeSessionId ?? tempId,
        senderId: session.user.id,
        senderName: session.user.name,
        senderAvatarUrl: getCurrentUserAvatarUrl(session.user) ?? null,
        content,
        type: "text",
        embeddedCard: null,
        attachments,
        isFromUser: true,
        isEdited: false,
        replyToId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      queryClient.setQueryData<Paginated<Message>>(
        activeMessageQueryKey,
        (old) => {
          if (!old) {
            return {
              data: [optimisticMessage],
              total: 1,
              page: 1,
              pageSize: 50,
              hasMore: false,
            }
          }

          return {
            ...old,
            data: [...old.data, optimisticMessage],
            total: old.total + 1,
          }
        }
      )

      queryClient.setQueriesData<ThreadPages>(
        { queryKey: ["threads", effectiveWorkspaceId] },
        (old) =>
          mapThreadPages(old, (thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  lastMessage: {
                    id: tempId,
                    content,
                    senderName: session.user.name,
                    createdAt: timestamp,
                  },
                  updatedAt: timestamp,
                }
              : thread
          )
      )

      setMessageDraft("")
      setAwaitingAgentReply({
        threadId,
        baselineMessageId: tempId,
      })

      return {
        previousMessages,
        previousThreads,
        previousDraft,
        threadId,
        optimisticMessage,
        activeMessageQueryKey,
      }
    },
    onSuccess: (savedMessage, { threadId }, context) => {
      captureProductEvent("product_action", {
        action: "message.send",
        outcome: "success",
        has_attachments: Boolean(savedMessage.attachments?.length),
      })
      const queryKey =
        context?.activeMessageQueryKey ?? buildMessagesQueryKey(threadId)
      queryClient.setQueryData<Paginated<Message>>(queryKey, (current) =>
        replaceOptimisticMessagePage(
          current,
          savedMessage,
          context?.optimisticMessage?.id
        )
      )
      queryClient.setQueriesData<ThreadPages>(
        { queryKey: ["threads", effectiveWorkspaceId] },
        (current) =>
          mapThreadPages(current, (thread) =>
            thread.id === threadId
              ? patchThreadForMessage(thread, savedMessage)
              : thread
          )
      )
      logMessageSyncDiagnostic("send mutation cache replace", {
        threadId,
        messageId: savedMessage.id,
        optimisticMessageId: context?.optimisticMessage?.id ?? null,
      })
    },
    onError: (
      error: Error,
      _variables,
      context:
        | {
            previousMessages?: Paginated<Message>
            previousThreads?: Array<
              [readonly unknown[], ThreadPages | undefined]
            >
            previousDraft?: string
            threadId: string
            optimisticMessage?: Message
            activeMessageQueryKey: readonly [string, string, string]
          }
        | undefined
    ) => {
      if (context?.optimisticMessage) {
        const failedMessage: Message = {
          ...context.optimisticMessage,
          metadata: {
            ...(context.optimisticMessage.metadata ?? {}),
            localSendState: "failed",
            localErrorMessage: error.message,
          },
        }
        queryClient.setQueryData<Paginated<Message>>(
          context.activeMessageQueryKey,
          (current) => {
            const baseline = current ??
              context.previousMessages ?? {
                data: [],
                total: 0,
                page: 1,
                pageSize: 50,
                hasMore: false,
              }
            const withoutTemp = baseline.data.filter(
              (message) => message.id !== failedMessage.id
            )
            return {
              ...baseline,
              data: [...withoutTemp, failedMessage],
              total: Math.max(
                withoutTemp.length + 1,
                baseline.total ?? withoutTemp.length + 1
              ),
            }
          }
        )
      } else if (context?.previousMessages) {
        queryClient.setQueryData(
          context.activeMessageQueryKey,
          context.previousMessages
        )
      }
      if (context?.previousThreads) {
        for (const [queryKey, data] of context.previousThreads) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      setAwaitingAgentReply((current) =>
        current?.threadId === context?.threadId ? null : current
      )
      toast.error(`Message failed to send: ${error.message}`)
    },
  })

  return { sendMessageMutation }
}
