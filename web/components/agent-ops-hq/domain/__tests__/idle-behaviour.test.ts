import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_AGENTOPS_LAYOUT } from "../default-estate-layout"
import { chooseIdleBehaviour } from "../idle-behaviour"
import type { AgentOpsAgentState } from "../estate-types"

const agent: AgentOpsAgentState = {
  agentId: "agent-1",
  realState: "idle",
  visibleState: "idle_wandering",
  buildingId: "agentops_tower",
  floorId: "floor_01_operations",
  roomId: "common_room",
  position: { x: 100, y: 100 },
  path: [],
  lastRealEventAt: "2026-05-14T12:00:00.000Z",
  visibleStateStartedAt: "2026-05-14T12:00:00.000Z",
  nextIdleDecisionAt: "2026-05-14T12:00:00.000Z",
}

test("idle behaviour chooses a valid room and future decision time", () => {
  const decision = chooseIdleBehaviour(
    DEFAULT_AGENTOPS_LAYOUT,
    agent,
    "2026-05-14T12:00:00.000Z",
    {}
  )
  assert.ok(decision.roomId)
  assert.ok(decision.position.x > 0)
  assert.ok(Date.parse(decision.nextIdleDecisionAt) > Date.parse("2026-05-14T12:00:00.000Z"))
})
