import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_AGENTOPS_LAYOUT } from "../default-estate-layout"
import {
  applyRoomLayoutPatch,
  cloneAgentOpsLayout,
  exportFloorLayoutJson,
} from "../layout-editor"
import { findRoom } from "../location-resolver"

test("layout editor patches room bounds and exports image-pixel floor JSON", () => {
  const layout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  const next = applyRoomLayoutPatch(layout, {
    roomId: "youtube_department",
    bounds: { x: 501, y: 62, width: 240, height: 150 },
  })
  const room = findRoom(next, "youtube_department")
  assert.deepEqual(room?.bounds, { x: 501, y: 62, width: 240, height: 150 })

  const exported = JSON.parse(exportFloorLayoutJson(next, "floor_01_operations"))
  assert.equal(exported.bounds.width, 1586)
  assert.equal(exported.bounds.height, 992)
  assert.equal(
    exported.zones
      .flatMap((zone: { rooms: Array<{ id: string; bounds: unknown }> }) => zone.rooms)
      .find((entry: { id: string }) => entry.id === "youtube_department").bounds.x,
    501
  )
})

test("layout editor translates room anchors with room drag", () => {
  const layout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  const before = findRoom(layout, "youtube_department")
  assert.ok(before)
  const next = applyRoomLayoutPatch(layout, {
    roomId: "youtube_department",
    translate: { x: 12, y: 16 },
  })
  const after = findRoom(next, "youtube_department")
  assert.ok(after)
  assert.equal(after.bounds.x, before.bounds.x + 12)
  assert.equal(after.entryAnchors[0].x, before.entryAnchors[0].x + 12)
  assert.equal(after.workstations[0].position.y, before.workstations[0].position.y + 16)
})

test("layout editor patches and translates room label positions", () => {
  const layout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  const patched = applyRoomLayoutPatch(layout, {
    roomId: "gapminer_office",
    labelPosition: { x: 123, y: 456 },
  })
  assert.deepEqual(findRoom(patched, "gapminer_office")?.labelPosition, {
    x: 123,
    y: 456,
  })
  const translated = applyRoomLayoutPatch(patched, {
    roomId: "gapminer_office",
    translate: { x: 10, y: -6 },
  })
  assert.deepEqual(findRoom(translated, "gapminer_office")?.labelPosition, {
    x: 133,
    y: 450,
  })
})

test("layout editor adds and deletes room anchors", () => {
  const layout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  const before = findRoom(layout, "mission_control_infrastructure")
  assert.ok(before)

  const added = applyRoomLayoutPatch(layout, {
    roomId: "mission_control_infrastructure",
    addAnchor: {
      group: "workstations",
      position: { x: 101, y: 202 },
    },
  })
  const withDesk = findRoom(added, "mission_control_infrastructure")
  assert.ok(withDesk)
  assert.equal(withDesk.workstations.length, before.workstations.length + 1)
  assert.deepEqual(withDesk.workstations.at(-1)?.position, { x: 101, y: 202 })
  assert.equal(
    withDesk.variants.find((variant) => variant.id === withDesk.currentVariantId)?.workstations.length,
    withDesk.workstations.length
  )

  const deleted = applyRoomLayoutPatch(added, {
    roomId: "mission_control_infrastructure",
    deleteAnchor: {
      group: "workstations",
      index: withDesk.workstations.length - 1,
    },
  })
  const withoutDesk = findRoom(deleted, "mission_control_infrastructure")
  assert.ok(withoutDesk)
  assert.equal(withoutDesk.workstations.length, before.workstations.length)
})
