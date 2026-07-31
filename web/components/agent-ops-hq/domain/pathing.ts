import type { AgentOpsEstateLayout, AgentOpsPathEdge, AgentOpsPathTag, AgentOpsPathWaypoint, AgentOpsPoint } from "./estate-types"
import { findRoom, findRoomFloor, getDefaultFloor, getPrimaryUsableFloor, isAssetBackedFloor } from "./location-resolver"

export function distance(a: AgentOpsPoint, b: AgentOpsPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function buildPath(
  layout: AgentOpsEstateLayout,
  from: AgentOpsPoint,
  to: AgentOpsPoint,
  fromRoomId?: string | null,
  toRoomId?: string | null
): AgentOpsPoint[] {
  const fromRoom = findRoom(layout, fromRoomId)
  const toRoom = findRoom(layout, toRoomId)
  const fromExit = fromRoom?.entryAnchors[0]
  const toEntry = toRoom?.entryAnchors[0]
  const networkPath = buildNetworkPath(layout, from, to, fromRoomId, toRoomId)
  if (networkPath.length) return networkPath
  if (hasAuthoritativePathNetwork(layout, fromRoomId, toRoomId)) return []

  const corridorY = pickCorridorY(from, to, fromExit, toEntry)
  const points = [
    from,
    fromExit,
    fromExit ? { x: fromExit.x, y: corridorY } : { x: from.x, y: corridorY },
    { x: toEntry?.x ?? to.x, y: corridorY },
    toEntry,
    to,
  ].filter((point): point is AgentOpsPoint => Boolean(point))

  return compactPath(points)
}

function hasAuthoritativePathNetwork(
  layout: AgentOpsEstateLayout,
  fromRoomId?: string | null,
  toRoomId?: string | null
) {
  const floor =
    (toRoomId ? findRoomFloor(layout, toRoomId) : null) ??
    (fromRoomId ? findRoomFloor(layout, fromRoomId) : null) ??
    getDefaultFloor(layout)
  const network = floor?.pathNetwork
  return Boolean(network?.waypoints.length && network.edges.length)
}

export function buildIdlePath(
  layout: AgentOpsEstateLayout,
  from: AgentOpsPoint,
  to: AgentOpsPoint,
  fromRoomId?: string | null,
  toRoomId?: string | null
) {
  return buildNetworkPath(layout, from, to, fromRoomId, toRoomId, ["idle", "social", "outside", "room_entry"])
}

export function getIdleWaypointPositions(layout: AgentOpsEstateLayout) {
  const network = getIdleNetwork(layout)
  if (!network) return []
  const waypointById = new Map(network.waypoints.map((waypoint) => [waypoint.id, waypoint]))
  const ids = new Set<string>()
  for (const edge of network.edges) {
    ids.add(edge.from)
    ids.add(edge.to)
  }
  return Array.from(ids)
    .map((id) => waypointById.get(id)?.position)
    .filter((point): point is AgentOpsPoint => Boolean(point))
}

export function buildIdleRoamPath(
  layout: AgentOpsEstateLayout,
  from: AgentOpsPoint,
  seed: string
) {
  const network = getIdleNetwork(layout)
  if (!network) return []
  const start = nearestWaypoint(network.waypoints, from, IDLE_PATH_TAGS)
  if (!start) return []
  const connected = network.edges
    .filter((edge) => edge.from === start.id || edge.to === start.id)
    .map((edge) => (edge.from === start.id ? edge.to : edge.from))
    .map((id) => network.waypoints.find((waypoint) => waypoint.id === id))
    .filter((waypoint): waypoint is AgentOpsPathWaypoint => Boolean(waypoint))
  const target =
    connected[Math.abs(hashString(seed)) % Math.max(1, connected.length)] ??
    network.waypoints[Math.abs(hashString(`${seed}:fallback`)) % network.waypoints.length]
  if (!target) return []
  return compactPath([from, start.position, target.position])
}

function buildNetworkPath(
  layout: AgentOpsEstateLayout,
  from: AgentOpsPoint,
  to: AgentOpsPoint,
  fromRoomId?: string | null,
  toRoomId?: string | null,
  allowedTags: AgentOpsPathTag[] = ["main", "idle", "room_entry", "outside", "social"]
) {
  const toRoom = findRoom(layout, toRoomId)
  const fromRoom = findRoom(layout, fromRoomId)
  const floor =
    (toRoomId ? findRoomFloor(layout, toRoomId) : null) ??
    (fromRoomId ? findRoomFloor(layout, fromRoomId) : null) ??
    getDefaultFloor(layout)
  const network = floor?.pathNetwork
  if (!network || network.waypoints.length < 2 || !network.edges.length) return []
  const usableEdges = network.edges.filter((edge) => {
    if (edge.tags.includes("restricted") && !allowedTags.includes("restricted")) return false
    return edge.tags.some((tag) => allowedTags.includes(tag))
  })
  if (!usableEdges.length) return []

  const fromExit = fromRoom?.entryAnchors[0]
  const toEntry = toRoom?.entryAnchors[0]
  if (
    !isPointOnNetwork(
      fromRoom ? fromExit ?? from : from,
      network.waypoints,
      usableEdges
    )
  ) {
    return []
  }
  const start = fromRoom
    ? nearestWaypoint(network.waypoints, fromExit ?? from, ["room_entry"])
    : nearestWaypoint(network.waypoints, from, allowedTags)
  const end = toRoom
    ? nearestWaypoint(network.waypoints, toEntry ?? to, ["room_entry"])
    : nearestWaypoint(network.waypoints, to, allowedTags)
  if (!start || !end) return []
  const route = shortestWaypointRoute(network.waypoints, usableEdges, start.id, end.id)
  if (!route.length) return []
  return compactPath([
    fromRoom ? from : null,
    fromRoom ? fromExit : null,
    ...route.map((waypoint) => waypoint.position),
    toRoom ? toEntry : null,
    toRoom ? to : null,
  ].filter((point): point is AgentOpsPoint => Boolean(point)))
}

const IDLE_PATH_TAGS: AgentOpsPathTag[] = ["idle", "social", "outside"]

function getIdleNetwork(layout: AgentOpsEstateLayout) {
  const primaryFloor = getPrimaryUsableFloor(layout)
  const floors = [
    primaryFloor,
    ...layout.buildings.flatMap((building) => building.floors),
  ].filter((floor, index, all): floor is NonNullable<typeof floor> =>
    Boolean(floor && isAssetBackedFloor(floor) && all.findIndex((entry) => entry?.id === floor.id) === index)
  )

  for (const floor of floors) {
    const network = floor.pathNetwork
    if (!network) continue
    const usableEdges = network.edges.filter((edge) => {
      if (edge.tags.includes("restricted")) return false
      return edge.tags.some((tag) => IDLE_PATH_TAGS.includes(tag))
    })
    if (!usableEdges.length) continue
    const waypointIds = new Set(usableEdges.flatMap((edge) => [edge.from, edge.to]))
    const usableWaypoints = network.waypoints.filter((waypoint) => {
      if (!waypointIds.has(waypoint.id) || waypoint.tags.includes("restricted")) return false
      return waypoint.tags.some((tag) => IDLE_PATH_TAGS.includes(tag))
    })
    if (usableWaypoints.length) {
      return { waypoints: usableWaypoints, edges: usableEdges }
    }
  }
  return null
}

function nearestWaypoint(
  waypoints: AgentOpsPathWaypoint[],
  point: AgentOpsPoint,
  allowedTags: AgentOpsPathTag[]
) {
  return waypoints
    .filter((waypoint) => waypoint.tags.some((tag) => allowedTags.includes(tag)) && !waypoint.tags.includes("restricted"))
    .sort((left, right) => distance(left.position, point) - distance(right.position, point))[0]
}

function shortestWaypointRoute(
  waypoints: AgentOpsPathWaypoint[],
  edges: AgentOpsPathEdge[],
  startId: string,
  endId: string
) {
  const byId = new Map(waypoints.map((waypoint) => [waypoint.id, waypoint]))
  const distances = new Map<string, number>([[startId, 0]])
  const previous = new Map<string, string>()
  const unvisited = new Set(waypoints.map((waypoint) => waypoint.id))
  while (unvisited.size) {
    const current = [...unvisited].sort((left, right) => (distances.get(left) ?? Infinity) - (distances.get(right) ?? Infinity))[0]
    if (!current || (distances.get(current) ?? Infinity) === Infinity) break
    unvisited.delete(current)
    if (current === endId) break
    for (const edge of edges.filter((entry) => entry.from === current || entry.to === current)) {
      const next = edge.from === current ? edge.to : edge.from
      if (!unvisited.has(next)) continue
      const currentPoint = byId.get(current)?.position
      const nextPoint = byId.get(next)?.position
      if (!currentPoint || !nextPoint) continue
      const score = (distances.get(current) ?? 0) + distance(currentPoint, nextPoint)
      if (score < (distances.get(next) ?? Infinity)) {
        distances.set(next, score)
        previous.set(next, current)
      }
    }
  }
  if (startId !== endId && !previous.has(endId)) return []
  const route: AgentOpsPathWaypoint[] = []
  let cursor: string | undefined = endId
  while (cursor) {
    const waypoint = byId.get(cursor)
    if (waypoint) route.unshift(waypoint)
    if (cursor === startId) break
    cursor = previous.get(cursor)
  }
  return route
}

function isPointOnNetwork(
  point: AgentOpsPoint,
  waypoints: AgentOpsPathWaypoint[],
  edges: AgentOpsPathEdge[]
) {
  if (waypoints.some((waypoint) => distance(point, waypoint.position) <= 3)) return true
  const byId = new Map(waypoints.map((waypoint) => [waypoint.id, waypoint.position]))
  return edges.some((edge) => {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    if (!from || !to) return false
    return distanceToSegment(point, from, to) <= 3
  })
}

function distanceToSegment(point: AgentOpsPoint, from: AgentOpsPoint, to: AgentOpsPoint) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (!lengthSquared) return distance(point, from)
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared))
  return distance(point, { x: from.x + t * dx, y: from.y + t * dy })
}

export function stepAlongPath(
  path: AgentOpsPoint[],
  current: AgentOpsPoint,
  deltaMs: number,
  speed: number
) {
  if (!path.length) return { position: current, path: [] }
  const remaining = [...path]
  let position = current
  let budget = Math.max(0, (deltaMs / 1000) * speed)

  while (budget > 0 && remaining.length) {
    const target = remaining[0]
    const segment = distance(position, target)
    if (segment <= budget || segment < 0.5) {
      position = target
      remaining.shift()
      budget -= segment
      continue
    }
    const ratio = budget / segment
    position = {
      x: position.x + (target.x - position.x) * ratio,
      y: position.y + (target.y - position.y) * ratio,
    }
    budget = 0
  }

  return { position, path: remaining }
}

function pickCorridorY(
  from: AgentOpsPoint,
  to: AgentOpsPoint,
  fromExit?: AgentOpsPoint,
  toEntry?: AgentOpsPoint
) {
  const startY = fromExit?.y ?? from.y
  const endY = toEntry?.y ?? to.y
  return Math.round((startY + endY) / 2 / 20) * 20
}

function compactPath(points: AgentOpsPoint[]) {
  const compact: AgentOpsPoint[] = []
  for (const point of points) {
    const previous = compact[compact.length - 1]
    if (!previous || distance(previous, point) > 1) {
      compact.push(point)
    }
  }
  return compact
}

function hashString(value: string) {
  let result = 0
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) >>> 0
  }
  return result
}
