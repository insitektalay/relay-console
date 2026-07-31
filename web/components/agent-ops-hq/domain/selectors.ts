import type {
  AgentOpsEntityType,
  AgentOpsRenderSnapshot,
  AgentOpsSimulationState,
} from "./estate-types"
import { findFloor, getFloorRooms } from "./location-resolver"

export function toRenderSnapshot(state: AgentOpsSimulationState): AgentOpsRenderSnapshot {
  const floorAgents = Object.values(state.agents).filter((agent) => agent.floorId === state.activeFloorId)
  const renderAgents = state.mode === "mock" && state.debug.gapMinerPilotOnly
    ? selectGapMinerPilotAgents(floorAgents)
    : floorAgents
  return {
    layout: state.layout,
    activeBuildingId: state.activeBuildingId,
    activeFloorId: state.activeFloorId,
    rooms: getFloorRooms(state.layout, state.activeFloorId),
    agents: renderAgents,
    visualProfiles: state.visualProfiles,
    departments: state.departments,
    events: state.eventHistory,
    selectedEntityId: state.selectedEntityId,
    selectedEntityType: state.selectedEntityType,
    clock: state.clock,
    debug: state.debug,
  }
}

function selectGapMinerPilotAgents(agents: AgentOpsSimulationState["agents"][string][]) {
  const gapMinerAgents = agents
    .filter((agent) =>
      agent.currentAppId === "gapminer" ||
      agent.targetRoomId === "gapminer_office" ||
      (agent.roomId === "gapminer_office" && agent.realState !== "idle")
    )
    .slice(0, 3)
  const selected = new Set(gapMinerAgents.map((agent) => agent.agentId))
  const idleAgents = agents
    .filter((agent) => !selected.has(agent.agentId) && agent.realState === "idle")
    .slice(0, 3)
  const selectedAgents = [...gapMinerAgents, ...idleAgents]
  if (selectedAgents.length) return selectedAgents
  return agents.filter((agent) => agent.visibleState !== "offline_hidden").slice(0, 6)
}

export function searchAgentOpsEntities(
  state: AgentOpsSimulationState,
  query: string
): Array<{ id: string; type: AgentOpsEntityType; label: string; meta: string }> {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const matches: Array<{ id: string; type: AgentOpsEntityType; label: string; meta: string }> = []
  const push = (entry: { id: string; type: AgentOpsEntityType; label: string; meta: string }) => {
    if (`${entry.label} ${entry.meta}`.toLowerCase().includes(normalized)) matches.push(entry)
  }

  for (const profile of Object.values(state.visualProfiles)) {
    push({ id: profile.agentId, type: "agent", label: profile.displayName, meta: profile.roleLabel })
  }
  for (const building of state.layout.buildings) {
    for (const floor of building.floors) {
      for (const zone of floor.zones) {
        for (const room of zone.rooms) {
          push({ id: room.id, type: "room", label: room.label, meta: `${floor.label} ${zone.label} ${room.status}` })
        }
      }
    }
  }
  for (const unit of state.layout.businessUnits) push({ id: unit.id, type: "business_unit", label: unit.label, meta: unit.status })
  for (const app of state.layout.applications) push({ id: app.appId, type: "application", label: app.label, meta: `${app.businessUnitId} ${app.outputTypes.join(" ")}` })
  for (const site of state.layout.websites) push({ id: site.id, type: "website", label: site.label, meta: `${site.url ?? ""} ${site.businessUnitId}` })
  for (const output of state.layout.outputTypes) push({ id: output.id, type: "output_type", label: output.label, meta: output.businessUnitId })
  for (const workflow of state.layout.workflows) push({ id: workflow.id, type: "workflow", label: workflow.label, meta: workflow.appIds.join(" ") })
  return matches.slice(0, 40)
}

export function getSelectedEntity(state: AgentOpsSimulationState) {
  const { selectedEntityId, selectedEntityType } = state
  if (!selectedEntityId || !selectedEntityType) return null
  if (selectedEntityType === "agent") {
    return {
      type: selectedEntityType,
      state: state.agents[selectedEntityId],
      profile: state.visualProfiles[selectedEntityId],
    }
  }
  if (selectedEntityType === "room") {
    for (const building of state.layout.buildings) {
      for (const floor of building.floors) {
        for (const zone of floor.zones) {
          const room = zone.rooms.find((entry) => entry.id === selectedEntityId)
          if (room) return { type: selectedEntityType, room, zone, floor, building }
        }
      }
    }
  }
  const collections = {
    business_unit: state.layout.businessUnits,
    application: state.layout.applications,
    website: state.layout.websites,
    output_type: state.layout.outputTypes,
    workflow: state.layout.workflows,
  } as const
  const collection = collections[selectedEntityType as keyof typeof collections]
  return collection
    ? {
        type: selectedEntityType,
        entity: collection.find(
          (entry) => getEntityId(entry) === selectedEntityId
        ),
      }
    : null
}

export function getActiveFloorLabel(state: AgentOpsSimulationState) {
  return findFloor(state.layout, state.activeFloorId)?.label ?? "Unknown floor"
}

function getEntityId(entry: { id?: string; appId?: string }) {
  return entry.id ?? entry.appId
}
