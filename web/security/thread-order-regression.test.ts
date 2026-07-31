import assert from "node:assert/strict"
import test from "node:test"
import type { Thread } from "@clawchat/contracts"
import { sortThreadsByRecentActivity } from "../lib/thread-order"

function makeThread(
  id: string,
  updatedAt: string,
  lastMessageCreatedAt?: string
) {
  return {
    id,
    workspaceId: "workspace-1",
    title: id,
    type: "direct",
    status: "active",
    avatarUrl: null,
    participantIds: [],
    agentIds: [],
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
    lastMessage: lastMessageCreatedAt
      ? {
          id: `message-${id}`,
          content: id,
          senderName: "Test",
          createdAt: lastMessageCreatedAt,
        }
      : null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
  } as Thread
}

test("conversation cards are ordered by latest message activity", () => {
  const threads = [
    makeThread(
      "five-hours-old",
      "2026-07-12T10:00:00.000Z",
      "2026-07-12T10:00:00.000Z"
    ),
    makeThread(
      "seven-minutes-old",
      "2026-07-12T14:53:00.000Z",
      "2026-07-12T14:53:00.000Z"
    ),
    makeThread(
      "six-minutes-old",
      "2026-07-12T14:54:00.000Z",
      "2026-07-12T14:54:00.000Z"
    ),
  ]

  assert.deepEqual(
    sortThreadsByRecentActivity(threads).map((thread) => thread.id),
    ["six-minutes-old", "seven-minutes-old", "five-hours-old"]
  )
})

test("conversation ordering falls back to the thread update time", () => {
  const threads = [
    makeThread("older", "2026-07-12T12:00:00.000Z"),
    makeThread("newer", "2026-07-12T13:00:00.000Z"),
  ]

  assert.deepEqual(
    sortThreadsByRecentActivity(threads).map((thread) => thread.id),
    ["newer", "older"]
  )
})
