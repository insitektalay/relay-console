import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_AGENTOPS_LAYOUT } from "../default-estate-layout"
import { createGapMinerMockEventSequence } from "../mock-events"
import { resolveEventLocation } from "../location-resolver"
import type { Agent } from "@clawchat/contracts"

const agent = {
  id: "agent-gapminer",
  name: "GapMiner Analyst",
  role: "SEO Research Agent",
  status: "active",
} as Agent
const agentTwo = {
  id: "agent-seo-2",
  name: "SEO Analyst",
  role: "Research Agent",
  status: "active",
} as Agent
const agentThree = {
  id: "agent-research-3",
  name: "Research Agent",
  role: "Market Research",
  status: "active",
} as Agent

test("GapMiner mock sequence targets the calibrated GapMiner Office", () => {
  const events = createGapMinerMockEventSequence({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    workspaceId: "workspace-1",
    agents: [agent],
    now: new Date("2026-05-14T12:00:00.000Z"),
  })
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "agent.task.queued",
      "agent.task.started",
      "agent.tool.called",
      "agent.task.progress",
      "agent.task.completed",
    ]
  )
  assert.ok(events.every((event) => event.appId === "gapminer"))
  assert.ok(events.every((event) => event.roomId === "gapminer_office"))

  const location = resolveEventLocation(DEFAULT_AGENTOPS_LAYOUT, events[1])
  assert.equal(location.roomId, "gapminer_office")
  assert.equal(location.floorId, "floor_01_operations")
})

test("GapMiner mock sequence supports approval and error outcomes", () => {
  const approval = createGapMinerMockEventSequence({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    workspaceId: "workspace-1",
    agents: [agent],
    scenario: "approval",
  }).at(-1)
  const error = createGapMinerMockEventSequence({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    workspaceId: "workspace-1",
    agents: [agent],
    scenario: "error",
  }).at(-1)
  assert.equal(approval?.type, "agent.waiting_for_approval")
  assert.equal(error?.type, "agent.error")
})

test("GapMiner mock sequence can target multiple agents", () => {
  const events = createGapMinerMockEventSequence({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    workspaceId: "workspace-1",
    agents: [agent, agentTwo, agentThree],
    agentCount: 3,
    now: new Date("2026-05-14T12:00:00.000Z"),
  })
  assert.equal(events.length, 15)
  assert.equal(new Set(events.map((event) => event.agentId)).size, 3)
  assert.ok(events.every((event) => event.roomId === "gapminer_office"))
})
