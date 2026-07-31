import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"
import type { RuntimeRunToolPayload } from "@clawchat/contracts"
import {
  normalizeRuntimeTodoTasks,
  upsertRuntimeToolActivity,
} from "../lib/runtime-live-presentation"

function toolPayload(
  overrides: Partial<RuntimeRunToolPayload>
): RuntimeRunToolPayload {
  return {
    workspaceId: "workspace-1",
    threadId: "thread-1",
    threadSessionId: "thread-session-1",
    dispatchId: "dispatch-1",
    agentId: "agent-1",
    runtimeType: "hermes",
    runtimeBindingId: "binding-1",
    runtimeThreadSessionId: "runtime-session-1",
    timestamp: "2026-07-24T15:00:00.000Z",
    toolName: "terminal",
    phase: "started",
    ...overrides,
  }
}

test("Hermes todo snapshots preserve real task lifecycle states", () => {
  const tasks = normalizeRuntimeTodoTasks([
    { id: "one", content: "Inspect", status: "completed" },
    { id: "two", content: "Implement", status: "in_progress" },
    { id: "three", content: "Verify", status: "cancelled" },
  ])

  assert.deepEqual(
    tasks.map((task) => task.status),
    ["completed", "in_progress", "cancelled"]
  )
})

test("ordinary tools remain developer activity instead of task plans", () => {
  const activity = upsertRuntimeToolActivity(
    [],
    toolPayload({
      toolName: "terminal",
      summary: "Running tests",
      phase: "started",
    })
  )

  assert.deepEqual(activity, [
    {
      toolName: "terminal",
      summary: "Running tests",
      phase: "started",
      updatedAt: "2026-07-24T15:00:00.000Z",
    },
  ])
})

test("thread presentation streams text and gates the checklist on real tasks", () => {
  const source = readFileSync(
    fileURLToPath(
      new URL("../components/threads/thread-detail-pane.tsx", import.meta.url)
    ),
    "utf8"
  )

  assert.match(source, /RuntimeStreamingMarkdown text=\{dispatch\.draftText\}/)
  assert.match(source, /dispatch\.tasks\.length > 0/)
  assert.match(source, /RuntimeTodoProgressCard tasks=\{dispatch\.tasks\}/)
  assert.match(source, /Live update/)
  assert.match(source, /is still working/)
  assert.match(source, /Interim commentary/)
  assert.match(source, /final response will appear/)
  assert.match(source, /RuntimeElapsedTime startedAt=\{liveStartedAt\}/)
  assert.doesNotMatch(source, /Developer log/)
  assert.doesNotMatch(
    source,
    /const liveDetail =\s*dispatch\.draftText \|\|\s*dispatch\.statusMessage \|\|\s*dispatch\.toolSummary/
  )
})

test("macOS presents streamed text as an unfinished live update", () => {
  const dispatchSource = readFileSync(
    fileURLToPath(
      new URL(
        "../../RelayConsoleSwift/Sources/RelayConsoleApp/Features/Chats/ChatMessageViews.swift",
        import.meta.url
      )
    ),
    "utf8"
  )
  const activitySource = readFileSync(
    fileURLToPath(
      new URL(
        "../../RelayConsoleSwift/Sources/RelayConsoleApp/Features/Chats/RuntimeActivityViews.swift",
        import.meta.url
      )
    ),
    "utf8"
  )

  assert.match(dispatchSource, /RuntimeLiveUpdateHeader\(/)
  assert.match(dispatchSource, /is still working/)
  assert.match(dispatchSource, /This is an interim update/)
  assert.match(activitySource, /INTERIM COMMENTARY/)
  assert.match(activitySource, /Interim agent commentary/)
})

test("iPhone direct and team chats use the dedicated live-update card", () => {
  const bubbleSource = readFileSync(
    fileURLToPath(
      new URL(
        "../../ios/ClawChat/Features/Thread/MessageBubbles.swift",
        import.meta.url
      )
    ),
    "utf8"
  )
  const directThreadSource = readFileSync(
    fileURLToPath(
      new URL(
        "../../ios/ClawChat/Features/Thread/ThreadView.swift",
        import.meta.url
      )
    ),
    "utf8"
  )
  const teamThreadSource = readFileSync(
    fileURLToPath(
      new URL(
        "../../ios/ClawChat/Features/Thread/TeamChatView.swift",
        import.meta.url
      )
    ),
    "utf8"
  )

  assert.match(bubbleSource, /Text\("LIVE UPDATE"\)/)
  assert.match(bubbleSource, /is still working/)
  assert.match(bubbleSource, /Text\("INTERIM COMMENTARY"\)/)
  assert.match(bubbleSource, /The final response will appear/)
  assert.match(directThreadSource, /StreamingBubble\(/)
  assert.match(directThreadSource, /startedAt: liveDispatch\?\.startedAt/)
  assert.match(teamThreadSource, /StreamingBubble\(/)
  assert.match(teamThreadSource, /startedAt: liveDispatch\?\.startedAt/)
})
