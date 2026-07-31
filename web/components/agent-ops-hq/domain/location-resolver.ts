import type { Agent, Department, Task } from "@clawchat/contracts"
import type {
  AgentOpsApplication,
  AgentOpsEstateLayout,
  AgentOpsEvent,
  AgentOpsFloor,
  AgentOpsPoint,
  AgentOpsRoom,
} from "./estate-types"
import { roomVariant } from "./estate-types"
import { getAgentOpsFloorAsset } from "./asset-manifest"

export type AgentOpsResolvedLocation = {
  buildingId: string
  floorId: string
  zoneId: string
  roomId: string
  position: AgentOpsPoint
  reason: string
}

export function getDefaultBuilding(layout: AgentOpsEstateLayout) {
  return layout.buildings[0]
}

export function getDefaultFloor(layout: AgentOpsEstateLayout) {
  const building = getDefaultBuilding(layout)
  return (
    building?.floors.find((floor) => floor.id === building.defaultFloorId) ??
    building?.floors[0]
  )
}

export function getPrimaryUsableFloor(layout: AgentOpsEstateLayout) {
  const defaultFloor = getDefaultFloor(layout)
  if (isAssetBackedFloor(defaultFloor)) return defaultFloor
  return (
    layout.buildings
      .flatMap((building) => building.floors)
      .find((floor) => isAssetBackedFloor(floor)) ??
    defaultFloor ??
    layout.buildings[0]?.floors[0] ??
    null
  )
}

export function isAssetBackedFloor(floor?: AgentOpsFloor | null) {
  return Boolean(floor?.backgroundAssetId && getAgentOpsFloorAsset(floor.backgroundAssetId))
}

export function getAllRooms(layout: AgentOpsEstateLayout): AgentOpsRoom[] {
  return layout.buildings.flatMap((building) =>
    building.floors.flatMap((floor) =>
      floor.zones.flatMap((zone) => zone.rooms)
    )
  )
}

export function getFloorRooms(
  layout: AgentOpsEstateLayout,
  floorId: string
): AgentOpsRoom[] {
  return (
    findFloor(layout, floorId)?.zones.flatMap((zone) => zone.rooms) ?? []
  )
}

export function findFloor(layout: AgentOpsEstateLayout, floorId?: string | null) {
  if (!floorId) return null
  for (const building of layout.buildings) {
    const floor = building.floors.find((entry) => entry.id === floorId)
    if (floor) return floor
  }
  return null
}

export function findRoom(
  layout: AgentOpsEstateLayout,
  roomId?: string | null
): AgentOpsRoom | null {
  if (!roomId) return null
  return getAllRooms(layout).find((room) => room.id === roomId) ?? null
}

export function findRoomFloor(
  layout: AgentOpsEstateLayout,
  roomId: string
): AgentOpsFloor | null {
  for (const building of layout.buildings) {
    for (const floor of building.floors) {
      if (floor.zones.some((zone) => zone.rooms.some((room) => room.id === roomId))) {
        return floor
      }
    }
  }
  return null
}

export function resolveEventLocation(
  layout: AgentOpsEstateLayout,
  event: AgentOpsEvent,
  options?: { agent?: Agent | null; departments?: Department[]; task?: Task | null }
): AgentOpsResolvedLocation {
  const explicitRoom = findRoom(layout, event.roomId)
  if (explicitRoom) return toResolved(layout, explicitRoom, "event room")

  const taskRoom = resolveTaskRoom(layout, options?.task)
  if (taskRoom) return toResolved(layout, taskRoom, "task target")

  const appRoom = resolveApplicationRoom(layout, event.appId)
  if (appRoom) return toResolved(layout, appRoom, "application mapping")

  const workflowRoom = resolveWorkflowRoom(layout, event.workflowId)
  if (workflowRoom) return toResolved(layout, workflowRoom, "workflow mapping")

  const outputRoom = resolveOutputRoom(layout, event.outputTypeId)
  if (outputRoom) return toResolved(layout, outputRoom, "output mapping")

  const departmentRoom = resolveDepartmentRoom(layout, event.departmentId)
  if (departmentRoom) return toResolved(layout, departmentRoom, "department mapping")

  const agentHome = resolveAgentHomeRoom(layout, options?.agent ?? null)
  if (agentHome) return toResolved(layout, agentHome, "agent home")

  return resolveIdleLocation(layout, "common_room")
}

export function resolveAgentHomeRoom(
  layout: AgentOpsEstateLayout,
  agent?: Agent | null
): AgentOpsRoom | null {
  if (!agent) return null
  const assignment = layout.departmentAssignments
    .filter((entry) => entry.agentId === agent.id)
    .sort((left, right) => right.priority - left.priority)[0]
  if (assignment?.roomId) return findRoom(layout, assignment.roomId)
  if (assignment?.appId) return resolveApplicationRoom(layout, assignment.appId)
  if (assignment?.departmentId) {
    return resolveDepartmentRoom(layout, assignment.departmentId)
  }
  if (agent.departmentId) return resolveDepartmentRoom(layout, agent.departmentId)
  const runtimeType = agent.runtimeBinding?.runtimeType ?? agent.source
  if (runtimeType === "hermes" || runtimeType === "openclaw") {
    return findRoom(layout, "agent_monitoring_room")
  }
  return null
}

export function resolveIdleLocation(
  layout: AgentOpsEstateLayout,
  preferredRoomId?: string
): AgentOpsResolvedLocation {
  const room =
    findRoom(layout, preferredRoomId) ??
    findRoom(layout, "common_room") ??
    getAllRooms(layout).find((entry) => entry.status !== "locked") ??
    getAllRooms(layout)[0]
  return toResolved(layout, room, "idle")
}

export function resolveApplicationRoom(
  layout: AgentOpsEstateLayout,
  appId?: string | null
): AgentOpsRoom | null {
  const app = findApplication(layout, appId)
  if (!app) return null
  return (
    findRoom(layout, app.defaultRoomId) ??
    resolveDepartmentRoom(layout, app.defaultDepartmentId) ??
    getAllRooms(layout).find((room) => room.applicationIds?.includes(app.appId)) ??
    null
  )
}

export function findApplication(
  layout: AgentOpsEstateLayout,
  appId?: string | null
): AgentOpsApplication | null {
  if (!appId) return null
  const normalized = appId.toLowerCase()
  return (
    layout.applications.find(
      (app) =>
        app.appId.toLowerCase() === normalized ||
        app.label.toLowerCase() === normalized
    ) ?? null
  )
}

export function resolveDepartmentRoom(
  layout: AgentOpsEstateLayout,
  departmentId?: string | null
): AgentOpsRoom | null {
  if (!departmentId) return null
  return (
    getAllRooms(layout).find((room) => room.departmentId === departmentId) ??
    getAllRooms(layout).find((room) => room.id === departmentId) ??
    null
  )
}

function resolveWorkflowRoom(layout: AgentOpsEstateLayout, workflowId?: string | null) {
  if (!workflowId) return null
  const workflow = layout.workflows.find((entry) => entry.id === workflowId)
  if (!workflow) return null
  return resolveDepartmentRoom(layout, workflow.departmentId)
}

function resolveOutputRoom(layout: AgentOpsEstateLayout, outputTypeId?: string | null) {
  if (!outputTypeId) return null
  const output = layout.outputTypes.find((entry) => entry.id === outputTypeId)
  if (!output) return null
  return resolveDepartmentRoom(layout, output.departmentId)
}

function resolveTaskRoom(layout: AgentOpsEstateLayout, task?: Task | null) {
  if (!task) return null
  if (task.departmentId) return resolveDepartmentRoom(layout, task.departmentId)
  if (task.assignedAgentId) {
    const assignment = layout.departmentAssignments.find(
      (entry) => entry.agentId === task.assignedAgentId
    )
    if (assignment?.roomId) return findRoom(layout, assignment.roomId)
  }
  return null
}

function toResolved(
  layout: AgentOpsEstateLayout,
  room: AgentOpsRoom,
  reason: string
): AgentOpsResolvedLocation {
  const floor = findRoomFloor(layout, room.id) ?? getDefaultFloor(layout)!
  const building =
    layout.buildings.find((entry) =>
      entry.floors.some((floorEntry) => floorEntry.id === floor.id)
    ) ?? getDefaultBuilding(layout)!
  const variant = roomVariant(room)
  const anchor =
    variant.workstations[0]?.position ??
    variant.idleAnchors[0] ??
    room.idleAnchors[0] ??
    room.entryAnchors[0] ?? {
      x: room.bounds.x + room.bounds.width / 2,
      y: room.bounds.y + room.bounds.height / 2,
    }
  return {
    buildingId: building.id,
    floorId: floor.id,
    zoneId: room.zoneId,
    roomId: room.id,
    position: anchor,
    reason,
  }
}
