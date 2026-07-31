"use client"

import type {
  Message,
  AgentOpsLiveAgentState,
  AgentOpsLiveStateSnapshot,
  MessageCondensedUpdatedPayload,
  Paginated,
  RuntimeDispatchCompletedPayload,
  RuntimeDispatchEventPayload,
  RuntimeDispatchFailedPayload,
  RuntimeParticipantHealthPayload,
  RuntimeRunContextPayload,
  RuntimeRunDeltaPayload,
  RuntimeRunThinkingPayload,
  RuntimeRunStatusPayload,
  RuntimeRunToolPayload,
  RuntimeTodoTask,
  RealtimeClientEvent,
  RealtimeEnvelope,
  Thread,
} from "@clawchat/contracts"
import { useQueryClient, type InfiniteData } from "@tanstack/react-query"
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"
import { appConfig } from "@/lib/config"
import { ClawChatApiError } from "@clawchat/web-sdk"
import { withCondensedMessageMetadata } from "@clawchat/contracts"
import {
  THREAD_MESSAGE_PAGE_SIZE,
  buildMessagesQueryKey,
  logMessageSyncDiagnostic,
  mergeMessageWindow,
  patchThreadForMessage,
  upsertMessagePage,
} from "@/lib/message-cache"
import {
  normalizeRuntimeTodoTasks,
  upsertRuntimeToolActivity,
  type RuntimeToolActivityPresentation,
} from "@/lib/runtime-live-presentation"

type ThreadPages = InfiniteData<Paginated<Thread>, number>

function mapThreadPages(
  current: ThreadPages | undefined,
  mapper: (thread: Thread) => Thread
): ThreadPages | undefined {
  if (!current) return current
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map(mapper),
    })),
  }
}

function logRealtimeDiagnostic(
  action: string,
  details: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "production") {
    return
  }

  console.debug(`[Relay Console realtime] ${action}`, details)
}

export type RealtimeConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "auth_failed"

class RealtimeAuthFailureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RealtimeAuthFailureError"
  }
}

function isAuthApiError(error: unknown) {
  return (
    error instanceof ClawChatApiError &&
    (error.status === 401 || error.status === 403)
  )
}

function realtimeAuthCloseMessage(event: CloseEvent) {
  if (event.code === 4001) {
    return "Realtime authentication failed. Sign in again to reconnect."
  }
  if (event.code === 4002) {
    return "Your browser session ended. Sign in again."
  }
  if (event.code === 1008) {
    return "Realtime connection was rejected by the backend."
  }
  return null
}

interface UseRelayConsoleRealtimeOptions {
  enabled: boolean
  workspaceId: string | null
  selectedThreadId: string | null
  onSessionRevoked: () => void
}

export interface RuntimeDispatchUiState {
  dispatchId: string
  threadId: string
  threadSessionId: string
  messageId?: string | null
  agentId: string
  runtimeType: string
  status:
    | "queued"
    | "started"
    | "streaming"
    | "completed"
    | "failed"
    | "cancelled"
  draftText: string
  draftThinking: string
  statusMessage?: string
  toolSummary?: string
  tasks: RuntimeTodoTask[]
  toolActivity: RuntimeToolActivityUiState[]
  errorCode?: string
  errorMessage?: string
  retryable?: boolean
  postedMessageId?: string | null
  startedAt?: string
  updatedAt: string
}

export type RuntimeToolActivityUiState = RuntimeToolActivityPresentation

export interface RuntimeParticipantHealthUiState {
  agentId: string
  runtimeType: string
  status: string
  message?: string | null
  updatedAt: string
}

export interface RuntimeContextUsageUiState {
  dispatchId: string
  threadId: string
  threadSessionId: string
  agentId: string
  runtimeType: string
  runtimeBindingId: string
  runtimeThreadSessionId: string
  totalTokens: number | null
  contextTokens: number | null
  percentUsed: number | null
  level: RuntimeRunContextPayload["level"]
  fresh: boolean
  sessionId?: string
  model?: string
  modelProvider?: string
  references?: RuntimeRunContextPayload["references"]
  updatedAt: string
}

export function useRelayConsoleRealtime({
  enabled,
  workspaceId,
  selectedThreadId,
  onSessionRevoked,
}: UseRelayConsoleRealtimeOptions) {
  const queryClient = useQueryClient()
  const socketRef = useRef<WebSocket | null>(null)
  const connectingRef = useRef(false)
  const reconnectRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const realtimeAuthFailedRef = useRef(false)
  const realtimeAuthToastShownRef = useRef(false)
  const subscribedThreadRef = useRef<string | null>(null)
  const selectedThreadRef = useRef<string | null>(null)
  const seenEventRef = useRef<Map<string, number>>(new Map())
  const runtimeRemovalTimersRef = useRef<Map<string, number>>(new Map())
  const agentOpsAgentIdsRef = useRef<string[]>([])

  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({})
  const [runtimeDispatches, setRuntimeDispatches] = useState<
    Record<string, RuntimeDispatchUiState[]>
  >({})
  const [runtimeParticipantHealth, setRuntimeParticipantHealth] = useState<
    Record<string, RuntimeParticipantHealthUiState[]>
  >({})
  const [runtimeContextUsage, setRuntimeContextUsage] = useState<
    Record<string, RuntimeContextUsageUiState[]>
  >({})
  const [agentOpsLiveStates, setAgentOpsLiveStates] = useState<
    Record<string, AgentOpsLiveAgentState>
  >({})
  const [liveConnectionState, setLiveConnectionState] =
    useState<RealtimeConnectionState>("disconnected")

  useEffect(() => {
    selectedThreadRef.current = selectedThreadId
  }, [selectedThreadId])

  const hasSelectedThreadActiveRuntimeDispatches = selectedThreadId
    ? runtimeDispatches[selectedThreadId]?.some(isRuntimeDispatchActive) ===
      true
    : false

  const patchThreadListForMessage = useEffectEvent((message: Message) => {
    queryClient.setQueriesData<ThreadPages>(
      { queryKey: ["threads", workspaceId] },
      (current) =>
        mapThreadPages(current, (thread) =>
          thread.id === message.threadId
            ? patchThreadForMessage(thread, message)
            : thread
        )
    )
  })

  const patchThreadList = useEffectEvent((updatedThread: Thread) => {
    queryClient.setQueriesData<ThreadPages>(
      { queryKey: ["threads", workspaceId] },
      (current) =>
        mapThreadPages(current, (thread) =>
          thread.id === updatedThread.id
            ? {
                ...thread,
                ...updatedThread,
              }
            : thread
        )
    )
  })

  const reconcileRuntimeDispatchesForMessages = useEffectEvent(
    (threadId: string, messages: Message[]) => {
      if (!messages.length) return

      setRuntimeDispatches((current) => {
        const existing = current[threadId] ?? []
        if (!existing.length) return current

        const nextEntries = existing.filter((dispatch) => {
          if (
            !["queued", "started", "streaming", "completed"].includes(
              dispatch.status
            )
          ) {
            return true
          }

          return !messages.some((message) => {
            if (message.isFromUser || message.senderId !== dispatch.agentId) {
              return false
            }

            const runtimeDispatchId =
              typeof message.metadata?.runtimeDispatchId === "string"
                ? message.metadata.runtimeDispatchId
                : null
            if (
              runtimeDispatchId === dispatch.dispatchId ||
              (dispatch.postedMessageId &&
                message.id === dispatch.postedMessageId)
            ) {
              return true
            }

            return (
              new Date(message.createdAt).getTime() >=
              new Date(dispatch.updatedAt).getTime()
            )
          })
        })

        if (nextEntries.length === existing.length) return current
        for (const dispatch of existing) {
          if (
            !nextEntries.some(
              (entry) => entry.dispatchId === dispatch.dispatchId
            )
          ) {
            const timer = runtimeRemovalTimersRef.current.get(
              dispatch.dispatchId
            )
            if (timer) {
              window.clearTimeout(timer)
              runtimeRemovalTimersRef.current.delete(dispatch.dispatchId)
            }
          }
        }
        if (!nextEntries.length) {
          const next = { ...current }
          delete next[threadId]
          return next
        }
        return {
          ...current,
          [threadId]: nextEntries,
        }
      })
    }
  )

  const mergeLatestMessagesForCompletedDispatch = useEffectEvent(
    async (payload: RuntimeDispatchCompletedPayload) => {
      if (!payload.postedMessageId) {
        return
      }

      try {
        const latestPage = await sdk.messages.list(
          payload.threadId,
          1,
          THREAD_MESSAGE_PAGE_SIZE,
          payload.threadSessionId || undefined
        )

        queryClient.setQueriesData<Paginated<Message>>(
          {
            queryKey: ["messages", payload.threadId],
          },
          (current) => {
            const data = mergeMessageWindow(
              current?.data ?? [],
              latestPage.data
            )
            return {
              data,
              total: Math.max(
                current?.total ?? 0,
                latestPage.total,
                data.length
              ),
              page: current?.page ?? 1,
              pageSize: current?.pageSize ?? THREAD_MESSAGE_PAGE_SIZE,
              hasMore: current?.hasMore ?? latestPage.hasMore,
            }
          }
        )

        const postedMessage =
          latestPage.data.find(
            (message) => message.id === payload.postedMessageId
          ) ?? latestPage.data[latestPage.data.length - 1]
        if (postedMessage) {
          patchThreadListForMessage(postedMessage)
        }
        reconcileRuntimeDispatchesForMessages(payload.threadId, latestPage.data)

        logMessageSyncDiagnostic("runtime completed latest window merged", {
          threadId: payload.threadId,
          dispatchId: payload.dispatchId,
          postedMessageId: payload.postedMessageId,
          received: latestPage.data.length,
        })
      } catch (error) {
        logMessageSyncDiagnostic("runtime completed latest window failed", {
          threadId: payload.threadId,
          dispatchId: payload.dispatchId,
          postedMessageId: payload.postedMessageId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  )

  useEffect(() => {
    if (!enabled || !workspaceId || !selectedThreadId) return

    let cancelled = false
    void sdk.threads
      .runtimeContextUsage(selectedThreadId)
      .then((usage) => {
        if (cancelled || !usage.length) return
        setRuntimeContextUsage((current) =>
          usage.reduce(
            (next, payload) => upsertRuntimeContextUsage(next, payload),
            current
          )
        )
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [enabled, selectedThreadId, workspaceId])

  const shouldProcessEvent = useEffectEvent((event: RealtimeEnvelope) => {
    const now = Date.now()
    const seen = seenEventRef.current

    for (const [key, timestamp] of seen) {
      if (now - timestamp > 30_000) {
        seen.delete(key)
      }
    }

    let eventKey: string | null = null

    switch (event.type) {
      case "message.new":
        eventKey = `${event.type}:${event.data.id}`
        break
      case "message.condensed": {
        const payload = event.data as MessageCondensedUpdatedPayload
        eventKey = `${event.type}:${payload.messageId}:${payload.condensed.generatedAt}:${payload.condensed.sourceContentHash}`
        break
      }
      case "thread.update":
        eventKey = `${event.type}:${event.data.id}:${event.data.updatedAt}`
        break
      case "typing:start":
      case "typing:stop":
        eventKey = `${event.type}:${event.data.threadId}:${event.data.userId}`
        break
      case "session.revoked":
        eventKey = `${event.type}:${event.data.reason}`
        break
      case "runtime.dispatch.queued":
      case "runtime.dispatch.started": {
        const payload = event.data as RuntimeDispatchEventPayload
        eventKey = `${event.type}:${payload.dispatchId}:${payload.timestamp}:${payload.draftSeq ?? ""}`
        break
      }
      case "runtime.dispatch.completed":
      case "runtime.dispatch.cancelled":
        eventKey = `${event.type}:${(event.data as RuntimeDispatchEventPayload).dispatchId}`
        break
      case "runtime.dispatch.failed": {
        const payload = event.data as RuntimeDispatchFailedPayload
        eventKey = `${event.type}:${payload.dispatchId}:${payload.code}:${payload.message}`
        break
      }
      case "runtime.run.delta": {
        const payload = event.data as RuntimeRunDeltaPayload
        eventKey = `${event.type}:${payload.dispatchId}:${payload.seq}`
        break
      }
      case "runtime.run.thinking": {
        const payload = event.data as RuntimeRunThinkingPayload
        eventKey = `${event.type}:${payload.dispatchId}:${payload.seq}`
        break
      }
      case "runtime.run.status": {
        const payload = event.data as RuntimeRunStatusPayload
        eventKey = `${event.type}:${payload.dispatchId}:${payload.code}:${payload.message}`
        break
      }
      case "runtime.run.tool": {
        const payload = event.data as RuntimeRunToolPayload
        const taskSignature = Array.isArray(payload.tasks)
          ? payload.tasks
              .map((task) => `${task.id}:${task.status}:${task.content}`)
              .join("|")
          : ""
        eventKey = `${event.type}:${payload.dispatchId}:${payload.toolName}:${payload.phase}:${payload.summary ?? ""}:${taskSignature}`
        break
      }
      case "runtime.run.context": {
        const payload = event.data as RuntimeRunContextPayload
        eventKey = `${event.type}:${payload.threadId}:${payload.agentId}:${payload.dispatchId}:${payload.timestamp}`
        break
      }
      case "runtime.participant.health": {
        const payload = event.data as RuntimeParticipantHealthPayload
        eventKey = `${event.type}:${payload.threadId ?? "workspace"}:${payload.agentId}:${payload.status}:${payload.message ?? ""}`
        break
      }
      case "agent_ops.live_state.snapshot": {
        const payload = event.data as AgentOpsLiveStateSnapshot
        setAgentOpsLiveStates((current) => ({
          ...current,
          ...Object.fromEntries(
            payload.agents.map((entry) => [entry.agentId, entry])
          ),
        }))
        break
      }
      case "agent_ops.live_state.updated": {
        const payload = event.data as AgentOpsLiveAgentState
        setAgentOpsLiveStates((current) => ({
          ...current,
          [payload.agentId]: payload,
        }))
        break
      }
      default:
        break
    }

    if (!eventKey) return true
    if (seen.has(eventKey)) return false

    seen.set(eventKey, now)
    return true
  })

  const scheduleRuntimeDispatchRemoval = useEffectEvent(
    (threadId: string, dispatchId: string, delayMs: number) => {
      const existing = runtimeRemovalTimersRef.current.get(dispatchId)
      if (existing) {
        window.clearTimeout(existing)
      }
      const handle = window.setTimeout(() => {
        setRuntimeDispatches((current) =>
          removeRuntimeDispatch(current, threadId, dispatchId)
        )
        runtimeRemovalTimersRef.current.delete(dispatchId)
      }, delayMs)
      runtimeRemovalTimersRef.current.set(dispatchId, handle)
    }
  )

  const markRealtimeAuthFailed = useCallback((message: string) => {
    realtimeAuthFailedRef.current = true
    connectingRef.current = false
    reconnectAttemptRef.current = 0
    if (reconnectRef.current) {
      window.clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
    setLiveConnectionState("auth_failed")
    if (!realtimeAuthToastShownRef.current) {
      toast.error(message)
      realtimeAuthToastShownRef.current = true
    }
  }, [])

  const handleRealtimeEvent = useEffectEvent((event: RealtimeEnvelope) => {
    if (!shouldProcessEvent(event)) {
      return
    }

    switch (event.type) {
      case "message.new": {
        const message = event.data as Message
        const runtimeDispatchId =
          typeof message.metadata?.runtimeDispatchId === "string"
            ? message.metadata.runtimeDispatchId
            : null

        if (runtimeDispatchId) {
          if (runtimeRemovalTimersRef.current.has(runtimeDispatchId)) {
            window.clearTimeout(
              runtimeRemovalTimersRef.current.get(runtimeDispatchId)
            )
            runtimeRemovalTimersRef.current.delete(runtimeDispatchId)
          }
          setRuntimeDispatches((current) => {
            const threadEntries = current[message.threadId] ?? []
            const nextEntries = threadEntries.filter(
              (entry) => entry.dispatchId !== runtimeDispatchId
            )
            if (nextEntries.length === threadEntries.length) {
              return current
            }
            if (!nextEntries.length) {
              const next = { ...current }
              delete next[message.threadId]
              return next
            }
            return {
              ...current,
              [message.threadId]: nextEntries,
            }
          })
        }

        patchThreadListForMessage(message)
        queryClient.setQueryData<Paginated<Message>>(
          buildMessagesQueryKey(message.threadId),
          (current) => upsertMessagePage(current, message)
        )
        reconcileRuntimeDispatchesForMessages(message.threadId, [message])
        logMessageSyncDiagnostic("websocket message.new cache upsert", {
          threadId: message.threadId,
          messageId: message.id,
        })
        if (message.threadId === selectedThreadRef.current) {
          void sdk.threads.markRead(message.threadId).catch(() => undefined)
        }
        break
      }
      case "message.condensed": {
        if (!appConfig.enableCondensedTeamChatRealtime) {
          break
        }

        const payload = event.data as MessageCondensedUpdatedPayload
        queryClient.setQueriesData<Paginated<Message>>(
          {
            queryKey: ["messages", payload.threadId],
          },
          (current) => {
            if (!current) {
              return current
            }

            let didChange = false
            const nextData = current.data.map((message) => {
              if (message.id !== payload.messageId) {
                return message
              }

              didChange = true
              return {
                ...message,
                metadata: withCondensedMessageMetadata(
                  message.metadata,
                  payload.condensed
                ),
                updatedAt: payload.updatedAt,
              }
            })

            return didChange
              ? {
                  ...current,
                  data: nextData,
                }
              : current
          }
        )
        break
      }
      case "thread.update": {
        patchThreadList(event.data as Thread)
        break
      }
      case "typing:start": {
        const payload = event.data
        setTypingUsers((current) => {
          const existing = current[payload.threadId] ?? []
          if (existing.includes(payload.userId)) return current
          return {
            ...current,
            [payload.threadId]: [...existing, payload.userId],
          }
        })
        break
      }
      case "typing:stop": {
        const payload = event.data
        setTypingUsers((current) => ({
          ...current,
          [payload.threadId]: (current[payload.threadId] ?? []).filter(
            (entry) => entry !== payload.userId
          ),
        }))
        break
      }
      case "runtime.dispatch.queued": {
        const payload = event.data as RuntimeDispatchEventPayload
        setRuntimeDispatches((current) =>
          upsertRuntimeDispatch(
            current,
            payload.threadId,
            payload.dispatchId,
            (existing) => {
              const draftText = mergeRuntimeReplayDraftText(
                existing?.draftText,
                payload.draftText
              )
              return {
                dispatchId: payload.dispatchId,
                threadId: payload.threadId,
                threadSessionId: payload.threadSessionId,
                messageId: payload.messageId ?? existing?.messageId ?? null,
                agentId: payload.agentId,
                runtimeType: payload.runtimeType,
                status:
                  existing?.status && existing.status !== "queued"
                    ? existing.status
                    : draftText
                      ? "streaming"
                      : "queued",
                draftText,
                draftThinking: existing?.draftThinking ?? "",
                statusMessage: existing?.statusMessage,
                toolSummary: existing?.toolSummary,
                tasks: existing?.tasks ?? [],
                toolActivity: existing?.toolActivity ?? [],
                startedAt: existing?.startedAt,
                updatedAt: payload.timestamp,
              }
            }
          )
        )
        break
      }
      case "runtime.dispatch.started": {
        const payload = event.data as RuntimeDispatchEventPayload
        setRuntimeDispatches((current) =>
          upsertRuntimeDispatch(
            current,
            payload.threadId,
            payload.dispatchId,
            (existing) => {
              const draftText = mergeRuntimeReplayDraftText(
                existing?.draftText,
                payload.draftText
              )
              return {
                dispatchId: payload.dispatchId,
                threadId: payload.threadId,
                threadSessionId: payload.threadSessionId,
                messageId: payload.messageId ?? existing?.messageId ?? null,
                agentId: payload.agentId,
                runtimeType: payload.runtimeType,
                status: draftText ? "streaming" : "started",
                draftText,
                draftThinking: existing?.draftThinking ?? "",
                statusMessage: existing?.statusMessage,
                toolSummary: existing?.toolSummary,
                tasks: existing?.tasks ?? [],
                toolActivity: existing?.toolActivity ?? [],
                startedAt: existing?.startedAt ?? payload.timestamp,
                updatedAt: payload.timestamp,
              }
            }
          )
        )
        break
      }
      case "runtime.run.delta": {
        const payload = event.data as RuntimeRunDeltaPayload
        setRuntimeDispatches((current) =>
          upsertRuntimeDispatch(
            current,
            payload.threadId,
            payload.dispatchId,
            (existing) => ({
              dispatchId: payload.dispatchId,
              threadId: payload.threadId,
              threadSessionId: payload.threadSessionId,
              messageId: payload.messageId ?? existing?.messageId ?? null,
              agentId: payload.agentId,
              runtimeType: payload.runtimeType,
              status: "streaming",
              draftText: `${existing?.draftText ?? ""}${payload.text}`,
              draftThinking: existing?.draftThinking ?? "",
              statusMessage: existing?.statusMessage,
              toolSummary: existing?.toolSummary,
              tasks: existing?.tasks ?? [],
              toolActivity: existing?.toolActivity ?? [],
              startedAt: existing?.startedAt ?? payload.timestamp,
              updatedAt: payload.timestamp,
            })
          )
        )
        break
      }
      case "runtime.run.thinking": {
        const payload = event.data as RuntimeRunThinkingPayload
        setRuntimeDispatches((current) =>
          upsertRuntimeDispatch(
            current,
            payload.threadId,
            payload.dispatchId,
            (existing) => ({
              dispatchId: payload.dispatchId,
              threadId: payload.threadId,
              threadSessionId: payload.threadSessionId,
              messageId: payload.messageId ?? existing?.messageId ?? null,
              agentId: payload.agentId,
              runtimeType: payload.runtimeType,
              status:
                existing?.status === "queued"
                  ? "started"
                  : (existing?.status ?? "started"),
              draftText: existing?.draftText ?? "",
              draftThinking: payload.thinking,
              statusMessage: existing?.statusMessage,
              toolSummary: existing?.toolSummary,
              tasks: existing?.tasks ?? [],
              toolActivity: existing?.toolActivity ?? [],
              startedAt: existing?.startedAt ?? payload.timestamp,
              updatedAt: payload.timestamp,
            })
          )
        )
        break
      }
      case "runtime.run.status": {
        const payload = event.data as RuntimeRunStatusPayload
        setRuntimeDispatches((current) =>
          upsertRuntimeDispatch(
            current,
            payload.threadId,
            payload.dispatchId,
            (existing) => ({
              dispatchId: payload.dispatchId,
              threadId: payload.threadId,
              threadSessionId: payload.threadSessionId,
              messageId: payload.messageId ?? existing?.messageId ?? null,
              agentId: payload.agentId,
              runtimeType: payload.runtimeType,
              status: existing?.status ?? "started",
              draftText: existing?.draftText ?? "",
              draftThinking: existing?.draftThinking ?? "",
              statusMessage: payload.message,
              toolSummary: existing?.toolSummary,
              tasks: existing?.tasks ?? [],
              toolActivity: existing?.toolActivity ?? [],
              startedAt: existing?.startedAt ?? payload.timestamp,
              updatedAt: payload.timestamp,
            })
          )
        )
        break
      }
      case "runtime.run.tool": {
        const payload = event.data as RuntimeRunToolPayload
        setRuntimeDispatches((current) =>
          upsertRuntimeDispatch(
            current,
            payload.threadId,
            payload.dispatchId,
            (existing) => {
              const isTodo = payload.toolName.trim().toLowerCase() === "todo"
              return {
                dispatchId: payload.dispatchId,
                threadId: payload.threadId,
                threadSessionId: payload.threadSessionId,
                messageId: payload.messageId ?? existing?.messageId ?? null,
                agentId: payload.agentId,
                runtimeType: payload.runtimeType,
                status: existing?.status ?? "started",
                draftText: existing?.draftText ?? "",
                draftThinking: existing?.draftThinking ?? "",
                statusMessage: existing?.statusMessage,
                toolSummary: isTodo
                  ? existing?.toolSummary
                  : payload.summary || payload.toolName,
                tasks:
                  isTodo && Array.isArray(payload.tasks)
                    ? normalizeRuntimeTodoTasks(payload.tasks)
                    : (existing?.tasks ?? []),
                toolActivity: isTodo
                  ? (existing?.toolActivity ?? [])
                  : upsertRuntimeToolActivity(
                      existing?.toolActivity ?? [],
                      payload
                    ),
                startedAt: existing?.startedAt ?? payload.timestamp,
                updatedAt: payload.timestamp,
              }
            }
          )
        )
        break
      }
      case "runtime.run.context": {
        const payload = event.data as RuntimeRunContextPayload
        setRuntimeContextUsage((current) =>
          upsertRuntimeContextUsage(current, payload)
        )
        break
      }
      case "runtime.dispatch.completed": {
        const payload = event.data as RuntimeDispatchCompletedPayload
        logMessageSyncDiagnostic("websocket runtime.dispatch.completed", {
          threadId: payload.threadId,
          dispatchId: payload.dispatchId,
          postedMessageId: payload.postedMessageId ?? null,
        })
        void mergeLatestMessagesForCompletedDispatch(payload)
        setRuntimeDispatches((current) =>
          upsertRuntimeDispatch(
            current,
            payload.threadId,
            payload.dispatchId,
            (existing) => ({
              dispatchId: payload.dispatchId,
              threadId: payload.threadId,
              threadSessionId: payload.threadSessionId,
              messageId: payload.messageId ?? existing?.messageId ?? null,
              agentId: payload.agentId,
              runtimeType: payload.runtimeType,
              status: "completed",
              draftText: existing?.draftText ?? "",
              draftThinking: existing?.draftThinking ?? "",
              statusMessage: "Completed",
              toolSummary: existing?.toolSummary,
              tasks: existing?.tasks ?? [],
              toolActivity: existing?.toolActivity ?? [],
              postedMessageId: payload.postedMessageId ?? null,
              startedAt: existing?.startedAt,
              updatedAt: payload.timestamp,
            })
          )
        )
        setTypingUsers((current) => {
          const next = { ...current }
          const existing = next[payload.threadId] ?? []
          next[payload.threadId] = existing.filter(
            (id) => id !== payload.agentId
          )
          return next
        })
        scheduleRuntimeDispatchRemoval(
          payload.threadId,
          payload.dispatchId,
          2500
        )
        break
      }
      case "runtime.dispatch.failed": {
        const payload = event.data as RuntimeDispatchFailedPayload
        setRuntimeDispatches((current) =>
          upsertRuntimeDispatch(
            current,
            payload.threadId,
            payload.dispatchId,
            (existing) => ({
              dispatchId: payload.dispatchId,
              threadId: payload.threadId,
              threadSessionId: payload.threadSessionId,
              messageId: payload.messageId ?? existing?.messageId ?? null,
              agentId: payload.agentId,
              runtimeType: payload.runtimeType,
              status: "failed",
              draftText: existing?.draftText ?? "",
              draftThinking: existing?.draftThinking ?? "",
              statusMessage: existing?.statusMessage,
              toolSummary: existing?.toolSummary,
              tasks: existing?.tasks ?? [],
              toolActivity: existing?.toolActivity ?? [],
              errorCode: payload.code,
              errorMessage: payload.message,
              retryable: payload.retryable,
              startedAt: existing?.startedAt,
              updatedAt: payload.timestamp,
            })
          )
        )
        setTypingUsers((current) => {
          const next = { ...current }
          const existing = next[payload.threadId] ?? []
          next[payload.threadId] = existing.filter(
            (id) => id !== payload.agentId
          )
          return next
        })
        break
      }
      case "runtime.dispatch.cancelled": {
        const payload = event.data as RuntimeDispatchEventPayload
        setRuntimeDispatches((current) =>
          upsertRuntimeDispatch(
            current,
            payload.threadId,
            payload.dispatchId,
            (existing) => ({
              dispatchId: payload.dispatchId,
              threadId: payload.threadId,
              threadSessionId: payload.threadSessionId,
              messageId: payload.messageId ?? existing?.messageId ?? null,
              agentId: payload.agentId,
              runtimeType: payload.runtimeType,
              status: "cancelled",
              draftText: existing?.draftText ?? "",
              draftThinking: existing?.draftThinking ?? "",
              statusMessage: "Cancelled",
              toolSummary: existing?.toolSummary,
              tasks: existing?.tasks ?? [],
              toolActivity: existing?.toolActivity ?? [],
              startedAt: existing?.startedAt,
              updatedAt: payload.timestamp,
            })
          )
        )
        setTypingUsers((current) => {
          const next = { ...current }
          const existing = next[payload.threadId] ?? []
          next[payload.threadId] = existing.filter(
            (id) => id !== payload.agentId
          )
          return next
        })
        break
      }
      case "runtime.participant.health": {
        const payload = event.data as RuntimeParticipantHealthPayload
        const scopeKey = payload.threadId ?? payload.workspaceId
        setRuntimeParticipantHealth((current) => {
          const existing = current[scopeKey] ?? []
          const nextEntry: RuntimeParticipantHealthUiState = {
            agentId: payload.agentId,
            runtimeType: payload.runtimeType,
            status: payload.status,
            message: payload.message,
            updatedAt: payload.timestamp,
          }
          const others = existing.filter(
            (entry) => entry.agentId !== payload.agentId
          )
          return {
            ...current,
            [scopeKey]: [...others, nextEntry],
          }
        })
        break
      }
      case "session.revoked":
        markRealtimeAuthFailed("Your browser session ended. Sign in again.")
        socketRef.current?.close()
        onSessionRevoked()
        break
      case "auth_error":
        markRealtimeAuthFailed(
          "Realtime authentication failed. Sign in again to reconnect."
        )
        socketRef.current?.close()
        break
      default:
        break
    }
  })

  const sendEvent = useCallback((event: RealtimeClientEvent) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(event))
  }, [])

  const requestAgentOpsLiveState = useCallback(
    (agentIds: string[]) => {
      agentOpsAgentIdsRef.current = Array.from(
        new Set(agentIds.filter(Boolean))
      )
      if (!workspaceId || !agentOpsAgentIdsRef.current.length) return
      sendEvent({
        type: "request_agent_ops_live_state",
        workspaceId,
        agentIds: agentOpsAgentIdsRef.current,
      })
    },
    [sendEvent, workspaceId]
  )

  useEffect(() => {
    if (!enabled || !workspaceId) {
      socketRef.current?.close()
      socketRef.current = null
      connectingRef.current = false
      realtimeAuthFailedRef.current = false
      realtimeAuthToastShownRef.current = false
      return
    }

    let cancelled = false
    realtimeAuthFailedRef.current = false
    realtimeAuthToastShownRef.current = false

    const resolveRealtimeAuth = async () => {
      try {
        logRealtimeDiagnostic("request ws ticket", {
          workspaceId,
          retry: false,
        })
        const { ticket } = await sdk.auth.wsTicket(workspaceId)
        return { ticket }
      } catch (error) {
        if (!isAuthApiError(error)) {
          throw error
        }
        logRealtimeDiagnostic("refresh before ws ticket retry", {
          workspaceId,
        })
        try {
          await sdk.auth.refresh()
        } catch (refreshError) {
          if (isAuthApiError(refreshError)) {
            throw new RealtimeAuthFailureError(
              "Realtime authentication failed. Sign in again to reconnect."
            )
          }
          throw refreshError
        }
        logRealtimeDiagnostic("request ws ticket", {
          workspaceId,
          retry: true,
        })
        let ticket: string
        try {
          ;({ ticket } = await sdk.auth.wsTicket(workspaceId))
        } catch (ticketError) {
          if (isAuthApiError(ticketError)) {
            throw new RealtimeAuthFailureError(
              "Realtime authentication failed. Sign in again to reconnect."
            )
          }
          throw ticketError
        }
        return { ticket }
      }
    }

    const connect = async () => {
      const existingSocket = socketRef.current
      if (realtimeAuthFailedRef.current) {
        setLiveConnectionState("auth_failed")
        logRealtimeDiagnostic("skip connect after auth failure", {
          workspaceId,
        })
        return
      }
      if (
        connectingRef.current ||
        existingSocket?.readyState === WebSocket.CONNECTING ||
        existingSocket?.readyState === WebSocket.OPEN
      ) {
        logRealtimeDiagnostic("skip duplicate connect", {
          workspaceId,
          readyState: existingSocket?.readyState ?? null,
          connecting: connectingRef.current,
        })
        return
      }

      connectingRef.current = true
      try {
        setLiveConnectionState(
          reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting"
        )
        const auth = await resolveRealtimeAuth()
        if (!auth) {
          connectingRef.current = false
          setLiveConnectionState("disconnected")
          return
        }
        const { ticket } = auth
        if (cancelled) {
          connectingRef.current = false
          return
        }

        const socket = new WebSocket(appConfig.wsBaseUrl)
        socketRef.current = socket

        socket.onopen = () => {
          socket.send(JSON.stringify({ type: "authenticate", token: ticket }))
        }

        socket.onmessage = (event) => {
          const parsed = JSON.parse(event.data) as RealtimeEnvelope
          if (parsed.type === "authenticated") {
            connectingRef.current = false
            reconnectAttemptRef.current = 0
            setLiveConnectionState("connected")
            logRealtimeDiagnostic("connected", { workspaceId })
            sendEvent({ type: "subscribe_workspace", workspaceId })
            if (agentOpsAgentIdsRef.current.length) {
              sendEvent({
                type: "request_agent_ops_live_state",
                workspaceId,
                agentIds: agentOpsAgentIdsRef.current,
              })
            }
            if (selectedThreadRef.current) {
              sendEvent({
                type: "subscribe_thread",
                threadId: selectedThreadRef.current,
              })
              sendEvent({
                type: "request_pending_dispatches",
                threadId: selectedThreadRef.current,
              })
              subscribedThreadRef.current = selectedThreadRef.current
            }
            return
          }
          handleRealtimeEvent(parsed)
        }

        socket.onclose = (event) => {
          socketRef.current = null
          connectingRef.current = false
          if (cancelled) return
          if (realtimeAuthFailedRef.current) {
            setLiveConnectionState("auth_failed")
            return
          }

          const authCloseMessage = realtimeAuthCloseMessage(event)
          if (authCloseMessage) {
            markRealtimeAuthFailed(authCloseMessage)
            if (event.code === 4002) {
              onSessionRevoked()
            }
            logRealtimeDiagnostic("closed after realtime auth failure", {
              workspaceId,
              code: event.code,
              reason: event.reason,
            })
            return
          }

          setLiveConnectionState("reconnecting")
          const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 8000)
          reconnectAttemptRef.current += 1
          logRealtimeDiagnostic("closed; scheduling reconnect", {
            workspaceId,
            delay,
          })
          reconnectRef.current = window.setTimeout(() => {
            void connect()
          }, delay)
        }
      } catch (error) {
        connectingRef.current = false
        if (error instanceof RealtimeAuthFailureError) {
          markRealtimeAuthFailed(error.message)
          return
        }
        setLiveConnectionState("reconnecting")
        const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 8000)
        reconnectAttemptRef.current += 1
        logRealtimeDiagnostic("connect failed; scheduling reconnect", {
          workspaceId,
          delay,
        })
        reconnectRef.current = window.setTimeout(() => {
          void connect()
        }, delay)
      }
    }

    void connect()
    const runtimeRemovalTimers = runtimeRemovalTimersRef.current

    return () => {
      cancelled = true
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current)
      }
      for (const handle of runtimeRemovalTimers.values()) {
        window.clearTimeout(handle)
      }
      runtimeRemovalTimers.clear()
      socketRef.current?.close()
      socketRef.current = null
      connectingRef.current = false
      subscribedThreadRef.current = null
    }
  }, [
    enabled,
    markRealtimeAuthFailed,
    onSessionRevoked,
    sendEvent,
    workspaceId,
  ])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    if (
      subscribedThreadRef.current &&
      subscribedThreadRef.current !== selectedThreadId
    ) {
      sendEvent({
        type: "unsubscribe_thread",
        threadId: subscribedThreadRef.current,
      })
      subscribedThreadRef.current = null
    }

    if (selectedThreadId && subscribedThreadRef.current !== selectedThreadId) {
      sendEvent({
        type: "subscribe_thread",
        threadId: selectedThreadId,
      })
      sendEvent({
        type: "request_pending_dispatches",
        threadId: selectedThreadId,
      })
      subscribedThreadRef.current = selectedThreadId
    }
  }, [selectedThreadId, sendEvent])

  useEffect(() => {
    if (!enabled || !selectedThreadId) return

    let cancelled = false
    let timeout: number | null = null
    let failureCount = 0

    const scheduleNextRefresh = () => {
      if (cancelled) return
      const baseDelayMs = hasSelectedThreadActiveRuntimeDispatches ? 5000 : 7000
      const backoffMultiplier = Math.min(2 ** failureCount, 4)
      const jitterMs = Math.floor(Math.random() * 1000)
      timeout = window.setTimeout(
        refreshSelectedThreadMessages,
        baseDelayMs * backoffMultiplier + jitterMs
      )
    }

    const refreshSelectedThreadMessages = async () => {
      try {
        const latestPage = await sdk.messages.list(
          selectedThreadId,
          1,
          THREAD_MESSAGE_PAGE_SIZE
        )
        if (cancelled) return

        queryClient.setQueriesData<Paginated<Message>>(
          {
            queryKey: ["messages", selectedThreadId],
          },
          (current) => {
            const data = mergeMessageWindow(
              current?.data ?? [],
              latestPage.data
            )
            return {
              data,
              total: Math.max(
                current?.total ?? 0,
                latestPage.total,
                data.length
              ),
              page: current?.page ?? 1,
              pageSize: current?.pageSize ?? THREAD_MESSAGE_PAGE_SIZE,
              hasMore: current?.hasMore ?? latestPage.hasMore,
            }
          }
        )

        const latestMessage = latestPage.data[latestPage.data.length - 1]
        if (latestMessage) {
          patchThreadListForMessage(latestMessage)
        }
        reconcileRuntimeDispatchesForMessages(selectedThreadId, latestPage.data)
        failureCount = 0
      } catch (error) {
        failureCount += 1
        logMessageSyncDiagnostic(
          hasSelectedThreadActiveRuntimeDispatches
            ? "active runtime message refresh failed"
            : "selected thread latest sync failed",
          {
            threadId: selectedThreadId,
            error: error instanceof Error ? error.message : String(error),
            failureCount,
          }
        )
      } finally {
        scheduleNextRefresh()
      }
    }

    void refreshSelectedThreadMessages()
    return () => {
      cancelled = true
      if (timeout) {
        window.clearTimeout(timeout)
      }
    }
  }, [
    enabled,
    hasSelectedThreadActiveRuntimeDispatches,
    queryClient,
    selectedThreadId,
  ])

  const connectionState =
    enabled && workspaceId ? liveConnectionState : "disconnected"

  return {
    connectionState,
    typingUsers,
    runtimeDispatches,
    runtimeParticipantHealth,
    runtimeContextUsage,
    agentOpsLiveStates,
    requestAgentOpsLiveState,
  }
}

function upsertRuntimeDispatch(
  current: Record<string, RuntimeDispatchUiState[]>,
  threadId: string,
  dispatchId: string,
  build: (existing?: RuntimeDispatchUiState) => RuntimeDispatchUiState
) {
  const existingEntries = current[threadId] ?? []
  const existing = existingEntries.find(
    (entry) => entry.dispatchId === dispatchId
  )
  const nextEntry = build(existing)
  const nextEntries = [
    ...existingEntries.filter((entry) => entry.dispatchId !== dispatchId),
    nextEntry,
  ]
  nextEntries.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  return {
    ...current,
    [threadId]: nextEntries,
  }
}

function mergeRuntimeReplayDraftText(
  existingDraftText: string | undefined,
  replayDraftText: string | null | undefined
) {
  const existing = existingDraftText ?? ""
  const replay = typeof replayDraftText === "string" ? replayDraftText : ""
  if (!replay) return existing
  if (!existing) return replay
  if (replay.startsWith(existing)) return replay
  if (existing.startsWith(replay)) return existing
  return replay
}

function isRuntimeDispatchActive(dispatch: RuntimeDispatchUiState) {
  return ["queued", "started", "streaming"].includes(dispatch.status)
}

function removeRuntimeDispatch(
  current: Record<string, RuntimeDispatchUiState[]>,
  threadId: string,
  dispatchId: string
) {
  const existingEntries = current[threadId] ?? []
  const nextEntries = existingEntries.filter(
    (entry) => entry.dispatchId !== dispatchId
  )
  if (nextEntries.length === existingEntries.length) {
    return current
  }
  if (!nextEntries.length) {
    const next = { ...current }
    delete next[threadId]
    return next
  }
  return {
    ...current,
    [threadId]: nextEntries,
  }
}

function upsertRuntimeContextUsage(
  current: Record<string, RuntimeContextUsageUiState[]>,
  payload: RuntimeRunContextPayload
) {
  const existingEntries = current[payload.threadId] ?? []
  const nextEntry: RuntimeContextUsageUiState = {
    dispatchId: payload.dispatchId,
    threadId: payload.threadId,
    threadSessionId: payload.threadSessionId,
    agentId: payload.agentId,
    runtimeType: payload.runtimeType,
    runtimeBindingId: payload.runtimeBindingId,
    runtimeThreadSessionId: payload.runtimeThreadSessionId,
    totalTokens: payload.totalTokens,
    contextTokens: payload.contextTokens,
    percentUsed: payload.percentUsed,
    level: payload.level,
    fresh: payload.fresh,
    sessionId: payload.sessionId,
    model: payload.model,
    modelProvider: payload.modelProvider,
    references: payload.references ?? [],
    updatedAt: payload.timestamp,
  }
  const nextEntries = [
    ...existingEntries.filter((entry) => entry.agentId !== payload.agentId),
    nextEntry,
  ]
  nextEntries.sort(
    (a, b) =>
      (b.percentUsed ?? -1) - (a.percentUsed ?? -1) ||
      b.updatedAt.localeCompare(a.updatedAt)
  )
  return {
    ...current,
    [payload.threadId]: nextEntries,
  }
}
