import type { Message, Paginated, Thread } from "@clawchat/contracts"

export const THREAD_MESSAGE_PAGE_SIZE = 50

export type MessagesQueryKey = readonly ["messages", string, string]

export function buildMessagesQueryKey(
  threadId: string,
  threadSessionId?: string | null
): MessagesQueryKey {
  return ["messages", threadId, threadSessionId ?? "active"] as const
}

export function sortMessages(messages: Message[]) {
  return [...messages].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime()
    const rightTime = new Date(right.createdAt).getTime()
    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }
    return left.id.localeCompare(right.id)
  })
}

export function mergeMessageWindow(
  currentMessages: Message[],
  incomingMessages: Message[]
) {
  const messagesById = new Map<string, Message>()

  for (const message of currentMessages) {
    messagesById.set(message.id, message)
  }
  for (const message of incomingMessages) {
    messagesById.set(message.id, {
      ...(messagesById.get(message.id) ?? {}),
      ...message,
    })
  }

  return sortMessages([...messagesById.values()])
}

export function upsertMessagePage(
  current: Paginated<Message> | undefined,
  message: Message
): Paginated<Message> {
  const data = mergeMessageWindow(current?.data ?? [], [message])
  return {
    data,
    total: Math.max(current?.total ?? 0, data.length),
    page: current?.page ?? 1,
    pageSize: current?.pageSize ?? THREAD_MESSAGE_PAGE_SIZE,
    hasMore: current?.hasMore ?? false,
  }
}

export function prependOlderMessagePage(
  current: Paginated<Message> | undefined,
  olderMessages: Message[],
  hasMore: boolean
): Paginated<Message> {
  const data = mergeMessageWindow(olderMessages, current?.data ?? [])
  return {
    data,
    total: Math.max(current?.total ?? 0, data.length),
    page: current?.page ?? 1,
    pageSize: current?.pageSize ?? THREAD_MESSAGE_PAGE_SIZE,
    hasMore,
  }
}

export function replaceOptimisticMessagePage(
  current: Paginated<Message> | undefined,
  savedMessage: Message,
  optimisticMessageId?: string
): Paginated<Message> {
  const existing = current?.data ?? []
  const withoutOptimistic = optimisticMessageId
    ? existing.filter((message) => message.id !== optimisticMessageId)
    : existing

  return upsertMessagePage(
    current
      ? {
          ...current,
          data: withoutOptimistic,
          total:
            optimisticMessageId && withoutOptimistic.length < existing.length
              ? Math.max(0, current.total - 1)
              : current.total,
        }
      : undefined,
    savedMessage
  )
}

export function patchThreadForMessage(
  thread: Thread,
  message: Message
): Thread {
  return {
    ...thread,
    lastMessage: {
      id: message.id,
      content: message.content,
      senderName: message.senderName,
      createdAt: message.createdAt,
    },
    updatedAt: message.createdAt,
  }
}

export function logMessageSyncDiagnostic(
  action: string,
  details: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "production") {
    return
  }

  console.debug(`[Relay Console message sync] ${action}`, details)
}
