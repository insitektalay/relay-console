import test from "node:test"
import assert from "node:assert/strict"
import type { Agent } from "@clawchat/contracts"
import { DEFAULT_AGENTOPS_LAYOUT } from "../default-estate-layout"
import { createInitialAgentOpsState } from "../simulation-reducer"
import { toRenderSnapshot } from "../selectors"

function makeAgent(id: string, name: string): Agent {
  return {
    id,
    name,
    role: "Agent",
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
}

test("live render snapshot includes all selected idle real agents despite pilot filter", () => {
  const agents = [
    makeAgent("agent-1", "One"),
    makeAgent("agent-2", "Two"),
    makeAgent("agent-3", "Three"),
    makeAgent("agent-4", "Link Hermes"),
  ]
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents,
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-16T08:00:00.000Z",
  })

  const snapshot = toRenderSnapshot({
    ...state,
    mode: "live",
    debug: { ...state.debug, gapMinerPilotOnly: true },
  })

  assert.deepEqual(
    snapshot.agents.map((agent) => agent.agentId).sort(),
    agents.map((agent) => agent.id).sort()
  )
})
