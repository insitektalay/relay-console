import type { Agent, Department } from "@clawchat/contracts"
import type {
  AgentOpsAgentState,
  AgentOpsCompassDirection,
  AgentOpsDepartmentState,
  AgentOpsEstateLayout,
  AgentOpsEvent,
  AgentOpsPoint,
  AgentOpsRealState,
  AgentOpsSimulationAction,
  AgentOpsSimulationState,
  AgentOpsVisibleState,
  AgentOpsWorkFacing,
  AgentVisualProfile,
} from "./estate-types"
import { roomVariant } from "./estate-types"
import { chooseIdleBehaviour } from "./idle-behaviour"
import {
  findRoom,
  findRoomFloor,
  getFloorRooms,
  getAllRooms,
  getDefaultBuilding,
  getDefaultFloor,
  getPrimaryUsableFloor,
  isAssetBackedFloor,
  resolveAgentHomeRoom,
  resolveEventLocation,
  type AgentOpsResolvedLocation,
} from "./location-resolver"
import {
  buildIdlePath,
  buildIdleRoamPath,
  buildPath,
  getIdleWaypointPositions,
  stepAlongPath,
} from "./pathing"

const AGENT_WALK_SPEED_PIXELS_PER_SECOND = 75

export function createInitialAgentOpsState(input: {
  layout: AgentOpsEstateLayout
  agents: Agent[]
  departments: Department[]
  workspaceId: string
  now?: string
}): AgentOpsSimulationState {
  const now = input.now ?? new Date().toISOString()
  const building = getDefaultBuilding(input.layout)
  const floor = getDefaultFloor(input.layout)
  const roster = buildAgentRoster(
    input.layout,
    input.agents,
    input.workspaceId,
    now
  )

  return {
    layout: input.layout,
    activeBuildingId: building?.id ?? "agentops_tower",
    activeFloorId: floor?.id ?? "floor_01_operations",
    floorPinnedByUser: false,
    mode: "live",
    clock: now,
    agents: roster.agents,
    visualProfiles: roster.visualProfiles,
    departments: buildDepartmentStates(input.layout),
    eventHistory: [],
    selectedEntityId: null,
    selectedEntityType: null,
    searchQuery: "",
    debug: {
      showBounds: false,
      showWaypoints: false,
      showPaths: false,
      speed: 1,
      gapMinerPilotOnly: true,
    },
  }
}

export function agentOpsSimulationReducer(
  state: AgentOpsSimulationState,
  action: AgentOpsSimulationAction
): AgentOpsSimulationState {
  switch (action.type) {
    case "ingest_events":
      return action.events.reduce(
        (next, event) => applyEvent(next, event, action.now),
        { ...state, clock: action.now }
      )
    case "tick":
      return tickState(state, action.now)
    case "set_layout":
      return {
        ...state,
        layout: action.layout,
        departments: buildDepartmentStates(action.layout),
      }
    case "sync_roster": {
      const roster = buildAgentRoster(
        state.layout,
        action.agents,
        action.workspaceId,
        action.now
      )
      const agents = Object.fromEntries(
        Object.entries(roster.agents).map(([agentId, agent]) => {
          const existing = state.agents[agentId]
          return [
            agentId,
            existing
              ? {
                  ...agent,
                  ...existing,
                  buildingId: existing.buildingId || agent.buildingId,
                  floorId: existing.floorId || agent.floorId,
                }
              : agent,
          ]
        })
      )
      return {
        ...state,
        agents,
        visualProfiles: roster.visualProfiles,
        departments: buildDepartmentStates(state.layout),
        selectedEntityId:
          state.selectedEntityType === "agent" &&
          state.selectedEntityId &&
          !agents[state.selectedEntityId]
            ? null
            : state.selectedEntityId,
        selectedEntityType:
          state.selectedEntityType === "agent" &&
          state.selectedEntityId &&
          !agents[state.selectedEntityId]
            ? null
            : state.selectedEntityType,
      }
    }
    case "set_floor":
      return {
        ...state,
        activeBuildingId: action.buildingId,
        activeFloorId: action.floorId,
        floorPinnedByUser: true,
      }
    case "set_mode":
      return { ...state, mode: action.mode }
    case "select":
      return {
        ...state,
        selectedEntityType: action.entityType,
        selectedEntityId: action.entityId,
      }
    case "set_search":
      return { ...state, searchQuery: action.query }
    case "set_debug":
      return { ...state, debug: { ...state.debug, ...action.debug } }
    default:
      return state
  }
}

function buildAgentRoster(
  layout: AgentOpsEstateLayout,
  sourceAgents: Agent[],
  workspaceId: string,
  now: string
) {
  const building = getDefaultBuilding(layout)
  const floor = getDefaultFloor(layout)
  const visualProfiles: Record<string, AgentVisualProfile> = {}
  const agents: Record<string, AgentOpsAgentState> = {}
  const idlePathPositions = getIdleWaypointPositions(layout)

  sourceAgents.forEach((agent, index) => {
    const room = resolveAgentHomeRoom(layout, agent)
    const idlePathPosition =
      idlePathPositions[index % Math.max(1, idlePathPositions.length)]
    const location = idlePathPosition
      ? {
          buildingId: building?.id ?? "agentops_tower",
          floorId: floor?.id ?? "floor_01_operations",
          zoneId: "",
          roomId: "",
          position: idlePathPosition,
          reason: "idle path",
        }
      : room
        ? resolveEventLocation(
            layout,
            {
              id: `initial:${agent.id}`,
              workspaceId,
              type: "agent.idle",
              source: "simulation",
              severity: "info",
              timestamp: now,
              title: "Initial placement",
              agentId: agent.id,
              departmentId: agent.departmentId,
              roomId: room.id,
            },
            { agent }
          )
        : resolvePrimaryIdleLocation(layout, agent.id)
    agents[agent.id] = {
      agentId: agent.id,
      realState: agent.status === "off_duty" ? "offline" : "idle",
      visibleState:
        agent.status === "off_duty" ? "offline_hidden" : "idle_wandering",
      buildingId: location.buildingId,
      floorId: location.floorId,
      zoneId: location.zoneId,
      roomId: location.roomId || undefined,
      position: idlePathPosition
        ? location.position
        : offsetPoint(location.position, index),
      direction: "down",
      path: [],
      lastRealEventAt: now,
      visibleStateStartedAt: now,
      nextIdleDecisionAt: now,
    }
    visualProfiles[agent.id] = {
      agentId: agent.id,
      spriteId: "office_worker_01",
      color: agentColor(index),
      displayName: agent.name,
      roleLabel: agent.role,
      scale: 1,
      idlePreferences: [
        "common_room",
        "canteen",
        "games_room",
        "outdoor_fresh_air",
      ],
    }
  })

  return { agents, visualProfiles }
}

export function realStateFromEvent(event: AgentOpsEvent): AgentOpsRealState {
  switch (event.type) {
    case "agent.online":
      return "idle"
    case "agent.offline":
      return "offline"
    case "agent.task.queued":
      return "queued"
    case "agent.task.started":
    case "agent.task.progress":
    case "workflow.started":
    case "output.started":
      return "working"
    case "agent.thinking":
      return "thinking"
    case "agent.tool.called":
      return "tooling"
    case "agent.waiting_for_approval":
      return "waiting_for_approval"
    case "agent.error":
      return "error"
    case "agent.task.completed":
    case "output.completed":
    case "workflow.completed":
      return "completed"
    case "agent.dispatch.cancelled":
      return "cancelled"
    default:
      return "idle"
  }
}

function applyEvent(
  state: AgentOpsSimulationState,
  event: AgentOpsEvent,
  now: string
): AgentOpsSimulationState {
  const eventHistory = dedupeEventHistory([event, ...state.eventHistory])
  const departments = updateDepartmentState(state.departments, event)

  if (!event.agentId) {
    return { ...state, eventHistory, departments }
  }

  const existing = state.agents[event.agentId]
  if (!existing) return { ...state, eventHistory, departments }

  if (event.type === "agent.idle") {
    const location = liveSafeIdleLocation(state.layout, existing)
    const shouldMoveToLocation = existing.floorId !== location.floorId
    return {
      ...state,
      eventHistory,
      departments,
      ...autoActiveFloor(state, location),
      agents: {
        ...state.agents,
        [event.agentId]: {
          ...existing,
          realState: "idle",
          visibleState: "returning_to_idle",
          buildingId: location.buildingId,
          floorId: location.floorId,
          zoneId: location.zoneId,
          roomId: undefined,
          position: shouldMoveToLocation
            ? location.position
            : existing.position,
          targetRoomId: undefined,
          targetPosition: undefined,
          path: [],
          currentTaskId: null,
          currentThreadId: event.threadId ?? null,
          currentDispatchId: null,
          currentApprovalId: null,
          currentAppId: null,
          currentWorkflowId: null,
          liveConfidence:
            typeof event.payload?.confidence === "string"
              ? event.payload.confidence
              : (existing.liveConfidence ?? null),
          liveSource:
            typeof event.payload?.source === "string"
              ? event.payload.source
              : event.source,
          liveReason: event.summary ?? event.title,
          liveExpiresAt:
            typeof event.payload?.expiresAt === "string"
              ? event.payload.expiresAt
              : null,
          lastRealEventAt: event.timestamp,
          visibleStateStartedAt: now,
          nextIdleDecisionAt: now,
        },
      },
    }
  }

  const resolvedLocation = resolveEventLocation(state.layout, event)
  const realState = realStateFromEvent(event)
  const location = liveSafeLocation(
    state.layout,
    resolvedLocation,
    realState,
    existing
  )
  const visibleState = visibleStateFor(realState, event)
  const targetRoomId = location.roomId
  const workTarget = chooseWorkTarget(
    state,
    event.agentId,
    targetRoomId,
    location.position
  )
  const path = buildPath(
    state.layout,
    existing.position,
    workTarget.position,
    existing.roomId,
    targetRoomId
  )
  const shouldPlaceAtWorkstation =
    event.payload?.initialPlacement === true &&
    ["queued", "working", "thinking", "tooling"].includes(realState)
  const sameRoomAtTarget =
    existing.roomId === targetRoomId &&
    pointDistance(existing.position, workTarget.position) <= 4
  const effectivePath = shouldPlaceAtWorkstation || sameRoomAtTarget ? [] : path
  const alreadyAtTarget =
    shouldPlaceAtWorkstation ||
    sameRoomAtTarget ||
    (!effectivePath.length &&
      pointDistance(existing.position, workTarget.position) <= 4)
  const arrivedWorkState =
    alreadyAtTarget &&
    ["queued", "working", "thinking", "tooling"].includes(realState)

  return {
    ...state,
    eventHistory,
    departments,
    ...autoActiveFloor(state, location),
    agents: {
      ...state.agents,
      [event.agentId]: {
        ...existing,
        realState,
        visibleState: arrivedWorkState
          ? visibleState === "meeting"
            ? "meeting"
            : "desk_work"
          : visibleState,
        buildingId: location.buildingId,
        floorId: location.floorId,
        zoneId: location.zoneId,
        roomId: arrivedWorkState ? targetRoomId : existing.roomId,
        position: shouldPlaceAtWorkstation
          ? workTarget.position
          : existing.position,
        targetRoomId: arrivedWorkState ? undefined : targetRoomId,
        targetPosition: arrivedWorkState ? undefined : workTarget.position,
        path: effectivePath,
        direction:
          directionFromPoints(
            existing.position,
            effectivePath[1] ?? effectivePath[0] ?? workTarget.position
          ) ?? existing.direction,
        facing: workTarget.facing ?? existing.facing,
        assignedWorkstationId:
          workTarget.workstationId ?? existing.assignedWorkstationId,
        currentTaskId: event.taskId ?? existing.currentTaskId,
        currentThreadId: event.threadId ?? existing.currentThreadId,
        currentDispatchId: event.dispatchId ?? existing.currentDispatchId,
        currentApprovalId: event.approvalId ?? existing.currentApprovalId,
        currentAppId: event.appId ?? existing.currentAppId,
        currentWorkflowId: event.workflowId ?? existing.currentWorkflowId,
        liveConfidence:
          typeof event.payload?.confidence === "string"
            ? event.payload.confidence
            : (existing.liveConfidence ?? null),
        liveSource:
          typeof event.payload?.source === "string"
            ? event.payload.source
            : event.source,
        liveReason: event.summary ?? event.title,
        liveExpiresAt:
          typeof event.payload?.expiresAt === "string"
            ? event.payload.expiresAt
            : null,
        lastRealEventAt: event.timestamp,
        visibleStateStartedAt: now,
      },
    },
  }
}

function dedupeEventHistory(events: AgentOpsEvent[]) {
  const seen = new Set<string>()
  return events
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .filter((entry) => {
      if (seen.has(entry.id)) return false
      seen.add(entry.id)
      return true
    })
    .slice(0, 180)
}

function autoActiveFloor(
  state: AgentOpsSimulationState,
  location: AgentOpsResolvedLocation
) {
  if (state.floorPinnedByUser) return {}
  return {
    activeBuildingId: location.buildingId,
    activeFloorId: location.floorId,
  }
}

function liveSafeLocation(
  layout: AgentOpsEstateLayout,
  location: AgentOpsResolvedLocation,
  realState: AgentOpsRealState,
  agent: AgentOpsAgentState
): AgentOpsResolvedLocation {
  const floor = findRoomFloor(layout, location.roomId)
  if (isAssetBackedFloor(floor)) return location
  if (["idle", "completed", "cancelled"].includes(realState)) {
    return liveSafeIdleLocation(layout, agent)
  }
  return resolvePrimaryFloorWorkLocation(layout, "asset-backed floor fallback")
}

function liveSafeIdleLocation(
  layout: AgentOpsEstateLayout,
  agent: AgentOpsAgentState
): AgentOpsResolvedLocation {
  return resolvePrimaryIdleLocation(layout, agent.agentId)
}

function resolvePrimaryIdleLocation(
  layout: AgentOpsEstateLayout,
  agentId: string
): AgentOpsResolvedLocation {
  const primaryFloor = getPrimaryUsableFloor(layout)
  const building = primaryFloor
    ? layout.buildings.find((entry) =>
        entry.floors.some((floor) => floor.id === primaryFloor.id)
      )
    : getDefaultBuilding(layout)
  const idlePositions = getIdleWaypointPositions(layout)
  const position = idlePositions[
    Math.abs(hashString(agentId)) % Math.max(1, idlePositions.length)
  ] ?? {
    x: (primaryFloor?.bounds.x ?? 0) + (primaryFloor?.bounds.width ?? 1840) / 2,
    y:
      (primaryFloor?.bounds.y ?? 0) + (primaryFloor?.bounds.height ?? 1180) / 2,
  }
  return {
    buildingId: building?.id ?? "agentops_tower",
    floorId: primaryFloor?.id ?? "floor_01_operations",
    zoneId: "",
    roomId: "",
    position,
    reason: "asset-backed idle floor",
  }
}

function resolvePrimaryFloorWorkLocation(
  layout: AgentOpsEstateLayout,
  reason: string
): AgentOpsResolvedLocation {
  const primaryFloor = getPrimaryUsableFloor(layout)
  const building = primaryFloor
    ? layout.buildings.find((entry) =>
        entry.floors.some((floor) => floor.id === primaryFloor.id)
      )
    : getDefaultBuilding(layout)
  const room =
    findRoom(layout, "agent_monitoring_room") ??
    (primaryFloor
      ? getFloorRooms(layout, primaryFloor.id).find(
          (entry) =>
            !["locked", "retired", "under_construction"].includes(entry.status)
        )
      : null)
  const variant = room ? roomVariant(room) : null
  const position = variant?.workstations[0]?.position ??
    variant?.idleAnchors[0] ??
    room?.idleAnchors[0] ?? {
      x:
        (primaryFloor?.bounds.x ?? 0) +
        (primaryFloor?.bounds.width ?? 1840) / 2,
      y:
        (primaryFloor?.bounds.y ?? 0) +
        (primaryFloor?.bounds.height ?? 1180) / 2,
    }
  return {
    buildingId: building?.id ?? "agentops_tower",
    floorId: primaryFloor?.id ?? "floor_01_operations",
    zoneId: room?.zoneId ?? "",
    roomId: room?.id ?? "",
    position,
    reason,
  }
}

function tickState(
  state: AgentOpsSimulationState,
  now: string
): AgentOpsSimulationState {
  const previousTime = new Date(state.clock).getTime()
  const nextTime = new Date(now).getTime()
  const deltaMs = Number.isFinite(previousTime)
    ? Math.max(16, Math.min(250, nextTime - previousTime))
    : 50
  const occupancy = roomOccupancy(state)
  const agents = Object.fromEntries(
    Object.entries(state.agents).map(([agentId, agent]) => {
      const next = { ...agent }
      if (next.path.length) {
        const before = next.position
        const stepped = stepAlongPath(
          next.path,
          next.position,
          deltaMs,
          AGENT_WALK_SPEED_PIXELS_PER_SECOND * state.debug.speed
        )
        next.position = stepped.position
        next.path = stepped.path
        next.direction =
          directionFromPoints(before, stepped.position) ?? next.direction
        if (!next.path.length && next.targetRoomId) {
          const reachedTarget =
            !next.targetPosition ||
            pointDistance(next.position, next.targetPosition) <= 4
          if (reachedTarget) {
            const room = findRoom(state.layout, next.targetRoomId)
            next.roomId = next.targetRoomId
            next.zoneId = room?.zoneId ?? next.zoneId
            next.targetPosition = undefined
            const workstation = room
              ? roomVariant(room).workstations.find(
                  (entry) => entry.id === next.assignedWorkstationId
                )
              : null
            next.facing = workstation?.facing ?? next.facing
            next.direction = directionFromFacing(next.facing) ?? next.direction
            if (
              ["queued", "working", "thinking", "tooling"].includes(
                next.realState
              )
            ) {
              next.visibleState =
                next.visibleState === "meeting" ? "meeting" : "desk_work"
            }
          }
        }
      }

      if (next.realState === "completed" || next.realState === "cancelled") {
        const elapsed =
          nextTime - new Date(next.visibleStateStartedAt).getTime()
        if (elapsed > 4200) {
          next.realState = "idle"
          next.visibleState = "returning_to_idle"
          next.nextIdleDecisionAt = now
        }
      }

      if (
        next.realState === "idle" &&
        !next.path.length &&
        nextTime >= new Date(next.nextIdleDecisionAt).getTime()
      ) {
        const idleRoamPath = buildIdleRoamPath(
          state.layout,
          next.position,
          `${agentId}:${now}`
        )
        if (idleRoamPath.length) {
          next.visibleState = "idle_wandering"
          next.targetRoomId = undefined
          next.targetPosition = idleRoamPath[idleRoamPath.length - 1]
          next.path = idleRoamPath
          next.direction =
            directionFromPoints(
              next.position,
              next.path[1] ?? next.path[0] ?? next.position
            ) ?? next.direction
          next.nextIdleDecisionAt = new Date(nextTime + 500).toISOString()
          return [agentId, next]
        }
        const decision = chooseIdleBehaviour(state.layout, next, now, occupancy)
        const room = findRoom(state.layout, decision.roomId)
        const roomFloor = room ? findRoomFloor(state.layout, room.id) : null
        const safeIdleDecision =
          roomFloor && !isAssetBackedFloor(roomFloor)
            ? liveSafeIdleLocation(state.layout, next)
            : null
        const targetPosition = safeIdleDecision?.position ?? decision.position
        const targetRoomId = safeIdleDecision ? undefined : decision.roomId
        next.visibleState = safeIdleDecision
          ? "idle_wandering"
          : decision.visibleState
        next.targetRoomId = targetRoomId
        next.targetPosition = targetPosition
        next.path = buildIdlePath(
          state.layout,
          next.position,
          targetPosition,
          next.roomId,
          targetRoomId
        )
        next.direction =
          directionFromPoints(
            next.position,
            next.path[1] ?? next.path[0] ?? targetPosition
          ) ?? next.direction
        next.nextIdleDecisionAt = decision.nextIdleDecisionAt
        if (safeIdleDecision) {
          next.buildingId = safeIdleDecision.buildingId
          next.floorId = safeIdleDecision.floorId
          next.zoneId = safeIdleDecision.zoneId
          next.roomId = undefined
        } else if (room && roomFloor) {
          next.buildingId =
            state.layout.buildings.find((building) =>
              building.floors.some((floor) => floor.id === roomFloor.id)
            )?.id ?? next.buildingId
          next.floorId = roomFloor.id
          next.zoneId = room.zoneId
        }
      }

      return [agentId, next]
    })
  )
  return { ...state, clock: now, agents }
}

function visibleStateFor(
  realState: AgentOpsRealState,
  event: AgentOpsEvent
): AgentOpsVisibleState {
  if (realState === "offline") return "offline_hidden"
  if (realState === "error") return "error_alert"
  if (realState === "waiting_for_approval") return "approval_wait"
  if (realState === "completed") return "completion_celebration"
  if (realState === "cancelled") return "returning_to_idle"
  if (
    event.type === "agent.task.progress" &&
    event.summary?.toLowerCase().includes("meeting")
  ) {
    return "meeting"
  }
  if (["queued", "working", "thinking", "tooling"].includes(realState)) {
    return "walking_to_work"
  }
  return "idle_wandering"
}

function buildDepartmentStates(layout: AgentOpsEstateLayout) {
  const states: Record<string, AgentOpsDepartmentState> = {}
  for (const room of getAllRooms(layout)) {
    const departmentId = room.departmentId ?? room.id
    if (!states[departmentId]) {
      states[departmentId] = {
        departmentId,
        roomIds: [],
        status:
          room.status === "active"
            ? "active"
            : room.status === "idle"
              ? "idle"
              : "inactive",
        activeAgentIds: [],
        activeTaskIds: [],
        intensity: room.status === "active" ? 0.7 : 0,
      }
    }
    states[departmentId].roomIds.push(room.id)
  }
  return states
}

function updateDepartmentState(
  departments: Record<string, AgentOpsDepartmentState>,
  event: AgentOpsEvent
) {
  const departmentId = event.departmentId ?? event.roomId
  if (!departmentId) return departments
  const current = departments[departmentId] ?? {
    departmentId,
    roomIds: event.roomId ? [event.roomId] : [],
    status: "inactive",
    activeAgentIds: [],
    activeTaskIds: [],
    intensity: 0,
  }
  const status: AgentOpsDepartmentState["status"] =
    event.type === "agent.error"
      ? "error"
      : event.type === "agent.waiting_for_approval"
        ? "approval"
        : event.type === "revenue.event"
          ? "revenue"
          : event.type === "agent.task.completed"
            ? "idle"
            : "active"
  return {
    ...departments,
    [departmentId]: {
      ...current,
      status,
      activeAgentIds: event.agentId
        ? Array.from(new Set([...current.activeAgentIds, event.agentId]))
        : current.activeAgentIds,
      activeTaskIds: event.taskId
        ? Array.from(new Set([...current.activeTaskIds, event.taskId]))
        : current.activeTaskIds,
      lastEventAt: event.timestamp,
      intensity: status === "error" ? 1 : status === "approval" ? 0.9 : 0.72,
    },
  }
}

function roomOccupancy(state: AgentOpsSimulationState) {
  return Object.values(state.agents).reduce<Record<string, number>>(
    (acc, agent) => {
      if (agent.roomId) acc[agent.roomId] = (acc[agent.roomId] ?? 0) + 1
      return acc
    },
    {}
  )
}

function chooseWorkTarget(
  state: AgentOpsSimulationState,
  agentId: string,
  roomId: string,
  fallback: AgentOpsPoint
): {
  position: AgentOpsPoint
  workstationId?: string | null
  facing?: AgentOpsWorkFacing
} {
  const room = findRoom(state.layout, roomId)
  const workstations = room ? roomVariant(room).workstations : []
  if (!workstations.length) return { position: fallback }
  const existing = state.agents[agentId]
  const existingWorkstation = workstations.find(
    (entry) => entry.id === existing?.assignedWorkstationId
  )
  if (
    existingWorkstation &&
    (existing?.roomId === roomId || existing?.targetRoomId === roomId)
  ) {
    return {
      position: existingWorkstation.position,
      workstationId: existingWorkstation.id,
      facing: existingWorkstation.facing,
    }
  }
  const occupied = new Set(
    Object.values(state.agents)
      .filter(
        (agent) =>
          agent.agentId !== agentId &&
          (agent.roomId === roomId || agent.targetRoomId === roomId)
      )
      .map((agent) => agent.assignedWorkstationId)
      .filter(Boolean)
  )
  const workstation =
    workstations.find((entry) => !occupied.has(entry.id)) ??
    workstations[Math.abs(hashString(agentId)) % workstations.length]
  return {
    position: workstation.position,
    workstationId: workstation.id,
    facing: workstation.facing,
  }
}

function directionFromFacing(
  facing?: AgentOpsWorkFacing
): AgentOpsCompassDirection | undefined {
  if (facing === "north") return "up"
  if (facing === "south") return "down"
  if (facing === "east") return "right"
  if (facing === "west") return "left"
  return undefined
}

function directionFromPoints(
  from: AgentOpsPoint,
  to: AgentOpsPoint
): AgentOpsCompassDirection | undefined {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return undefined
  const horizontal = Math.abs(dx) > 0.5 ? (dx > 0 ? "right" : "left") : ""
  const vertical = Math.abs(dy) > 0.5 ? (dy > 0 ? "down" : "up") : ""
  if (horizontal && vertical)
    return `${vertical}-${horizontal}` as AgentOpsCompassDirection
  return (horizontal || vertical) as AgentOpsCompassDirection
}

function pointDistance(a: AgentOpsPoint, b: AgentOpsPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return hash
}

function offsetPoint(point: { x: number; y: number }, index: number) {
  return {
    x: point.x + ((index % 4) - 1.5) * 10,
    y: point.y + (Math.floor(index / 4) % 3) * 9,
  }
}

function agentColor(index: number) {
  return ["#64d78d", "#508dd7", "#9b8ad7", "#55c6c7", "#d7b95e", "#d75e72"][
    index % 6
  ]
}
