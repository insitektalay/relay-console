import type {
  AgentOpsEstateLayout,
  AgentOpsRoom,
} from "./estate-types"
import { getAllRooms } from "./location-resolver"

export type AgentOpsDepartmentRoomAssignments = Record<string, string>

export function getDepartmentRoomAssignmentsKey(workspaceId: string) {
  return `agentops.departmentRoomAssignments.${workspaceId}`
}

export function loadDepartmentRoomAssignments(
  workspaceId?: string | null
): AgentOpsDepartmentRoomAssignments {
  if (!workspaceId || typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(
      getDepartmentRoomAssignmentsKey(workspaceId)
    )
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string"
      )
    )
  } catch {
    return {}
  }
}

export function saveDepartmentRoomAssignments(
  workspaceId: string,
  assignments: AgentOpsDepartmentRoomAssignments
) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    getDepartmentRoomAssignmentsKey(workspaceId),
    JSON.stringify(assignments)
  )
}

export function applyDepartmentRoomAssignments(
  layout: AgentOpsEstateLayout,
  assignments: AgentOpsDepartmentRoomAssignments
): AgentOpsEstateLayout {
  if (!Object.keys(assignments).length) return layout

  return {
    ...layout,
    buildings: layout.buildings.map((building) => ({
      ...building,
      floors: building.floors.map((floor) => ({
        ...floor,
        zones: floor.zones.map((zone) => ({
          ...zone,
          rooms: zone.rooms.map((room) => {
            const assignedDepartmentId = Object.entries(assignments).find(
              ([, roomId]) => roomId === room.id
            )?.[0]
            const shouldClearExistingDepartment = Boolean(
              room.departmentId && assignments[room.departmentId]
            )

            if (!assignedDepartmentId && !shouldClearExistingDepartment) {
              return room
            }

            return {
              ...room,
              departmentId: assignedDepartmentId ?? null,
            }
          }),
        })),
      })),
    })),
  }
}

export function getAssignableDepartmentRooms(layout: AgentOpsEstateLayout) {
  return getAllRooms(layout).filter(isAssignableDepartmentRoom)
}

export function departmentRoomLabel(
  room: AgentOpsRoom,
  layout: AgentOpsEstateLayout
) {
  const floor = layout.buildings
    .flatMap((building) => building.floors)
    .find((entry) =>
      entry.zones.some((zone) =>
        zone.rooms.some((candidate) => candidate.id === room.id)
      )
    )
  return floor ? `${floor.label} / ${room.label}` : room.label
}

function isAssignableDepartmentRoom(room: AgentOpsRoom) {
  return !["locked", "inactive", "retired"].includes(room.status)
}
