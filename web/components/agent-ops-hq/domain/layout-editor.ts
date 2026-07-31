import type {
  AgentOpsEstateLayout,
  AgentOpsFloor,
  AgentOpsLayoutPathPatch,
  AgentOpsLayoutRoomPatch,
  AgentOpsPoint,
  AgentOpsRoom,
} from "./estate-types"

export const AGENTOPS_LAYOUT_OVERRIDE_STORAGE_KEY =
  "clawchat.agentOpsHq.layoutOverride.v1"

export function cloneAgentOpsLayout(layout: AgentOpsEstateLayout): AgentOpsEstateLayout {
  return JSON.parse(JSON.stringify(layout)) as AgentOpsEstateLayout
}

export function applyRoomLayoutPatch(
  layout: AgentOpsEstateLayout,
  patch: AgentOpsLayoutRoomPatch
): AgentOpsEstateLayout {
  const next = cloneAgentOpsLayout(layout)
  for (const building of next.buildings) {
    for (const floor of building.floors) {
      for (const zone of floor.zones) {
        const room = zone.rooms.find((entry) => entry.id === patch.roomId)
        if (!room) continue
        if (patch.translate) translateRoom(room, patch.translate)
        if (patch.bounds) room.bounds = roundedRect(patch.bounds)
        if (patch.labelPosition) room.labelPosition = roundPoint(patch.labelPosition)
        if (patch.anchor) moveAnchor(room, patch.anchor.group, patch.anchor.index, patch.anchor.position)
        if (patch.addAnchor) addAnchor(room, patch.addAnchor.group, patch.addAnchor.position)
        if (patch.deleteAnchor) deleteAnchor(room, patch.deleteAnchor.group, patch.deleteAnchor.index)
        syncActiveVariant(room)
        return next
      }
    }
  }
  return layout
}

export function applyPathLayoutPatch(
  layout: AgentOpsEstateLayout,
  patch: AgentOpsLayoutPathPatch
): AgentOpsEstateLayout {
  const next = cloneAgentOpsLayout(layout)
  const floor = findFloor(next, patch.floorId)
  if (!floor) return layout
  floor.pathNetwork ??= { waypoints: [], edges: [] }
  const network = floor.pathNetwork

  if (patch.type === "add_waypoint") {
    network.waypoints.push({
      ...patch.waypoint,
      position: roundPoint(patch.waypoint.position),
      tags: uniqueTags(patch.waypoint.tags),
    })
  }
  if (patch.type === "move_waypoint") {
    const waypoint = network.waypoints.find((entry) => entry.id === patch.waypointId)
    if (waypoint) waypoint.position = roundPoint(patch.position)
  }
  if (patch.type === "delete_waypoint") {
    network.waypoints = network.waypoints.filter((entry) => entry.id !== patch.waypointId)
    network.edges = network.edges.filter(
      (entry) => entry.from !== patch.waypointId && entry.to !== patch.waypointId
    )
  }
  if (patch.type === "connect_waypoints" && patch.from !== patch.to) {
    const existing = network.edges.find((entry) =>
      [entry.from, entry.to].sort().join(":") === [patch.from, patch.to].sort().join(":")
    )
    if (!existing) {
      network.edges.push({
        id: `edge_${patch.from}_${patch.to}`,
        from: patch.from,
        to: patch.to,
        tags: uniqueTags(patch.tags),
      })
    }
  }
  if (patch.type === "disconnect_edge") {
    network.edges = network.edges.filter((entry) => entry.id !== patch.edgeId)
  }
  if (patch.type === "set_waypoint_tags") {
    const waypoint = network.waypoints.find((entry) => entry.id === patch.waypointId)
    if (waypoint) waypoint.tags = uniqueTags(patch.tags)
  }
  if (patch.type === "set_edge_tags") {
    const edge = network.edges.find((entry) => entry.id === patch.edgeId)
    if (edge) edge.tags = uniqueTags(patch.tags)
  }

  return next
}

export function loadAgentOpsLayoutOverride(): AgentOpsEstateLayout | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(AGENTOPS_LAYOUT_OVERRIDE_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as AgentOpsEstateLayout
  } catch {
    return null
  }
}

export function saveAgentOpsLayoutOverride(layout: AgentOpsEstateLayout) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    AGENTOPS_LAYOUT_OVERRIDE_STORAGE_KEY,
    JSON.stringify(layout)
  )
}

export function clearAgentOpsLayoutOverride() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(AGENTOPS_LAYOUT_OVERRIDE_STORAGE_KEY)
}

export function getRoomAnchorPosition(
  room: AgentOpsRoom | null,
  group: NonNullable<AgentOpsLayoutRoomPatch["anchor"]>["group"] | null | undefined,
  index: number | null | undefined
) {
  if (!room || !group || index == null) return null
  if (group === "entryAnchors") return room.entryAnchors[index] ?? null
  if (group === "idleAnchors") return room.idleAnchors[index] ?? null
  if (group === "lightAnchors") return room.lightAnchors[index] ?? null
  if (group === "workstations") return room.workstations[index]?.position ?? null
  if (group === "screenAnchors") return room.screenAnchors[index]?.position ?? null
  return null
}

export function exportFloorLayoutJson(
  layout: AgentOpsEstateLayout,
  floorId: string
) {
  const floor = findFloor(layout, floorId)
  return JSON.stringify(floor ?? null, null, 2)
}

export function findFloor(
  layout: AgentOpsEstateLayout,
  floorId: string
): AgentOpsFloor | null {
  for (const building of layout.buildings) {
    const floor = building.floors.find((entry) => entry.id === floorId)
    if (floor) return floor
  }
  return null
}

function translateRoom(room: AgentOpsRoom, delta: AgentOpsPoint) {
  room.bounds = roundedRect({
    ...room.bounds,
    x: room.bounds.x + delta.x,
    y: room.bounds.y + delta.y,
  })
  room.labelPosition = translatePoint(getRoomLabelPosition(room), delta)
  room.entryAnchors = room.entryAnchors.map((point) => translatePoint(point, delta))
  room.idleAnchors = room.idleAnchors.map((point) => translatePoint(point, delta))
  room.lightAnchors = room.lightAnchors.map((point) => translatePoint(point, delta))
  room.workstations = room.workstations.map((workstation) => ({
    ...workstation,
    position: translatePoint(workstation.position, delta),
  }))
  room.screenAnchors = room.screenAnchors.map((screen) => ({
    ...screen,
    position: translatePoint(screen.position, delta),
  }))
  room.variants = room.variants.map((variant) => ({
    ...variant,
    idleAnchors: variant.idleAnchors.map((point) => translatePoint(point, delta)),
    workstations: variant.workstations.map((workstation) => ({
      ...workstation,
      position: translatePoint(workstation.position, delta),
    })),
    screenAnchors: variant.screenAnchors.map((screen) => ({
      ...screen,
      position: translatePoint(screen.position, delta),
    })),
  }))
}

export function getRoomLabelPosition(room: AgentOpsRoom) {
  return room.labelPosition ?? {
    x: Math.round(room.bounds.x + 12),
    y: Math.round(room.bounds.y + 10),
  }
}

function moveAnchor(
  room: AgentOpsRoom,
  group: NonNullable<AgentOpsLayoutRoomPatch["anchor"]>["group"],
  index: number,
  position: AgentOpsPoint
) {
  const rounded = roundPoint(position)
  if (group === "entryAnchors") room.entryAnchors[index] = rounded
  if (group === "idleAnchors") room.idleAnchors[index] = rounded
  if (group === "lightAnchors") room.lightAnchors[index] = rounded
  if (group === "workstations" && room.workstations[index]) {
    room.workstations[index] = { ...room.workstations[index], position: rounded }
  }
  if (group === "screenAnchors" && room.screenAnchors[index]) {
    room.screenAnchors[index] = { ...room.screenAnchors[index], position: rounded }
  }

  room.variants = room.variants.map((variant) => {
    if (variant.id !== room.currentVariantId) return variant
    if (group === "idleAnchors") {
      return {
        ...variant,
        idleAnchors: variant.idleAnchors.map((point, pointIndex) =>
          pointIndex === index ? rounded : point
        ),
      }
    }
    if (group === "workstations") {
      return {
        ...variant,
        workstations: variant.workstations.map((workstation, workstationIndex) =>
          workstationIndex === index
            ? { ...workstation, position: rounded }
            : workstation
        ),
      }
    }
    if (group === "screenAnchors") {
      return {
        ...variant,
        screenAnchors: variant.screenAnchors.map((screen, screenIndex) =>
          screenIndex === index ? { ...screen, position: rounded } : screen
        ),
      }
    }
    return variant
  })
}

function addAnchor(
  room: AgentOpsRoom,
  group: NonNullable<AgentOpsLayoutRoomPatch["addAnchor"]>["group"],
  position: AgentOpsPoint
) {
  const rounded = roundPoint(position)
  if (group === "entryAnchors") room.entryAnchors.push(rounded)
  if (group === "lightAnchors") room.lightAnchors.push(rounded)
  if (group === "idleAnchors") room.idleAnchors.push(rounded)
  const workstationId = group === "workstations" ? nextAnchorId(room, "desk") : null
  const screenId = group === "screenAnchors" ? nextAnchorId(room, "screen") : null
  if (group === "workstations") {
    room.workstations.push({
      id: workstationId ?? nextAnchorId(room, "desk"),
      position: rounded,
      facing: "south",
    })
  }
  if (group === "screenAnchors") {
    room.screenAnchors.push({
      id: screenId ?? nextAnchorId(room, "screen"),
      position: rounded,
      width: 54,
      height: 28,
    })
  }

  room.variants = room.variants.map((variant) => {
    if (variant.id !== room.currentVariantId) return variant
    if (group === "idleAnchors") {
      return { ...variant, idleAnchors: [...variant.idleAnchors, rounded] }
    }
    if (group === "workstations") {
      return {
        ...variant,
        workstations: [
          ...variant.workstations,
          {
            id: workstationId ?? nextAnchorId(room, "desk"),
            position: rounded,
            facing: "south",
          },
        ],
        capacity: Math.max(variant.capacity, variant.workstations.length + 1),
      }
    }
    if (group === "screenAnchors") {
      return {
        ...variant,
        screenAnchors: [
          ...variant.screenAnchors,
          {
            id: screenId ?? nextAnchorId(room, "screen"),
            position: rounded,
            width: 54,
            height: 28,
          },
        ],
      }
    }
    return variant
  })
}

function deleteAnchor(
  room: AgentOpsRoom,
  group: NonNullable<AgentOpsLayoutRoomPatch["deleteAnchor"]>["group"],
  index: number
) {
  if (index < 0) return
  if (group === "entryAnchors") room.entryAnchors.splice(index, 1)
  if (group === "lightAnchors") room.lightAnchors.splice(index, 1)
  if (group === "idleAnchors") room.idleAnchors.splice(index, 1)
  if (group === "workstations") room.workstations.splice(index, 1)
  if (group === "screenAnchors") room.screenAnchors.splice(index, 1)

  room.variants = room.variants.map((variant) => {
    if (variant.id !== room.currentVariantId) return variant
    if (group === "idleAnchors") {
      return {
        ...variant,
        idleAnchors: variant.idleAnchors.filter((_, pointIndex) => pointIndex !== index),
      }
    }
    if (group === "workstations") {
      const workstations = variant.workstations.filter((_, workstationIndex) => workstationIndex !== index)
      return {
        ...variant,
        workstations,
        capacity: Math.max(1, Math.min(variant.capacity, workstations.length)),
      }
    }
    if (group === "screenAnchors") {
      return {
        ...variant,
        screenAnchors: variant.screenAnchors.filter((_, screenIndex) => screenIndex !== index),
      }
    }
    return variant
  })
}

function syncActiveVariant(room: AgentOpsRoom) {
  const activeVariant = room.variants.find((variant) => variant.id === room.currentVariantId)
  if (!activeVariant) return
  room.idleAnchors = activeVariant.idleAnchors
  room.workstations = activeVariant.workstations
  room.screenAnchors = activeVariant.screenAnchors
  room.capacity = activeVariant.capacity
}

function translatePoint(point: AgentOpsPoint, delta: AgentOpsPoint) {
  return roundPoint({ x: point.x + delta.x, y: point.y + delta.y })
}

function roundPoint(point: AgentOpsPoint) {
  return { x: Math.round(point.x), y: Math.round(point.y) }
}

function roundedRect(rect: AgentOpsRoom["bounds"]) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

function uniqueTags<T extends string>(tags: T[]) {
  return Array.from(new Set(tags))
}

function nextAnchorId(room: AgentOpsRoom, prefix: string) {
  const existing = new Set([
    ...room.workstations.map((entry) => entry.id),
    ...room.screenAnchors.map((entry) => entry.id),
    ...room.variants.flatMap((variant) => [
      ...variant.workstations.map((entry) => entry.id),
      ...variant.screenAnchors.map((entry) => entry.id),
    ]),
  ])
  let index = existing.size + 1
  let id = `${room.id}_${prefix}_${index}`
  while (existing.has(id)) {
    index += 1
    id = `${room.id}_${prefix}_${index}`
  }
  return id
}
