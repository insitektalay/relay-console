import type {
  AgentOpsAgentState,
  AgentOpsEstateLayout,
  AgentOpsPoint,
  AgentOpsVisibleState,
} from "./estate-types"
import {
  findRoom,
  findRoomFloor,
  getFloorRooms,
  getPrimaryUsableFloor,
  isAssetBackedFloor,
} from "./location-resolver"
import { roomVariant } from "./estate-types"

export type AgentOpsIdleDecision = {
  visibleState: AgentOpsVisibleState
  roomId: string
  position: AgentOpsPoint
  nextIdleDecisionAt: string
}

const IDLE_ROOMS: Array<{ roomId: string; state: AgentOpsVisibleState; weight: number }> = [
  { roomId: "common_room", state: "idle_social", weight: 22 },
  { roomId: "canteen", state: "idle_canteen", weight: 12 },
  { roomId: "games_room", state: "idle_games", weight: 10 },
  { roomId: "outdoor_fresh_air", state: "idle_outdoor", weight: 9 },
  { roomId: "toilets", state: "idle_toilet", weight: 4 },
  { roomId: "reception", state: "idle_wandering", weight: 6 },
]

export function chooseIdleBehaviour(
  layout: AgentOpsEstateLayout,
  agent: AgentOpsAgentState,
  now: string,
  occupancy: Record<string, number>
): AgentOpsIdleDecision {
  const seed = hash(`${agent.agentId}:${now.slice(0, 16)}`)
  const primaryFloor = getPrimaryUsableFloor(layout)
  const options = IDLE_ROOMS.map((option) => {
    const room = findRoom(layout, option.roomId)
    if (!room || ["locked", "retired", "under_construction"].includes(room.status)) {
      return { ...option, score: 0 }
    }
    const floor = findRoomFloor(layout, room.id)
    if (!isAssetBackedFloor(floor) || floor?.id !== primaryFloor?.id) {
      return { ...option, score: 0 }
    }
    const capacity = Math.max(1, room.capacity || roomVariant(room)?.capacity || 1)
    const crowdPenalty = Math.max(0, 1 - (occupancy[room.id] ?? 0) / capacity)
    return { ...option, score: option.weight * crowdPenalty }
  }).filter((option) => option.score > 0)

  const total = options.reduce((sum, option) => sum + option.score, 0)
  let pick = seed % Math.max(1, Math.floor(total))
  const selected =
    options.find((option) => {
      pick -= option.score
      return pick <= 0
    }) ?? options[0]

  const fallbackRoom =
    primaryFloor
      ? getFloorRooms(layout, primaryFloor.id).find(
          (entry) => !["locked", "retired", "under_construction"].includes(entry.status)
        )
      : null
  const room = findRoom(layout, selected?.roomId) ?? fallbackRoom
  const variant = room ? roomVariant(room) : null
  const anchors = variant?.idleAnchors?.length ? variant.idleAnchors : room?.idleAnchors
  const anchor = anchors?.[seed % anchors.length] ?? {
    x: (primaryFloor?.bounds.x ?? 0) + (primaryFloor?.bounds.width ?? 1840) / 2,
    y: (primaryFloor?.bounds.y ?? 0) + (primaryFloor?.bounds.height ?? 1180) / 2,
  }
  const nextMs = 18_000 + (seed % 34_000)

  return {
    visibleState: selected?.state ?? "idle_wandering",
    roomId: room?.id ?? "",
    position: anchor,
    nextIdleDecisionAt: new Date(new Date(now).getTime() + nextMs).toISOString(),
  }
}

function hash(value: string) {
  let result = 0
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) >>> 0
  }
  return result
}
