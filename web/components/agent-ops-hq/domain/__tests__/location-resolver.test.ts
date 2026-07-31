import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_AGENTOPS_LAYOUT } from "../default-estate-layout"
import {
  resolveApplicationRoom,
  resolveEventLocation,
  resolveIdleLocation,
} from "../location-resolver"

test("resolves applications through data-driven default departments", () => {
  const room = resolveApplicationRoom(DEFAULT_AGENTOPS_LAYOUT, "gapminer")
  assert.equal(room?.id, "gapminer_office")
})

test("resolves event location without renderer-specific application logic", () => {
  const location = resolveEventLocation(DEFAULT_AGENTOPS_LAYOUT, {
    id: "event-1",
    type: "agent.task.started",
    workspaceId: "workspace-1",
    source: "mock",
    timestamp: "2026-05-14T12:00:00.000Z",
    severity: "info",
    title: "Started",
    appId: "ai_tube_watch",
  })
  assert.equal(location.roomId, "youtube_department")
  assert.equal(location.floorId, "floor_01_operations")
})

test("resolves idle location to a usable shared room", () => {
  const location = resolveIdleLocation(DEFAULT_AGENTOPS_LAYOUT)
  assert.equal(location.roomId, "common_room")
})
