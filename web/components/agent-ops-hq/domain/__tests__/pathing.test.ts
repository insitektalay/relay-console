import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_AGENTOPS_LAYOUT } from "../default-estate-layout"
import { buildPath, stepAlongPath } from "../pathing"
import { cloneAgentOpsLayout } from "../layout-editor"

test("pathing builds waypoint routes through room entries", () => {
  const path = buildPath(
    DEFAULT_AGENTOPS_LAYOUT,
    { x: 500, y: 100 },
    { x: 1510, y: 92 },
    "common_room",
    "gapminer_office"
  )
  assert.ok(path.length >= 4)
  assert.deepEqual(path[0], { x: 500, y: 100 })
  assert.deepEqual(path[path.length - 1], { x: 1510, y: 92 })
})

test("pathing prefers calibrated floor path network when present", () => {
  const layout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  const floor = layout.buildings.flatMap((building) => building.floors).find((entry) => entry.id === "floor_01_operations")
  assert.ok(floor)
  floor.pathNetwork = {
    waypoints: [
      { id: "a", position: { x: 100, y: 100 }, tags: ["main"] },
      { id: "b", position: { x: 200, y: 100 }, tags: ["main"] },
      { id: "c", position: { x: 300, y: 100 }, tags: ["main", "room_entry"] },
    ],
    edges: [
      { id: "ab", from: "a", to: "b", tags: ["main"] },
      { id: "bc", from: "b", to: "c", tags: ["main"] },
    ],
  }
  const path = buildPath(
    layout,
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    null,
    "gapminer_office"
  )
  assert.ok(path.some((point) => point.x === 200 && point.y === 100))
})

test("pathing hands off from a room-entry waypoint to internal room anchors", () => {
  const layout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  const floor = layout.buildings.flatMap((building) => building.floors).find((entry) => entry.id === "floor_01_operations")
  assert.ok(floor)
  floor.pathNetwork = {
    waypoints: [
      { id: "a", position: { x: 100, y: 100 }, tags: ["main"] },
      { id: "b", position: { x: 200, y: 100 }, tags: ["main", "room_entry"] },
    ],
    edges: [{ id: "ab", from: "a", to: "b", tags: ["main"] }],
  }
  const path = buildPath(
    layout,
    { x: 100, y: 100 },
    { x: 330, y: 130 },
    null,
    "gapminer_office"
  )
  assert.ok(path.some((point) => point.x === 200 && point.y === 100))
  assert.deepEqual(path[path.length - 1], { x: 330, y: 130 })
})

test("pathing rejects off-network starts when calibrated network exists", () => {
  const layout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  const floor = layout.buildings.flatMap((building) => building.floors).find((entry) => entry.id === "floor_01_operations")
  assert.ok(floor)
  floor.pathNetwork = {
    waypoints: [
      { id: "a", position: { x: 100, y: 100 }, tags: ["main"] },
      { id: "b", position: { x: 200, y: 100 }, tags: ["main", "room_entry"] },
    ],
    edges: [{ id: "ab", from: "a", to: "b", tags: ["main"] }],
  }
  const path = buildPath(
    layout,
    { x: 40, y: 40 },
    { x: 330, y: 130 },
    null,
    "gapminer_office"
  )
  assert.equal(path.length, 0)
})

test("pathing does not invent room access when calibrated network has no room entry", () => {
  const layout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  const floor = layout.buildings.flatMap((building) => building.floors).find((entry) => entry.id === "floor_01_operations")
  assert.ok(floor)
  floor.pathNetwork = {
    waypoints: [
      { id: "a", position: { x: 100, y: 100 }, tags: ["main", "idle"] },
      { id: "b", position: { x: 200, y: 100 }, tags: ["main", "idle"] },
    ],
    edges: [{ id: "ab", from: "a", to: "b", tags: ["main", "idle"] }],
  }
  const path = buildPath(
    layout,
    { x: 100, y: 100 },
    { x: 330, y: 130 },
    null,
    "gapminer_office"
  )
  assert.equal(path.length, 0)
})

test("path stepping advances toward the next waypoint", () => {
  const path = [{ x: 100, y: 0 }]
  const stepped = stepAlongPath(path, { x: 0, y: 0 }, 500, 100)
  assert.equal(Math.round(stepped.position.x), 50)
  assert.equal(stepped.path.length, 1)
})
