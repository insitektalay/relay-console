import type { Thread } from "@clawchat/contracts"

function parseThreadActivityTime(value?: string | null) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function getThreadActivityTime(thread: Thread) {
  return (
    parseThreadActivityTime(thread.lastMessage?.createdAt) ??
    parseThreadActivityTime(thread.updatedAt) ??
    parseThreadActivityTime(thread.createdAt) ??
    0
  )
}

export function sortThreadsByRecentActivity(threads: Thread[]) {
  return [...threads].sort(
    (left, right) => getThreadActivityTime(right) - getThreadActivityTime(left)
  )
}
