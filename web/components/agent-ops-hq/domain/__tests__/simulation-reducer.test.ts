import test from "node:test"
import assert from "node:assert/strict"
import type { Agent } from "@clawchat/contracts"
import { DEFAULT_AGENTOPS_LAYOUT } from "../default-estate-layout"
import { findRoom } from "../location-resolver"
import { cloneAgentOpsLayout } from "../layout-editor"
import { roomVariant } from "../estate-types"
import {
  agentOpsSimulationReducer,
  createInitialAgentOpsState,
} from "../simulation-reducer"

const agent = {
  id: "agent-1",
  name: "YouTube Agent",
  role: "Strategist",
  status: "active",
  capabilities: [],
  workingHoursMode: "scheduled",
  timezone: "UTC",
  tasksCompletedToday: 0,
  successRate: 0,
  avgCompletionMinutes: 0,
  totalMinutesWorked: 0,
  budgetUsed: 0,
  createdAt: "2026-05-14T00:00:00.000Z",
  updatedAt: "2026-05-14T00:00:00.000Z",
} as Agent

test("work events override idle state and target mapped rooms", () => {
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents: [agent],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })
  const next = agentOpsSimulationReducer(state, {
    type: "ingest_events",
    now: "2026-05-14T12:00:01.000Z",
    events: [
      {
        id: "event-1",
        type: "agent.task.started",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:01.000Z",
        source: "mock",
        agentId: "agent-1",
        appId: "ai_tube_watch",
        severity: "info",
        title: "Started",
      },
    ],
  })
  assert.equal(next.agents["agent-1"].realState, "working")
  assert.equal(next.agents["agent-1"].targetRoomId, "youtube_department")
  assert.equal(next.agents["agent-1"].visibleState, "walking_to_work")
})

test("duplicate live-state events are stored once in history", () => {
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents: [agent],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })
  const event = {
    id: "live-state:agent-1:working:runtime_dispatch:dispatch-1::::2026-06-04T13:00:01.164Z",
    type: "agent.task.started" as const,
    workspaceId: "workspace-1",
    timestamp: "2026-06-04T13:00:01.164Z",
    source: "openclaw" as const,
    agentId: "agent-1",
    appId: "ai_tube_watch",
    severity: "info" as const,
    title: "Working",
  }

  const first = agentOpsSimulationReducer(state, {
    type: "ingest_events",
    now: "2026-06-04T13:00:02.000Z",
    events: [event],
  })
  const second = agentOpsSimulationReducer(first, {
    type: "ingest_events",
    now: "2026-06-04T13:00:03.000Z",
    events: [event],
  })

  assert.equal(
    second.eventHistory.filter((entry) => entry.id === event.id).length,
    1
  )
})

test("completion events enter a terminal visible animation", () => {
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents: [agent],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })
  const next = agentOpsSimulationReducer(state, {
    type: "ingest_events",
    now: "2026-05-14T12:00:01.000Z",
    events: [
      {
        id: "event-2",
        type: "agent.task.completed",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:01.000Z",
        source: "mock",
        agentId: "agent-1",
        appId: "gapminer",
        severity: "success",
        title: "Completed",
      },
    ],
  })
  assert.equal(next.agents["agent-1"].realState, "completed")
  assert.equal(next.agents["agent-1"].visibleState, "completion_celebration")
})

test("explicit live idle events return agents to idle behaviour", () => {
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents: [agent],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })
  const working = agentOpsSimulationReducer(state, {
    type: "ingest_events",
    now: "2026-05-14T12:00:01.000Z",
    events: [
      {
        id: "event-work",
        type: "agent.task.started",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:01.000Z",
        source: "clawchat",
        agentId: "agent-1",
        roomId: "gapminer_office",
        severity: "info",
        title: "Started",
      },
    ],
  })
  const idle = agentOpsSimulationReducer(working, {
    type: "ingest_events",
    now: "2026-05-14T12:00:02.000Z",
    events: [
      {
        id: "event-idle",
        type: "agent.idle",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:02.000Z",
        source: "clawchat",
        agentId: "agent-1",
        severity: "info",
        title: "Idle",
      },
    ],
  })
  assert.equal(idle.agents["agent-1"].realState, "idle")
  assert.equal(idle.agents["agent-1"].visibleState, "returning_to_idle")
  assert.equal(idle.agents["agent-1"].roomId, undefined)
  assert.equal(idle.agents["agent-1"].targetRoomId, undefined)
  assert.equal(idle.agents["agent-1"].currentDispatchId, null)
})

test("multiple agents targeting one work room receive different workstation anchors", () => {
  const agentTwo = {
    ...agent,
    id: "agent-2",
    name: "GapMiner Agent 2",
  } as Agent
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents: [agent, agentTwo],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })
  const next = agentOpsSimulationReducer(state, {
    type: "ingest_events",
    now: "2026-05-14T12:00:01.000Z",
    events: [
      {
        id: "gap-1",
        type: "agent.task.started",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:01.000Z",
        source: "mock",
        agentId: "agent-1",
        appId: "gapminer",
        roomId: "gapminer_office",
        severity: "info",
        title: "Started",
      },
      {
        id: "gap-2",
        type: "agent.task.started",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:01.200Z",
        source: "mock",
        agentId: "agent-2",
        appId: "gapminer",
        roomId: "gapminer_office",
        severity: "info",
        title: "Started",
      },
    ],
  })
  assert.equal(next.agents["agent-1"].targetRoomId, "gapminer_office")
  assert.equal(next.agents["agent-2"].targetRoomId, "gapminer_office")
  assert.notEqual(
    next.agents["agent-1"].assignedWorkstationId,
    next.agents["agent-2"].assignedWorkstationId
  )
})

test("work events at an occupied workstation enter desk work immediately", () => {
  const room = findRoom(DEFAULT_AGENTOPS_LAYOUT, "gapminer_office")
  assert.ok(room)
  const workstation = roomVariant(room).workstations[0]
  assert.ok(workstation)
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents: [agent],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })
  state.agents["agent-1"] = {
    ...state.agents["agent-1"],
    roomId: "gapminer_office",
    position: workstation.position,
    assignedWorkstationId: workstation.id,
  }
  const next = agentOpsSimulationReducer(state, {
    type: "ingest_events",
    now: "2026-05-14T12:00:01.000Z",
    events: [
      {
        id: "gap-already-there",
        type: "agent.task.started",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:01.000Z",
        source: "mock",
        agentId: "agent-1",
        appId: "gapminer",
        roomId: "gapminer_office",
        severity: "info",
        title: "Started",
      },
    ],
  })
  assert.equal(next.agents["agent-1"].visibleState, "desk_work")
  assert.equal(next.agents["agent-1"].targetRoomId, undefined)
  assert.equal(next.agents["agent-1"].path.length, 0)
})

test("initial live work placement starts agents at their office desks", () => {
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents: [agent],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })
  const next = agentOpsSimulationReducer(state, {
    type: "ingest_events",
    now: "2026-05-14T12:00:01.000Z",
    events: [
      {
        id: "live-initial-work",
        type: "agent.task.started",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:01.000Z",
        source: "clawchat",
        agentId: "agent-1",
        roomId: "gapminer_office",
        severity: "info",
        title: "Started",
        payload: { initialPlacement: true },
      },
    ],
  })
  const room = findRoom(DEFAULT_AGENTOPS_LAYOUT, "gapminer_office")
  assert.ok(room)
  const workstation = roomVariant(room).workstations.find(
    (entry) => entry.id === next.agents["agent-1"].assignedWorkstationId
  )
  assert.ok(workstation)
  assert.equal(next.agents["agent-1"].visibleState, "desk_work")
  assert.equal(next.agents["agent-1"].roomId, "gapminer_office")
  assert.deepEqual(next.agents["agent-1"].position, workstation.position)
  assert.equal(next.agents["agent-1"].path.length, 0)
})

test("initial idle agents are placed on calibrated idle path network when present", () => {
  const layout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  const floor = layout.buildings
    .flatMap((building) => building.floors)
    .find((entry) => entry.id === "floor_01_operations")
  assert.ok(floor)
  floor.pathNetwork = {
    waypoints: [
      { id: "a", position: { x: 100, y: 100 }, tags: ["idle"] },
      { id: "b", position: { x: 200, y: 100 }, tags: ["idle"] },
    ],
    edges: [{ id: "ab", from: "a", to: "b", tags: ["idle"] }],
  }
  const state = createInitialAgentOpsState({
    layout,
    agents: [agent],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })
  assert.deepEqual(state.agents["agent-1"].position, { x: 100, y: 100 })
  assert.equal(state.agents["agent-1"].roomId, undefined)
})

test("live events for assetless lobby rooms are remapped to the operations floor", () => {
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents: [agent],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })

  const next = agentOpsSimulationReducer(state, {
    type: "ingest_events",
    now: "2026-05-14T12:00:01.000Z",
    events: [
      {
        id: "event-lobby",
        type: "agent.task.started",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:01.000Z",
        source: "clawchat",
        agentId: "agent-1",
        roomId: "common_room",
        severity: "info",
        title: "Started",
      },
    ],
  })

  assert.equal(next.activeFloorId, "floor_01_operations")
  assert.equal(next.agents["agent-1"].floorId, "floor_01_operations")
  assert.notEqual(next.agents["agent-1"].targetRoomId, "common_room")
})

test("manual floor selection is not overridden by live-agent routing", () => {
  const state = createInitialAgentOpsState({
    layout: DEFAULT_AGENTOPS_LAYOUT,
    agents: [agent],
    departments: [],
    workspaceId: "workspace-1",
    now: "2026-05-14T12:00:00.000Z",
  })
  const pinned = agentOpsSimulationReducer(state, {
    type: "set_floor",
    buildingId: "agentops_tower",
    floorId: "floor_00_lobby",
  })

  const next = agentOpsSimulationReducer(pinned, {
    type: "ingest_events",
    now: "2026-05-14T12:00:01.000Z",
    events: [
      {
        id: "event-lobby-pinned",
        type: "agent.task.started",
        workspaceId: "workspace-1",
        timestamp: "2026-05-14T12:00:01.000Z",
        source: "clawchat",
        agentId: "agent-1",
        roomId: "common_room",
        severity: "info",
        title: "Started",
      },
    ],
  })

  assert.equal(next.activeFloorId, "floor_00_lobby")
  assert.equal(next.agents["agent-1"].floorId, "floor_01_operations")
})
