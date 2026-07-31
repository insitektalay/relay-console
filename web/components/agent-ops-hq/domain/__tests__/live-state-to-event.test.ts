import test from "node:test"
import assert from "node:assert/strict"
import type { Agent, AgentOpsLiveAgentState } from "@clawchat/contracts"
import { agentOpsEventFromLiveState } from "../live-state-to-event"

const agent = {
  id: "agent-1",
  name: "Link Herms",
  role: "Bank Link Crest",
  status: "active",
  departmentId: "bank_link_crest_department",
  capabilities: [],
  workingHoursMode: "scheduled",
  timezone: "UTC",
  tasksCompletedToday: 0,
  successRate: 0,
  avgCompletionMinutes: 0,
  totalMinutesWorked: 0,
  budgetUsed: 0,
  createdAt: "2026-05-16T00:00:00.000Z",
  updatedAt: "2026-05-16T00:00:00.000Z",
} as Agent

test("converts backend live tooling state into an AgentOps tool event", () => {
  const liveState: AgentOpsLiveAgentState = {
    agentId: "agent-1",
    realState: "tooling",
    confidence: "strong",
    source: "runtime_tool",
    reason: "Using bank linker",
    updatedAt: "2026-05-16T12:00:00.000Z",
    dispatchId: "dispatch-1",
    threadId: "thread-1",
    runtimeType: "hermes",
    toolName: "bank_linker",
    toolPhase: "started",
  }
  const event = agentOpsEventFromLiveState("workspace-1", agent, liveState)
  assert.equal(event.type, "agent.tool.called")
  assert.equal(event.source, "hermes")
  assert.equal(event.departmentId, "bank_link_crest_department")
  assert.equal(event.payload?.toolName, "bank_linker")
})

test("converts backend idle state into an explicit idle event", () => {
  const liveState: AgentOpsLiveAgentState = {
    agentId: "agent-1",
    realState: "idle",
    confidence: "strong",
    source: "none",
    reason: "No active work",
    updatedAt: "2026-05-16T12:00:00.000Z",
  }
  const event = agentOpsEventFromLiveState("workspace-1", agent, liveState)
  assert.equal(event.type, "agent.idle")
})
