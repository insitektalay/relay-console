import test from "node:test"
import assert from "node:assert/strict"
import type { Agent } from "@clawchat/contracts"
import { DEFAULT_AGENTOPS_LAYOUT } from "../default-estate-layout"
import { normalizeAgentOpsEvents } from "../event-normalizer"

const agent = {
  id: "agent-1",
  name: "SEO Agent",
  role: "Researcher",
  status: "active",
  capabilities: [],
  workingHoursMode: "scheduled",
  timezone: "UTC",
  tasksCompletedToday: 0,
  successRate: 0,
  avgCompletionMinutes: 0,
  totalMinutesWorked: 0,
  budgetUsed: 0,
  createdAt: "2026-05-14T00:00:00.000Z",
  updatedAt: "2026-05-14T00:00:00.000Z",
} as Agent

test("normalizes runtime dispatches into AgentOps work events", () => {
  const events = normalizeAgentOpsEvents(DEFAULT_AGENTOPS_LAYOUT, {
    workspaceId: "workspace-1",
    agents: [agent],
    departments: [],
    tasks: [],
    approvals: [],
    runtimeDispatches: [
      {
        dispatchId: "dispatch-1",
        threadId: "thread-1",
        threadSessionId: "session-1",
        agentId: "agent-1",
        runtimeType: "hermes",
        status: "streaming",
        draftText: "",
        draftThinking: "",
        toolSummary: "GapMiner scan",
        tasks: [],
        toolActivity: [],
        updatedAt: "2026-05-14T12:00:00.000Z",
      },
    ],
  })
  assert.ok(events.some((event) => event.type === "agent.task.started"))
  assert.ok(events.some((event) => event.type === "agent.tool.called"))
  assert.equal(
    events.find((event) => event.type === "agent.tool.called")?.appId,
    "gapminer"
  )
})

test("normalizes pending approvals to approval room events", () => {
  const events = normalizeAgentOpsEvents(DEFAULT_AGENTOPS_LAYOUT, {
    workspaceId: "workspace-1",
    agents: [agent],
    departments: [],
    tasks: [],
    approvals: [
      {
        id: "approval-1",
        title: "Publish short",
        description: "Short Relay needs approval",
        status: "pending",
        requestedByAgentId: "agent-1",
        workspaceId: "workspace-1",
        risk: "medium",
        steps: [],
        metadata: {},
        createdAt: "2026-05-14T12:00:00.000Z",
        updatedAt: "2026-05-14T12:00:00.000Z",
      },
    ],
  })
  assert.equal(events[0]?.type, "agent.waiting_for_approval")
  assert.equal(events[0]?.roomId, "human_approval_room")
})
