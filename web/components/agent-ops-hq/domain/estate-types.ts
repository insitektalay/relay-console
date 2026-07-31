import type {
  Agent,
  Approval,
  Department,
  Message,
  Task,
  Thread,
} from "@clawchat/contracts"
import type {
  RuntimeContextUsageUiState,
  RuntimeDispatchUiState,
  RuntimeParticipantHealthUiState,
} from "@/hooks/use-clawchat-realtime"

export type AgentOpsPoint = { x: number; y: number }
export type AgentOpsRect = AgentOpsPoint & { width: number; height: number }
export type AgentOpsCompassDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right"
export type AgentOpsWorkFacing = "north" | "east" | "south" | "west"
export type AgentOpsPathTag =
  | "main"
  | "idle"
  | "room_entry"
  | "outside"
  | "social"
  | "restricted"
export type AgentOpsRoomStatus =
  | "active"
  | "idle"
  | "empty"
  | "inactive"
  | "locked"
  | "under_construction"
  | "retired"
export type AgentOpsRoomVariantSize =
  | "small"
  | "medium"
  | "large"
  | "empty"
  | "inactive"
  | "under_construction"
export type AgentOpsRealState =
  | "offline"
  | "idle"
  | "queued"
  | "working"
  | "thinking"
  | "tooling"
  | "waiting_for_approval"
  | "blocked"
  | "error"
  | "completed"
  | "cancelled"
export type AgentOpsVisibleState =
  | "entering_hq"
  | "idle_wandering"
  | "idle_social"
  | "idle_canteen"
  | "idle_games"
  | "idle_toilet"
  | "idle_outdoor"
  | "walking_to_work"
  | "desk_work"
  | "meeting"
  | "approval_wait"
  | "error_alert"
  | "completion_celebration"
  | "returning_to_idle"
  | "offline_hidden"
export type AgentOpsEventSeverity =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "revenue"
export type AgentOpsEventSource =
  | "clawchat"
  | "openclaw"
  | "hermes"
  | "marketplace"
  | "simulation"
  | "mock"
export type AgentOpsEventType =
  | "agent.online"
  | "agent.offline"
  | "agent.idle"
  | "agent.task.queued"
  | "agent.task.started"
  | "agent.task.progress"
  | "agent.thinking"
  | "agent.tool.called"
  | "agent.context.updated"
  | "agent.context.warning"
  | "agent.waiting_for_approval"
  | "agent.approval.approved"
  | "agent.approval.rejected"
  | "agent.error"
  | "agent.task.completed"
  | "agent.dispatch.cancelled"
  | "department.active"
  | "department.inactive"
  | "business_unit.active"
  | "business_unit.idle"
  | "application.active"
  | "application.idle"
  | "website.active"
  | "output.started"
  | "output.completed"
  | "workflow.started"
  | "workflow.completed"
  | "room.activated"
  | "room.expanded"
  | "room.retired"
  | "estate.expansion.planned"
  | "app.activity"
  | "message.created"
  | "revenue.event"
  | "simulation.idle_activity"

export interface AgentOpsWorkstation {
  id: string
  position: AgentOpsPoint
  facing?: AgentOpsWorkFacing
  label?: string
}

export interface AgentOpsScreenAnchor {
  id: string
  position: AgentOpsPoint
  width: number
  height: number
  theme?: string
}

export interface AgentOpsRoomVariant {
  id: string
  label: string
  size: AgentOpsRoomVariantSize
  assetId?: string
  capacity: number
  workstations: AgentOpsWorkstation[]
  screenAnchors: AgentOpsScreenAnchor[]
  idleAnchors: AgentOpsPoint[]
  visualTheme?: string
}

export interface AgentOpsRoom {
  id: string
  zoneId: string
  label: string
  kind:
    | "reception"
    | "social"
    | "canteen"
    | "games"
    | "toilets"
    | "outdoor"
    | "boardroom"
    | "meeting"
    | "office"
    | "studio"
    | "lab"
    | "infrastructure"
    | "approval"
    | "archive"
    | "expansion"
  departmentId?: string | null
  businessUnitId?: string | null
  applicationIds?: string[]
  websiteIds?: string[]
  workflowIds?: string[]
  outputTypeIds?: string[]
  currentVariantId: string
  variants: AgentOpsRoomVariant[]
  status: AgentOpsRoomStatus
  capacity: number
  bounds: AgentOpsRect
  labelPosition?: AgentOpsPoint
  entryAnchors: AgentOpsPoint[]
  idleAnchors: AgentOpsPoint[]
  workstations: AgentOpsWorkstation[]
  screenAnchors: AgentOpsScreenAnchor[]
  lightAnchors: AgentOpsPoint[]
}

export interface AgentOpsZone {
  id: string
  floorId: string
  label: string
  kind:
    | "social"
    | "department_cluster"
    | "executive"
    | "support"
    | "infrastructure"
    | "expansion"
  bounds: AgentOpsRect
  rooms: AgentOpsRoom[]
}

export interface AgentOpsPathWaypoint {
  id: string
  position: AgentOpsPoint
  tags: AgentOpsPathTag[]
}

export interface AgentOpsPathEdge {
  id: string
  from: string
  to: string
  tags: AgentOpsPathTag[]
}

export interface AgentOpsPathNetwork {
  waypoints: AgentOpsPathWaypoint[]
  edges: AgentOpsPathEdge[]
}

export interface AgentOpsFloor {
  id: string
  buildingId: string
  label: string
  level: number
  kind:
    | "lobby"
    | "operations"
    | "studio"
    | "lab"
    | "executive"
    | "archive"
    | "expansion"
  zones: AgentOpsZone[]
  backgroundAssetId?: string
  bounds: AgentOpsRect
  waypointGraphId: string
  pathNetwork?: AgentOpsPathNetwork
  status: "active" | "dim" | "locked" | "under_construction"
}

export interface AgentOpsBuilding {
  id: string
  label: string
  type:
    | "hq"
    | "tower"
    | "annex"
    | "studio"
    | "lab"
    | "warehouse"
    | "external_property"
  floors: AgentOpsFloor[]
  defaultFloorId: string
  worldPosition?: AgentOpsPoint
  status: "active" | "expanding" | "inactive" | "under_construction"
}

export interface AgentOpsBusinessUnit {
  id: string
  label: string
  defaultDepartmentId?: string
  defaultRoomId?: string
  visualTheme: string
  status: "active" | "idle" | "planned" | "retired"
}

export interface AgentOpsApplication {
  appId: string
  label: string
  businessUnitId: string
  defaultDepartmentId: string
  defaultRoomId?: string
  outputTypes: string[]
  publicProperties: string[]
  agentIds: string[]
  workflowIds?: string[]
  visualTheme: string
  status: "active" | "idle" | "retired" | "planned"
}

export interface AgentOpsWebsite {
  id: string
  label: string
  url?: string
  businessUnitId: string
  departmentId?: string
  appIds: string[]
  visualTheme: string
}

export interface AgentOpsOutputType {
  id: string
  label: string
  businessUnitId: string
  departmentId?: string
  visualTheme: string
}

export interface AgentOpsWorkflow {
  id: string
  label: string
  businessUnitId: string
  departmentId?: string
  appIds: string[]
  outputTypeIds: string[]
  visualTheme: string
}

export interface AgentOpsDepartmentAssignment {
  id: string
  agentId: string
  departmentId?: string
  appId?: string
  businessUnitId?: string
  workflowId?: string
  taskForceId?: string
  roomId?: string
  priority: number
  assignmentType: "home" | "secondary" | "temporary" | "event_override"
  startsAt?: string
  endsAt?: string
}

export interface AgentVisualProfile {
  agentId: string
  spriteId: string
  color: string
  displayName: string
  roleLabel: string
  scale: number
  idlePreferences: string[]
}

export interface AgentOpsEvent {
  id: string
  type: AgentOpsEventType
  workspaceId: string
  timestamp: string
  source: AgentOpsEventSource
  agentId?: string | null
  buildingId?: string | null
  floorId?: string | null
  zoneId?: string | null
  roomId?: string | null
  businessUnitId?: string | null
  departmentId?: string | null
  appId?: string | null
  websiteId?: string | null
  outputTypeId?: string | null
  workflowId?: string | null
  taskForceId?: string | null
  threadId?: string | null
  taskId?: string | null
  dispatchId?: string | null
  approvalId?: string | null
  messageId?: string | null
  severity: AgentOpsEventSeverity
  title: string
  summary?: string
  payload?: Record<string, unknown>
}

export type AgentOpsEventHistoryItem = AgentOpsEvent

export interface AgentOpsAgentState {
  agentId: string
  realState: AgentOpsRealState
  visibleState: AgentOpsVisibleState
  buildingId: string
  floorId: string
  zoneId?: string
  roomId?: string
  targetRoomId?: string
  position: AgentOpsPoint
  direction?: AgentOpsCompassDirection
  facing?: AgentOpsWorkFacing
  targetPosition?: AgentOpsPoint
  path: AgentOpsPoint[]
  assignedWorkstationId?: string | null
  currentTaskId?: string | null
  currentThreadId?: string | null
  currentDispatchId?: string | null
  currentApprovalId?: string | null
  currentAppId?: string | null
  currentWorkflowId?: string | null
  liveConfidence?: string | null
  liveSource?: string | null
  liveReason?: string | null
  liveExpiresAt?: string | null
  lastRealEventAt: string
  visibleStateStartedAt: string
  nextIdleDecisionAt: string
}

export interface AgentOpsDepartmentState {
  departmentId: string
  roomIds: string[]
  status:
    | "inactive"
    | "idle"
    | "active"
    | "blocked"
    | "error"
    | "approval"
    | "revenue"
  activeAgentIds: string[]
  activeTaskIds: string[]
  lastEventAt?: string
  intensity: number
}

export interface AgentOpsEstateLayout {
  id: string
  version: number
  buildings: AgentOpsBuilding[]
  businessUnits: AgentOpsBusinessUnit[]
  applications: AgentOpsApplication[]
  websites: AgentOpsWebsite[]
  outputTypes: AgentOpsOutputType[]
  workflows: AgentOpsWorkflow[]
  departmentAssignments: AgentOpsDepartmentAssignment[]
}

export interface AgentOpsSimulationState {
  layout: AgentOpsEstateLayout
  activeBuildingId: string
  activeFloorId: string
  floorPinnedByUser?: boolean
  mode: "live" | "mock"
  clock: string
  agents: Record<string, AgentOpsAgentState>
  visualProfiles: Record<string, AgentVisualProfile>
  departments: Record<string, AgentOpsDepartmentState>
  eventHistory: AgentOpsEventHistoryItem[]
  selectedEntityId?: string | null
  selectedEntityType?: AgentOpsEntityType | null
  searchQuery: string
  debug: {
    showBounds: boolean
    showWaypoints: boolean
    showPaths: boolean
    speed: number
    gapMinerPilotOnly: boolean
  }
}

export type AgentOpsEditableAnchorGroup =
  | "workstations"
  | "screenAnchors"
  | "entryAnchors"
  | "idleAnchors"
  | "lightAnchors"

export type AgentOpsLayoutRoomPatch = {
  roomId: string
  bounds?: AgentOpsRect
  translate?: AgentOpsPoint
  labelPosition?: AgentOpsPoint
  anchor?: {
    group: AgentOpsEditableAnchorGroup
    index: number
    position: AgentOpsPoint
  }
  addAnchor?: {
    group: AgentOpsEditableAnchorGroup
    position: AgentOpsPoint
  }
  deleteAnchor?: {
    group: AgentOpsEditableAnchorGroup
    index: number
  }
}

export type AgentOpsLayoutPathPatch =
  | {
      type: "add_waypoint"
      floorId: string
      waypoint: AgentOpsPathWaypoint
    }
  | {
      type: "move_waypoint"
      floorId: string
      waypointId: string
      position: AgentOpsPoint
    }
  | {
      type: "delete_waypoint"
      floorId: string
      waypointId: string
    }
  | {
      type: "connect_waypoints"
      floorId: string
      from: string
      to: string
      tags: AgentOpsPathTag[]
    }
  | {
      type: "disconnect_edge"
      floorId: string
      edgeId: string
    }
  | {
      type: "set_waypoint_tags"
      floorId: string
      waypointId: string
      tags: AgentOpsPathTag[]
    }
  | {
      type: "set_edge_tags"
      floorId: string
      edgeId: string
      tags: AgentOpsPathTag[]
    }

export interface AgentOpsLayoutEditorState {
  enabled: boolean
  selectedRoomId: string | null
  selectedAnchor: {
    roomId: string
    group: AgentOpsEditableAnchorGroup
    index: number
  } | null
  anchorVisibility: Record<AgentOpsEditableAnchorGroup, boolean>
  snapToGrid: boolean
  roomOverlayAlpha: number
  showLabels: boolean
  pathEditing: boolean
  showPathNetwork: boolean
  pathAddMode: boolean
  selectedPathItem:
    | { type: "waypoint"; id: string }
    | { type: "edge"; id: string }
    | null
  pathConnectFromId: string | null
  activePathTags: AgentOpsPathTag[]
}

export type AgentOpsEntityType =
  | "agent"
  | "room"
  | "department"
  | "business_unit"
  | "application"
  | "website"
  | "output_type"
  | "workflow"

export interface AgentOpsRenderSnapshot {
  layout: AgentOpsEstateLayout
  activeBuildingId: string
  activeFloorId: string
  rooms: AgentOpsRoom[]
  agents: AgentOpsAgentState[]
  visualProfiles: Record<string, AgentVisualProfile>
  departments: Record<string, AgentOpsDepartmentState>
  events: AgentOpsEventHistoryItem[]
  selectedEntityId?: string | null
  selectedEntityType?: AgentOpsEntityType | null
  clock: string
  debug: AgentOpsSimulationState["debug"]
}

export interface AgentOpsSourceState {
  workspaceId: string
  agents: Agent[]
  departments: Department[]
  tasks: Task[]
  approvals: Approval[]
  messages?: Message[]
  threads?: Thread[]
  runtimeDispatches?: RuntimeDispatchUiState[]
  runtimeHealth?: RuntimeParticipantHealthUiState[]
  runtimeContextUsage?: RuntimeContextUsageUiState[]
}

export type AgentOpsSimulationAction =
  | { type: "ingest_events"; events: AgentOpsEvent[]; now: string }
  | { type: "tick"; now: string }
  | { type: "set_layout"; layout: AgentOpsEstateLayout }
  | {
      type: "sync_roster"
      agents: Agent[]
      departments: Department[]
      workspaceId: string
      now: string
    }
  | { type: "set_floor"; buildingId: string; floorId: string }
  | { type: "set_mode"; mode: "live" | "mock" }
  | {
      type: "select"
      entityType: AgentOpsEntityType | null
      entityId: string | null
    }
  | { type: "set_search"; query: string }
  | { type: "set_debug"; debug: Partial<AgentOpsSimulationState["debug"]> }

export function roomVariant(room: AgentOpsRoom) {
  return (
    room.variants.find((variant) => variant.id === room.currentVariantId) ??
    room.variants[0]
  )
}
