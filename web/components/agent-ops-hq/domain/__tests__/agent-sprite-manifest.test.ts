import test from "node:test"
import assert from "node:assert/strict"
import { getAgentOpsAgentSprite } from "../agent-sprite-manifest"

test("office worker sprite manifest matches the generated sheet contract", () => {
  const sprite = getAgentOpsAgentSprite("office_worker_01")
  assert.equal(sprite?.src, "/agent-ops-hq/agents/office-worker-01.png")
  assert.equal(sprite?.frameWidth, 64)
  assert.equal(sprite?.frameHeight, 64)
  assert.equal(sprite?.scale, 0.75)
  assert.deepEqual(sprite?.anchor, { x: 0.5, y: 0.82 })
  assert.equal(sprite?.animations.walk_down?.frames, 6)
  assert.equal(sprite?.animations.work_down?.frames, 4)
})
