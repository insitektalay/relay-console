"use client"

import type {
  Agent,
  AgentOpsLiveAgentState,
  Approval,
  Department,
  Message,
  Task,
  Thread,
} from "@clawchat/contracts"
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import {
  Activity,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Target,
  UsersRound,
  X,
} from "lucide-react"
import type {
  RuntimeContextUsageUiState,
  RuntimeDispatchUiState,
  RuntimeParticipantHealthUiState,
} from "@/hooks/use-clawchat-realtime"
import { DEFAULT_AGENTOPS_LAYOUT } from "./domain/default-estate-layout"
import { normalizeAgentOpsEvents } from "./domain/event-normalizer"
import {
  createGapMinerMockEventSequence,
  createSeededMockEvent,
  type GapMinerMockScenario,
} from "./domain/mock-events"
import {
  agentOpsSimulationReducer,
  createInitialAgentOpsState,
} from "./domain/simulation-reducer"
import { toRenderSnapshot } from "./domain/selectors"
import type {
  AgentOpsEntityType,
  AgentOpsEditableAnchorGroup,
  AgentOpsLayoutEditorState,
  AgentOpsLayoutPathPatch,
  AgentOpsLayoutRoomPatch,
  AgentOpsPathTag,
  AgentOpsPoint,
  AgentOpsRoom,
} from "./domain/estate-types"
import {
  applyPathLayoutPatch,
  applyRoomLayoutPatch,
  clearAgentOpsLayoutOverride,
  cloneAgentOpsLayout,
  exportFloorLayoutJson,
  getRoomAnchorPosition,
  loadAgentOpsLayoutOverride,
  saveAgentOpsLayoutOverride,
} from "./domain/layout-editor"
import { AgentOpsEstateStage } from "./agent-ops-estate-stage"
import { AgentOpsHqHud } from "./agent-ops-hq-hud"
import { AgentOpsSelectedEntityPanel } from "./agent-ops-selected-entity-panel"
import { AgentOpsHqSidebar } from "./agent-ops-hq-sidebar"
import { AgentOpsLayoutEditorPanel } from "./agent-ops-layout-editor-panel"
import { findRoom, getAllRooms } from "./domain/location-resolver"
import {
  applyDepartmentRoomAssignments,
  loadDepartmentRoomAssignments,
} from "./domain/department-room-assignments"
import { AgentOpsLivestreamOverlay } from "./livestream/agent-ops-livestream-overlay"
import type {
  AgentOpsLivestreamSettings,
  AgentOpsViewportTransform,
} from "./livestream/livestream-types"
import { agentOpsEventFromLiveState } from "./domain/live-state-to-event"
import { sdk } from "@/lib/sdk"

const AGENTOPS_SIMULATION_TICK_MS = 50

type AgentOpsVisualFreshnessPolicy = {
  replyKeepsWorkingMinutes: number
  agentRepliesCountAsWorking: boolean
  ignoreUserManagerMessages: boolean
  routeMediumConfidenceToOffice: boolean
}

type AgentOpsAgentAssignment = {
  roomId?: string
  departmentId?: string
  appId?: string
  workflowId?: string
}

const DEFAULT_VISUAL_FRESHNESS_POLICY: AgentOpsVisualFreshnessPolicy = {
  replyKeepsWorkingMinutes: 30,
  agentRepliesCountAsWorking: true,
  ignoreUserManagerMessages: true,
  routeMediumConfidenceToOffice: true,
}

export function AgentOpsHqScreen({
  workspaceId,
  agents,
  departments,
  tasks,
  approvals,
  messages = [],
  threads = [],
  runtimeDispatches = [],
  runtimeHealth = [],
  runtimeContextUsage = [],
  agentOpsLiveStates = {},
  onRequestAgentOpsLiveState,
  onLayoutEditModeChange,
  debugControlsEnabled = false,
}: {
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
  agentOpsLiveStates?: Record<string, AgentOpsLiveAgentState>
  onRequestAgentOpsLiveState?: (agentIds: string[]) => void
  onLayoutEditModeChange?: (enabled: boolean) => void
  debugControlsEnabled?: boolean
}) {
  const seenEventsRef = useRef<Record<string, true>>({})
  const mockTickRef = useRef(0)
  const gapMinerTimeoutsRef = useRef<number[]>([])
  const lastAppliedLiveStateRef = useRef<Record<string, string>>({})
  const skipNextSelectedAgentPersistRef = useRef(false)
  const skipNextPolicyPersistRef = useRef(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [statusPanelOpen, setStatusPanelOpen] = useState(true)
  const [agentPickerOpen, setAgentPickerOpen] = useState(false)
  const [localLiveStates, setLocalLiveStates] = useState<
    Record<string, AgentOpsLiveAgentState>
  >({})
  const [liveStateRefreshedAt, setLiveStateRefreshedAt] = useState<
    string | null
  >(null)
  const [liveStateErrorMessage, setLiveStateErrorMessage] = useState<
    string | null
  >(null)
  const [liveStateErrorAt, setLiveStateErrorAt] = useState<string | null>(null)
  const [liveStateRefreshing, setLiveStateRefreshing] = useState(false)
  const [liveStatePolicyClock, setLiveStatePolicyClock] = useState(() =>
    new Date().toISOString()
  )
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[] | null>(
    () => loadStoredRealAgentIds(workspaceId)
  )
  const [visualFreshnessPolicy, setVisualFreshnessPolicy] =
    useState<AgentOpsVisualFreshnessPolicy>(() => {
      return loadStoredVisualFreshnessPolicy(workspaceId)
    })
  const [agentAssignments] = useState<Record<string, AgentOpsAgentAssignment>>(
    () => {
      return loadStoredAgentAssignments(workspaceId)
    }
  )
  const [departmentRoomAssignments] = useState(
    () => loadDepartmentRoomAssignments(workspaceId)
  )
  const [livestream, setLivestream] = useState<AgentOpsLivestreamSettings>({
    enabled: false,
    comedyMode: true,
    bossVisible: true,
  })
  const [bossCursor, setBossCursor] = useState<AgentOpsPoint | null>(null)
  const [viewport, setViewport] = useState<AgentOpsViewportTransform>({
    scale: 1,
    pan: { x: 0, y: 0 },
  })
  const [layout, setLayout] = useState(
    () =>
      loadAgentOpsLayoutOverride() ??
      cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
  )
  const effectiveLayout = useMemo(
    () => applyDepartmentRoomAssignments(layout, departmentRoomAssignments),
    [departmentRoomAssignments, layout]
  )
  const [hasLocalLayoutOverride, setHasLocalLayoutOverride] = useState(() =>
    Boolean(loadAgentOpsLayoutOverride())
  )
  const [mouseWorld, setMouseWorld] = useState<AgentOpsPoint | null>(null)
  const [editor, setEditor] = useState<AgentOpsLayoutEditorState>({
    enabled: false,
    selectedRoomId: null,
    selectedAnchor: null,
    anchorVisibility: {
      workstations: true,
      screenAnchors: true,
      entryAnchors: true,
      idleAnchors: true,
      lightAnchors: true,
    },
    snapToGrid: false,
    roomOverlayAlpha: 0.42,
    showLabels: true,
    pathEditing: false,
    showPathNetwork: false,
    pathAddMode: false,
    selectedPathItem: null,
    pathConnectFromId: null,
    activePathTags: ["main", "idle"],
  })
  const effectiveSelectedAgentIds = useMemo(
    () => selectedAgentIds ?? agents.map((agent) => agent.id),
    [agents, selectedAgentIds]
  )
  const initialState = useMemo(
    () =>
      createInitialAgentOpsState({
        layout: effectiveLayout,
        agents: agents.filter((agent) =>
          effectiveSelectedAgentIds.includes(agent.id)
        ),
        departments,
        workspaceId,
      }),
    [
      agents,
      departments,
      effectiveLayout,
      effectiveSelectedAgentIds,
      workspaceId,
    ]
  )
  const [state, dispatch] = useReducer(agentOpsSimulationReducer, initialState)
  const selectedAgents = useMemo(
    () =>
      agents.filter((agent) => effectiveSelectedAgentIds.includes(agent.id)),
    [agents, effectiveSelectedAgentIds]
  )
  const selectableAgents = useMemo(
    () =>
      [...agents].sort((left, right) => {
        const leftType = agentTypeSortIndex(resolveAgentOpsGroupType(left))
        const rightType = agentTypeSortIndex(resolveAgentOpsGroupType(right))
        if (leftType !== rightType) return leftType - rightType
        return left.name.localeCompare(right.name)
      }),
    [agents]
  )
  const selectableAgentSections = useMemo(
    () =>
      (["business", "family", "personal"] as const)
        .map((type) => ({
          type,
          label: titleCase(type),
          agents: selectableAgents.filter(
            (agent) => resolveAgentOpsGroupType(agent) === type
          ),
        }))
        .filter((section) => section.agents.length),
    [selectableAgents]
  )
  const snapshot = useMemo(() => toRenderSnapshot(state), [state])
  const activeEditor = {
    ...editor,
    selectedRoomId:
      state.selectedEntityType === "room"
        ? (state.selectedEntityId ?? editor.selectedRoomId)
        : editor.selectedRoomId,
  }

  useEffect(() => {
    dispatch({ type: "set_layout", layout: effectiveLayout })
  }, [effectiveLayout])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (selectedAgentIds === null) return
    if (skipNextSelectedAgentPersistRef.current) {
      skipNextSelectedAgentPersistRef.current = false
      return
    }
    window.localStorage.setItem(
      `agentops.realAgents.${workspaceId}`,
      JSON.stringify(selectedAgentIds)
    )
  }, [selectedAgentIds, workspaceId])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (skipNextPolicyPersistRef.current) {
      skipNextPolicyPersistRef.current = false
      return
    }
    window.localStorage.setItem(
      `agentops.visualFreshnessPolicy.${workspaceId}`,
      JSON.stringify(visualFreshnessPolicy)
    )
  }, [visualFreshnessPolicy, workspaceId])

  useEffect(() => {
    dispatch({
      type: "sync_roster",
      agents: selectedAgents,
      departments,
      workspaceId,
      now: new Date().toISOString(),
    })
  }, [departments, selectedAgents, workspaceId])

  useEffect(() => {
    const selected = new Set(effectiveSelectedAgentIds)
    for (const agentId of Object.keys(lastAppliedLiveStateRef.current)) {
      if (!selected.has(agentId)) {
        delete lastAppliedLiveStateRef.current[agentId]
      }
    }
  }, [effectiveSelectedAgentIds])

  const mergedLiveStates = useMemo(
    () => ({ ...localLiveStates, ...agentOpsLiveStates }),
    [agentOpsLiveStates, localLiveStates]
  )
  const roomOptions = useMemo(
    () => getAllRooms(effectiveLayout),
    [effectiveLayout]
  )
  const adjustedLiveStates = useMemo(() => {
    const now = new Date(liveStatePolicyClock)
    return Object.fromEntries(
      selectedAgents.flatMap((agent) => {
        const adjusted = applyVisualFreshnessPolicy({
          agent,
          liveState: mergedLiveStates[agent.id],
          messages,
          assignment: agentAssignments[agent.id],
          policy: visualFreshnessPolicy,
          rooms: roomOptions,
          now,
        })
        return adjusted ? [[agent.id, adjusted]] : []
      })
    )
  }, [
    agentAssignments,
    liveStatePolicyClock,
    mergedLiveStates,
    messages,
    roomOptions,
    selectedAgents,
    visualFreshnessPolicy,
  ])

  const refreshAgentOpsLiveState = useCallback(() => {
    if (!effectiveSelectedAgentIds.length) return undefined
    onRequestAgentOpsLiveState?.(effectiveSelectedAgentIds)
    let cancelled = false
    setLiveStateRefreshing(true)
    void sdk.agentOps
      .liveState(workspaceId, effectiveSelectedAgentIds)
      .then((snapshot) => {
        if (cancelled) return
        setLocalLiveStates((current) => ({
          ...current,
          ...Object.fromEntries(
            snapshot.agents.map((entry) => [entry.agentId, entry])
          ),
        }))
        setLiveStateRefreshedAt(snapshot.generatedAt)
        setLiveStateErrorMessage(null)
        setLiveStateErrorAt(null)
      })
      .catch((error) => {
        if (cancelled) return
        setLiveStateErrorMessage(
          error instanceof Error
            ? error.message
            : "AgentOps live state failed to load."
        )
        setLiveStateErrorAt(new Date().toISOString())
      })
      .finally(() => {
        if (!cancelled) setLiveStateRefreshing(false)
      })
    return () => {
      cancelled = true
    }
  }, [effectiveSelectedAgentIds, onRequestAgentOpsLiveState, workspaceId])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    const handle = window.setTimeout(() => {
      cleanup = refreshAgentOpsLiveState()
    }, 0)
    return () => {
      window.clearTimeout(handle)
      cleanup?.()
    }
  }, [refreshAgentOpsLiveState])

  useEffect(() => {
    if (!effectiveSelectedAgentIds.length) return
    const handle = window.setInterval(() => {
      refreshAgentOpsLiveState()
    }, 10000)
    return () => window.clearInterval(handle)
  }, [effectiveSelectedAgentIds.length, refreshAgentOpsLiveState])

  useEffect(() => {
    if (!effectiveSelectedAgentIds.length) return
    const handle = window.setInterval(() => {
      setLiveStatePolicyClock(new Date().toISOString())
    }, 15000)
    return () => window.clearInterval(handle)
  }, [effectiveSelectedAgentIds.length])

  useEffect(() => {
    onLayoutEditModeChange?.(editor.enabled)
    return () => onLayoutEditModeChange?.(false)
  }, [editor.enabled, onLayoutEditModeChange])

  const injectMockEvent = useCallback(() => {
    if (!debugControlsEnabled) return
    const event = createSeededMockEvent({
      layout: state.layout,
      workspaceId,
      agents,
      tick: mockTickRef.current,
    })
    mockTickRef.current += 1
    if (event) {
      dispatch({
        type: "ingest_events",
        events: [event],
        now: new Date().toISOString(),
      })
    }
  }, [agents, debugControlsEnabled, state.layout, workspaceId])

  const triggerGapMinerSequence = useCallback(
    (scenario: GapMinerMockScenario, agentCount = 1) => {
      if (!debugControlsEnabled) return
      for (const timeout of gapMinerTimeoutsRef.current) {
        window.clearTimeout(timeout)
      }
      gapMinerTimeoutsRef.current = []
      const now = new Date()
      const events = createGapMinerMockEventSequence({
        layout: state.layout,
        workspaceId,
        agents,
        agentCount,
        scenario,
        now,
      })
      if (!events.length) return
      dispatch({ type: "set_mode", mode: "mock" })
      const selectedAgentId = events[0]?.agentId
      if (selectedAgentId) {
        dispatch({
          type: "select",
          entityType: "agent",
          entityId: selectedAgentId,
        })
      }
      for (const event of events) {
        const delay = Math.max(
          0,
          new Date(event.timestamp).getTime() - now.getTime()
        )
        const timeout = window.setTimeout(() => {
          dispatch({
            type: "ingest_events",
            events: [event],
            now: new Date().toISOString(),
          })
        }, delay)
        gapMinerTimeoutsRef.current.push(timeout)
      }
    },
    [agents, debugControlsEnabled, state.layout, workspaceId]
  )

  useEffect(() => {
    const handle = window.setInterval(() => {
      dispatch({ type: "tick", now: new Date().toISOString() })
    }, AGENTOPS_SIMULATION_TICK_MS)
    return () => {
      window.clearInterval(handle)
      for (const timeout of gapMinerTimeoutsRef.current) {
        window.clearTimeout(timeout)
      }
      gapMinerTimeoutsRef.current = []
    }
  }, [])

  useEffect(() => {
    if (state.mode !== "live") return
    const events = normalizeAgentOpsEvents(
      state.layout,
      {
        workspaceId,
        agents,
        departments,
        tasks,
        approvals,
        messages,
        threads,
        runtimeDispatches,
        runtimeHealth,
        runtimeContextUsage,
      },
      seenEventsRef.current
    )
    if (events.length) {
      dispatch({ type: "ingest_events", events, now: new Date().toISOString() })
    }
  }, [
    agents,
    approvals,
    departments,
    messages,
    threads,
    runtimeContextUsage,
    runtimeDispatches,
    runtimeHealth,
    state.layout,
    state.mode,
    tasks,
    workspaceId,
  ])

  useEffect(() => {
    if (state.mode !== "live") return
    const now = new Date().toISOString()
    const events = selectedAgents.flatMap((agent) => {
      const liveState = adjustedLiveStates[agent.id]
      if (!liveState) return []
      const signature = [
        liveState.realState,
        liveState.source,
        liveState.updatedAt,
        liveState.dispatchId ?? "",
        liveState.taskId ?? "",
        liveState.approvalId ?? "",
        liveState.messageId ?? "",
      ].join(":")
      if (lastAppliedLiveStateRef.current[agent.id] === signature) return []
      lastAppliedLiveStateRef.current[agent.id] = signature
      return [
        agentOpsEventFromLiveState(workspaceId, agent, liveState, {
          initialPlacement: !state.eventHistory.some(
            (event) => event.agentId === agent.id
          ),
        }),
      ]
    })
    if (events.length) {
      dispatch({ type: "ingest_events", events, now })
    }
  }, [
    adjustedLiveStates,
    selectedAgents,
    state.eventHistory,
    state.mode,
    workspaceId,
  ])

  useEffect(() => {
    if (state.mode !== "mock") return
    const handle = window.setInterval(() => {
      injectMockEvent()
    }, 5500)
    return () => window.clearInterval(handle)
  }, [injectMockEvent, state.mode])

  function select(type: AgentOpsEntityType, id: string) {
    dispatch({ type: "select", entityType: type, entityId: id })
    if (type === "room") {
      setEditor((current) => ({
        ...current,
        selectedRoomId: id,
        selectedAnchor:
          current.selectedAnchor?.roomId === id ? current.selectedAnchor : null,
        selectedPathItem: null,
        pathConnectFromId: null,
      }))
    }
  }

  const patchRoomLayout = useCallback((patch: AgentOpsLayoutRoomPatch) => {
    setLayout((current) => {
      const next = applyRoomLayoutPatch(current, patch)
      saveAgentOpsLayoutOverride(next)
      return next
    })
    setHasLocalLayoutOverride(true)
  }, [])

  const patchPathLayout = useCallback((patch: AgentOpsLayoutPathPatch) => {
    setLayout((current) => {
      const next = applyPathLayoutPatch(current, patch)
      saveAgentOpsLayoutOverride(next)
      return next
    })
    setHasLocalLayoutOverride(true)
  }, [])

  const updateEditor = useCallback(
    (next: Partial<AgentOpsLayoutEditorState>) => {
      setEditor((current) => ({ ...current, ...next }))
    },
    []
  )

  const updateLivestream = useCallback(
    (next: Partial<AgentOpsLivestreamSettings>) => {
      setLivestream((current) => ({ ...current, ...next }))
    },
    []
  )

  const selectAnchor = useCallback(
    (anchor: {
      roomId: string
      group: AgentOpsEditableAnchorGroup
      index: number
    }) => {
      setEditor((current) => ({
        ...current,
        selectedRoomId: anchor.roomId,
        selectedAnchor: anchor,
        selectedPathItem: null,
        pathConnectFromId: null,
      }))
    },
    []
  )

  const selectPathItem = useCallback(
    (
      item: AgentOpsLayoutEditorState["selectedPathItem"],
      connectFromId?: string | null
    ) => {
      const connectedWaypoint =
        item?.type === "waypoint" && connectFromId && connectFromId !== item.id
      setEditor((current) => ({
        ...current,
        selectedPathItem: item,
        selectedAnchor: null,
        pathConnectFromId: connectedWaypoint
          ? item.id
          : connectFromId === undefined
            ? current.pathConnectFromId
            : connectFromId,
      }))
    },
    []
  )

  const addPathWaypointAtPoint = useCallback(
    (point: AgentOpsPoint) => {
      const id = `wp_${Date.now().toString(36)}`
      patchPathLayout({
        type: "add_waypoint",
        floorId: state.activeFloorId,
        waypoint: {
          id,
          position: point,
          tags: editor.activePathTags.length ? editor.activePathTags : ["main"],
        },
      })
      setEditor((current) => ({
        ...current,
        selectedPathItem: { type: "waypoint", id },
      }))
    },
    [editor.activePathTags, patchPathLayout, state.activeFloorId]
  )

  const addPathWaypointAtMouse = useCallback(() => {
    if (!mouseWorld) return
    addPathWaypointAtPoint(mouseWorld)
  }, [addPathWaypointAtPoint, mouseWorld])

  const deleteSelectedPathItem = useCallback(() => {
    const item = editor.selectedPathItem
    if (!item) return
    patchPathLayout(
      item.type === "waypoint"
        ? {
            type: "delete_waypoint",
            floorId: state.activeFloorId,
            waypointId: item.id,
          }
        : {
            type: "disconnect_edge",
            floorId: state.activeFloorId,
            edgeId: item.id,
          }
    )
    setEditor((current) => ({
      ...current,
      selectedPathItem: null,
      pathConnectFromId:
        item.type === "waypoint" && current.pathConnectFromId === item.id
          ? null
          : current.pathConnectFromId,
    }))
  }, [editor.selectedPathItem, patchPathLayout, state.activeFloorId])

  const addAnchorAtMouse = useCallback(
    (group: AgentOpsEditableAnchorGroup) => {
      if (!editor.selectedRoomId || !mouseWorld) return
      const roomId = editor.selectedRoomId
      const room = findRoom(state.layout, roomId)
      if (!room) return
      const nextIndex =
        group === "entryAnchors"
          ? room.entryAnchors.length
          : group === "idleAnchors"
            ? room.idleAnchors.length
            : group === "lightAnchors"
              ? room.lightAnchors.length
              : group === "workstations"
                ? room.workstations.length
                : room.screenAnchors.length
      patchRoomLayout({
        roomId,
        addAnchor: {
          group,
          position: mouseWorld,
        },
      })
      setEditor((current) => ({
        ...current,
        selectedRoomId: roomId,
        selectedAnchor: { roomId, group, index: nextIndex },
        selectedPathItem: null,
        pathConnectFromId: null,
        anchorVisibility: {
          ...current.anchorVisibility,
          [group]: true,
        },
      }))
    },
    [editor.selectedRoomId, mouseWorld, patchRoomLayout, state.layout]
  )

  const deleteSelectedAnchor = useCallback(() => {
    const anchor = editor.selectedAnchor
    if (!anchor) return
    patchRoomLayout({
      roomId: anchor.roomId,
      deleteAnchor: {
        group: anchor.group,
        index: anchor.index,
      },
    })
    setEditor((current) => ({
      ...current,
      selectedAnchor: null,
    }))
  }, [editor.selectedAnchor, patchRoomLayout])

  const setSelectedPathTags = useCallback(
    (tags: AgentOpsPathTag[]) => {
      const item = editor.selectedPathItem
      if (!item) return
      patchPathLayout(
        item.type === "waypoint"
          ? {
              type: "set_waypoint_tags",
              floorId: state.activeFloorId,
              waypointId: item.id,
              tags,
            }
          : {
              type: "set_edge_tags",
              floorId: state.activeFloorId,
              edgeId: item.id,
              tags,
            }
      )
    },
    [editor.selectedPathItem, patchPathLayout, state.activeFloorId]
  )

  const saveLayoutOverride = useCallback(() => {
    saveAgentOpsLayoutOverride(state.layout)
    setHasLocalLayoutOverride(true)
  }, [state.layout])

  const resetLayoutOverride = useCallback(() => {
    clearAgentOpsLayoutOverride()
    const resetLayout = cloneAgentOpsLayout(DEFAULT_AGENTOPS_LAYOUT)
    setLayout(resetLayout)
    setHasLocalLayoutOverride(false)
  }, [])

  const copyFloorLayout = useCallback(() => {
    const json = exportFloorLayoutJson(state.layout, state.activeFloorId)
    void navigator.clipboard?.writeText(json)
  }, [state.activeFloorId, state.layout])

  useEffect(() => {
    if (!editor.enabled) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && editor.pathConnectFromId) {
        event.preventDefault()
        setEditor((current) => ({ ...current, pathConnectFromId: null }))
        return
      }
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      )
        return
      if (!editor.selectedAnchor) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return
      }
      const room = findRoom(state.layout, editor.selectedAnchor?.roomId)
      const point = getRoomAnchorPosition(
        room,
        editor.selectedAnchor?.group,
        editor.selectedAnchor?.index
      )
      if (!room || !point || !editor.selectedAnchor) return
      event.preventDefault()
      const amount = event.shiftKey ? 10 : 1
      const delta = {
        x:
          event.key === "ArrowLeft"
            ? -amount
            : event.key === "ArrowRight"
              ? amount
              : 0,
        y:
          event.key === "ArrowUp"
            ? -amount
            : event.key === "ArrowDown"
              ? amount
              : 0,
      }
      patchRoomLayout({
        roomId: room.id,
        anchor: {
          group: editor.selectedAnchor.group,
          index: editor.selectedAnchor.index,
          position: { x: point.x + delta.x, y: point.y + delta.y },
        },
      })
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    editor.enabled,
    editor.pathConnectFromId,
    editor.selectedAnchor,
    patchRoomLayout,
    state.layout,
  ])

  function jumpToActiveWork() {
    const latest = state.eventHistory.find(
      (event) => event.roomId || event.agentId
    )
    if (latest?.agentId) {
      select("agent", latest.agentId)
      return
    }
    if (latest?.roomId) {
      select("room", latest.roomId)
    }
  }

  function toggleRealAgent(agentId: string) {
    dispatch({ type: "set_mode", mode: "live" })
    setSelectedAgentIds((current) => {
      const explicit = current ?? effectiveSelectedAgentIds
      return explicit.includes(agentId)
        ? explicit.filter((entry) => entry !== agentId)
        : [...explicit, agentId]
    })
  }

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden bg-[#101820]"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        setBossCursor({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        })
      }}
      onPointerLeave={() => setBossCursor(null)}
    >
      <AgentOpsEstateStage
        snapshot={snapshot}
        editor={activeEditor}
        onSelect={(type, id) => select(type, id)}
        onRoomPatch={patchRoomLayout}
        onPathPatch={patchPathLayout}
        onPathSelect={selectPathItem}
        onPathAddPoint={addPathWaypointAtPoint}
        onAnchorSelect={selectAnchor}
        onMouseWorldChange={setMouseWorld}
        onViewportChange={setViewport}
      />
      {!editor.enabled ? (
        <AgentOpsLivestreamOverlay
          snapshot={snapshot}
          settings={livestream}
          cursor={bossCursor}
          viewport={viewport}
          onSettingsChange={updateLivestream}
        />
      ) : null}
      {!editor.enabled ? (
      <AgentOpsHqHud
        state={state}
        statusOpen={statusPanelOpen}
        onFloorChange={(buildingId, floorId) =>
          dispatch({ type: "set_floor", buildingId, floorId })
        }
        onStatusClose={() => setStatusPanelOpen(false)}
      />
      ) : null}
      {!editor.enabled ? <AgentOpsSelectedEntityPanel state={state} /> : null}
      {!editor.enabled ? (
        <AgentOpsLiveStateStatusBanner
          mode={state.mode}
          debugControlsEnabled={debugControlsEnabled}
          errorMessage={liveStateErrorMessage}
          errorAt={liveStateErrorAt}
          lastSuccessAt={liveStateRefreshedAt}
          isRefreshing={liveStateRefreshing}
          onRefresh={() => {
            refreshAgentOpsLiveState()
          }}
        />
      ) : null}
      {!editor.enabled && agentPickerOpen ? (
        <div className="absolute top-20 bottom-4 left-16 z-30 flex w-[360px] flex-col overflow-hidden rounded-[4px] border border-white/10 bg-[#111922]/94 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">
                Real-time agents
              </div>
              <div className="mt-1 text-xs leading-4 text-zinc-400">
                Select real workspace agents to place into AgentOps HQ.
              </div>
            </div>
            <button
              type="button"
              title="Close real-time agents"
              className="flex size-7 shrink-0 items-center justify-center rounded-[4px] text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
              onClick={() => setAgentPickerOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="border-b border-white/10 px-3 py-2 text-[11px] leading-4 text-zinc-500">
            Checked agents appear in the live floor. Strong backend signals win;
            the visual freshness policy controls recent agent replies.
          </div>
          <div className="space-y-3 border-b border-white/10 px-3 py-3 text-xs">
            <label className="block text-zinc-400">
              <span className="mb-1 block">
                Agent reply keeps agent working for{" "}
                <span className="text-zinc-100">
                  {visualFreshnessPolicy.replyKeepsWorkingMinutes}
                </span>{" "}
                minutes
              </span>
              <input
                type="range"
                min={1}
                max={180}
                value={visualFreshnessPolicy.replyKeepsWorkingMinutes}
                className="w-full accent-emerald-400"
                onChange={(event) =>
                  setVisualFreshnessPolicy((current) => ({
                    ...current,
                    replyKeepsWorkingMinutes: clampMinutes(
                      Number(event.target.value)
                    ),
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                className="size-4 accent-emerald-400"
                checked={visualFreshnessPolicy.agentRepliesCountAsWorking}
                onChange={(event) =>
                  setVisualFreshnessPolicy((current) => ({
                    ...current,
                    agentRepliesCountAsWorking: event.target.checked,
                  }))
                }
              />
              Recent agent replies count as working/recently active
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                className="size-4 accent-emerald-400"
                checked={visualFreshnessPolicy.ignoreUserManagerMessages}
                onChange={(event) =>
                  setVisualFreshnessPolicy((current) => ({
                    ...current,
                    ignoreUserManagerMessages: event.target.checked,
                  }))
                }
              />
              Ignore user/manager messages for activity
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                className="size-4 accent-emerald-400"
                checked={visualFreshnessPolicy.routeMediumConfidenceToOffice}
                onChange={(event) =>
                  setVisualFreshnessPolicy((current) => ({
                    ...current,
                    routeMediumConfidenceToOffice: event.target.checked,
                  }))
                }
              />
              Route weak/medium activity to assigned office
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <span className="truncate text-[11px] text-zinc-500">
              {liveStateRefreshedAt
                ? `Refreshed ${new Date(liveStateRefreshedAt).toLocaleTimeString()}`
                : "No snapshot yet"}
            </span>
            <button
              type="button"
              className="rounded-[4px] border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10"
              onClick={() => refreshAgentOpsLiveState()}
            >
              Refresh
            </button>
          </div>
          <div className="mission-scrollbar min-h-0 flex-1 overflow-auto p-2">
            {selectableAgentSections.length ? (
              selectableAgentSections.map((section) => (
                <div key={section.type} className="pb-2">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {section.label}
                  </div>
                  {section.agents.map((agent) => {
                    const checked = effectiveSelectedAgentIds.includes(agent.id)
                    const liveState =
                      adjustedLiveStates[agent.id] ?? mergedLiveStates[agent.id]
                    const assignment = agentAssignments[agent.id] ?? {}
                    return (
                      <div
                        key={agent.id}
                        className="rounded-[4px] px-2 py-2 text-sm hover:bg-white/[0.06]"
                      >
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-emerald-400"
                            checked={checked}
                            onChange={() => toggleRealAgent(agent.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-zinc-100">
                              {agent.name}
                            </span>
                            <span className="block truncate text-xs text-zinc-500">
                              {agent.role || "Agent"} ·{" "}
                              {liveState
                                ? `${liveState.realState} · ${liveState.confidence}`
                                : "not loaded"}
                            </span>
                          </span>
                        </label>
                        {checked ? (
                          <div className="mt-2 space-y-2 pl-6">
                            <div className="rounded-[4px] bg-black/20 px-2 py-1 text-[11px] leading-4 text-zinc-500">
                              {assignmentSummary(assignment, roomOptions)}
                            </div>
                            {liveState ? (
                              <div className="rounded-[4px] bg-black/20 px-2 py-1 text-[11px] leading-4 text-zinc-500">
                                {formatLiveStateInspector(liveState)}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ))
            ) : (
              <div className="rounded-[4px] border border-white/10 p-3 text-sm text-zinc-500">
                No agents are available in this workspace.
              </div>
            )}
          </div>
          <div className="border-t border-white/10 px-3 py-2 text-xs text-zinc-400">
            {effectiveSelectedAgentIds.length} selected
          </div>
        </div>
      ) : null}
      {!editor.enabled && panelOpen ? (
        <div className="absolute top-20 bottom-4 left-16 z-20 w-[320px] overflow-hidden rounded-[4px] border border-white/10 bg-[#111922]/92 shadow-xl backdrop-blur">
          <AgentOpsHqSidebar
            state={state}
            editor={editor}
            onModeChange={(mode) => dispatch({ type: "set_mode", mode })}
            onSearchChange={(query) => dispatch({ type: "set_search", query })}
            onSelect={select}
            onJumpActive={jumpToActiveWork}
            onInjectMock={injectMockEvent}
            onTriggerGapMinerWork={(agentCount) =>
              triggerGapMinerSequence("work", agentCount)
            }
            onTriggerGapMinerApproval={() =>
              triggerGapMinerSequence("approval")
            }
            onTriggerGapMinerError={() => triggerGapMinerSequence("error")}
            onDebugChange={(debug) => dispatch({ type: "set_debug", debug })}
            onEditorChange={updateEditor}
            livestream={livestream}
            onLivestreamChange={updateLivestream}
            debugControlsEnabled={debugControlsEnabled}
          />
        </div>
      ) : null}
      <AgentOpsLayoutEditorPanel
        state={state}
        editor={activeEditor}
        mouseWorld={mouseWorld}
        hasLocalOverride={hasLocalLayoutOverride}
        onEditorChange={updateEditor}
        onCopyExport={copyFloorLayout}
        onSaveLocal={saveLayoutOverride}
        onReset={resetLayoutOverride}
        onExit={() => updateEditor({ enabled: false })}
        onAddPathWaypoint={addPathWaypointAtMouse}
        onDeleteSelectedPathItem={deleteSelectedPathItem}
        onSetSelectedPathTags={setSelectedPathTags}
        onAddAnchor={addAnchorAtMouse}
        onDeleteSelectedAnchor={deleteSelectedAnchor}
      />
      {!editor.enabled ? (
        <div className="absolute top-20 left-4 z-30 flex flex-col gap-2">
          <button
            type="button"
            title={statusPanelOpen ? "Hide AgentOps status" : "Show AgentOps status"}
            className={`flex size-10 items-center justify-center rounded-[4px] border shadow-xl backdrop-blur hover:bg-white/[0.075] ${
              statusPanelOpen
                ? "border-sky-300/35 bg-sky-300/15 text-sky-100"
                : "border-white/10 bg-[#111922]/88 text-zinc-200"
            }`}
            onClick={() => setStatusPanelOpen((current) => !current)}
          >
            <SlidersHorizontal className="size-5" />
          </button>
          <button
            type="button"
            title={
              agentPickerOpen
                ? "Hide real-time agents"
                : "Show real-time agents"
            }
            className={`flex size-10 items-center justify-center rounded-[4px] border shadow-xl backdrop-blur hover:bg-white/[0.075] ${
              agentPickerOpen
                ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-100"
                : "border-white/10 bg-[#111922]/88 text-zinc-200"
            }`}
            onClick={() => {
              setAgentPickerOpen((current) => !current)
              setPanelOpen(false)
            }}
          >
            <UsersRound className="size-5" />
          </button>
          <button
            type="button"
            title={panelOpen ? "Hide AgentOps panel" : "Show AgentOps panel"}
            className="flex size-10 items-center justify-center rounded-[4px] border border-white/10 bg-[#111922]/88 text-zinc-200 shadow-xl backdrop-blur hover:bg-white/[0.075]"
            onClick={() => {
              setPanelOpen((current) => !current)
              setAgentPickerOpen(false)
            }}
          >
            {panelOpen ? (
              <PanelLeftClose className="size-5" />
            ) : (
              <PanelLeftOpen className="size-5" />
            )}
          </button>
          {debugControlsEnabled ? (
            <button
              type="button"
              title={
                state.mode === "mock"
                  ? "Switch to live mode"
                  : "Switch to mock mode"
              }
              className="flex size-10 items-center justify-center rounded-[4px] border border-white/10 bg-[#111922]/88 text-zinc-200 shadow-xl backdrop-blur hover:bg-white/[0.075]"
              onClick={() =>
                dispatch({
                  type: "set_mode",
                  mode: state.mode === "mock" ? "live" : "mock",
                })
              }
            >
              {state.mode === "mock" ? (
                <Play className="size-5" />
              ) : (
                <Radio className="size-5" />
              )}
            </button>
          ) : null}
          <button
            type="button"
            title="Jump to active work"
            className="flex size-10 items-center justify-center rounded-[4px] border border-white/10 bg-[#111922]/88 text-zinc-200 shadow-xl backdrop-blur hover:bg-white/[0.075]"
            onClick={jumpToActiveWork}
          >
            <Target className="size-5" />
          </button>
          {debugControlsEnabled ? (
            <button
              type="button"
              title="Inject mock event"
              className="flex size-10 items-center justify-center rounded-[4px] border border-white/10 bg-[#111922]/88 text-zinc-200 shadow-xl backdrop-blur hover:bg-white/[0.075]"
              onClick={injectMockEvent}
            >
              <Activity className="size-5" />
            </button>
          ) : null}
          <button
            type="button"
            title={
              livestream.enabled
                ? "Disable livestream overlay"
                : "Enable livestream overlay"
            }
            className={`flex size-10 items-center justify-center rounded-[4px] border shadow-xl backdrop-blur hover:bg-white/[0.075] ${
              livestream.enabled
                ? "border-fuchsia-300/35 bg-fuchsia-300/15 text-fuchsia-100"
                : "border-white/10 bg-[#111922]/88 text-zinc-200"
            }`}
            onClick={() => updateLivestream({ enabled: !livestream.enabled })}
          >
            <span className="text-sm font-black">LIVE</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

function applyVisualFreshnessPolicy({
  agent,
  liveState,
  messages,
  assignment,
  policy,
  rooms,
  now,
}: {
  agent: Agent
  liveState?: AgentOpsLiveAgentState
  messages: Message[]
  assignment?: AgentOpsAgentAssignment
  policy: AgentOpsVisualFreshnessPolicy
  rooms: AgentOpsRoom[]
  now: Date
}): AgentOpsLiveAgentState | null {
  const assignedRoom = resolveAssignedRoom(assignment, rooms)
  const withAssignment = (
    state: AgentOpsLiveAgentState
  ): AgentOpsLiveAgentState => ({
    ...state,
    roomId: assignedRoom?.id ?? state.roomId ?? null,
    departmentId:
      assignment?.departmentId ??
      assignedRoom?.departmentId ??
      state.departmentId ??
      agent.departmentId ??
      null,
    appId: assignment?.appId ?? state.appId ?? null,
    workflowId: assignment?.workflowId ?? state.workflowId ?? null,
  })

  if (liveState?.realState === "offline") {
    return createSyntheticIdleState(
      agent,
      liveState,
      now,
      "Agent has no active work signal; showing selected real agent on idle paths."
    )
  }

  const strongState = liveState && isStrongAuthoritativeLiveState(liveState)
  if (strongState) return withAssignment(liveState)

  const messageState = latestAgentReplyState(
    agent,
    liveState,
    messages,
    policy,
    now
  )
  if (messageState) {
    const shouldRoute =
      policy.routeMediumConfidenceToOffice &&
      ["weak", "medium"].includes(messageState.confidence)
    return shouldRoute
      ? withAssignment(messageState)
      : {
          ...messageState,
          realState: "idle",
          roomId: null,
          reason: `${messageState.reason}; weak/medium office routing is disabled.`,
        }
  }

  if (liveState && isMessageFreshnessState(liveState)) {
    return createSyntheticIdleState(
      agent,
      liveState,
      now,
      liveState.expiresAt
        ? `Recent reply window expired ${formatDuration(Math.max(0, now.getTime() - new Date(liveState.expiresAt).getTime()))} ago.`
        : "No recent agent-authored reply inside the visual freshness window."
    )
  }

  if (!liveState) {
    return createSyntheticIdleState(
      agent,
      undefined,
      now,
      "Selected real agent has no current live work signal."
    )
  }

  return liveState ? withAssignment(liveState) : null
}

function isStrongAuthoritativeLiveState(liveState: AgentOpsLiveAgentState) {
  if (
    ["error", "waiting_for_approval", "tooling", "thinking", "queued"].includes(
      liveState.realState
    )
  ) {
    return true
  }
  return liveState.realState === "working" && liveState.source !== "message"
}

function AgentOpsLiveStateStatusBanner({
  mode,
  debugControlsEnabled,
  errorMessage,
  errorAt,
  lastSuccessAt,
  isRefreshing,
  onRefresh,
}: {
  mode: "live" | "mock"
  debugControlsEnabled: boolean
  errorMessage: string | null
  errorAt: string | null
  lastSuccessAt: string | null
  isRefreshing: boolean
  onRefresh: () => void
}) {
  if (!errorMessage && !lastSuccessAt && mode !== "mock") {
    return null
  }

  return (
    <div className="absolute top-4 right-4 z-30 w-[min(360px,calc(100vw-2rem))] rounded-[4px] border border-white/10 bg-[#111922]/92 p-3 text-xs text-zinc-300 shadow-xl backdrop-blur">
      {mode === "mock" ? (
        <div className="mb-2 rounded-[4px] border border-amber-300/25 bg-amber-300/10 px-2 py-1.5 text-amber-100">
          Demo mode is active. Agent movement is mock data.
          {!debugControlsEnabled ? " Debug controls are disabled." : null}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="flex items-start gap-2 text-red-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-300" />
          <div className="min-w-0">
            <div className="font-semibold">AgentOps live state unavailable</div>
            <div className="mt-1 break-words text-red-100/80">
              {errorMessage}
            </div>
            {errorAt ? (
              <div className="mt-1 text-[11px] text-red-100/60">
                Failed {new Date(errorAt).toLocaleTimeString()}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[11px] text-zinc-500">
          {lastSuccessAt
            ? `Last live snapshot ${new Date(lastSuccessAt).toLocaleTimeString()}`
            : "No successful live snapshot yet"}
        </div>
        <button
          type="button"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[4px] border border-white/10 px-2 text-[11px] font-medium text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw className="size-3" />
          {isRefreshing ? "Refreshing" : "Retry"}
        </button>
      </div>
    </div>
  )
}

function isMessageFreshnessState(liveState?: AgentOpsLiveAgentState) {
  return Boolean(
    liveState &&
    liveState.realState === "working" &&
    liveState.source === "message"
  )
}

function createSyntheticIdleState(
  agent: Agent,
  liveState: AgentOpsLiveAgentState | undefined,
  now: Date,
  reason: string
): AgentOpsLiveAgentState {
  return {
    agentId: agent.id,
    realState: "idle",
    confidence: "weak",
    source: "none",
    reason,
    updatedAt:
      liveState?.expiresAt ??
      liveState?.updatedAt ??
      agent.updatedAt ??
      now.toISOString(),
    threadId: liveState?.threadId ?? null,
    threadSessionId: liveState?.threadSessionId ?? null,
    runtimeType: liveState?.runtimeType ?? null,
    healthStatus: liveState?.healthStatus ?? null,
    departmentId: agent.departmentId ?? liveState?.departmentId ?? null,
    contextText: liveState?.contextText ?? null,
  }
}

function latestAgentReplyState(
  agent: Agent,
  liveState: AgentOpsLiveAgentState | undefined,
  messages: Message[],
  policy: AgentOpsVisualFreshnessPolicy,
  now: Date
): AgentOpsLiveAgentState | null {
  if (!policy.agentRepliesCountAsWorking) return null
  const windowMs = policy.replyKeepsWorkingMinutes * 60 * 1000
  const candidates = [
    liveState?.source === "message" && liveState.messageId
      ? {
          id: liveState.messageId,
          threadId: liveState.threadId ?? "",
          threadSessionId: liveState.threadSessionId ?? "",
          createdAt: liveState.updatedAt,
          content: liveState.contextText ?? "",
        }
      : null,
    ...messages
      .filter((message) => {
        if (message.senderId !== agent.id) return false
        if (policy.ignoreUserManagerMessages && message.isFromUser) return false
        return true
      })
      .map((message) => ({
        id: message.id,
        threadId: message.threadId,
        threadSessionId: message.threadSessionId,
        createdAt: message.createdAt,
        content: message.content,
      })),
  ].filter(
    (
      message
    ): message is {
      id: string
      threadId: string
      threadSessionId: string
      createdAt: string
      content: string
    } => Boolean(message)
  )
  const latest = candidates
    .filter((message) => {
      const ageMs = now.getTime() - new Date(message.createdAt).getTime()
      return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= windowMs
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )[0]
  if (!latest) return null
  const ageMs = now.getTime() - new Date(latest.createdAt).getTime()
  const expiresAt = new Date(new Date(latest.createdAt).getTime() + windowMs)
  return {
    agentId: agent.id,
    realState: "working",
    confidence: "medium",
    source: "message",
    reason: `Agent replied ${formatDuration(ageMs)} ago.`,
    updatedAt: latest.createdAt,
    expiresAt: expiresAt.toISOString(),
    threadId: latest.threadId || (liveState?.threadId ?? null),
    threadSessionId:
      latest.threadSessionId || (liveState?.threadSessionId ?? null),
    messageId: latest.id,
    runtimeType: liveState?.runtimeType ?? null,
    healthStatus: liveState?.healthStatus ?? null,
    departmentId: agent.departmentId ?? liveState?.departmentId ?? null,
    contextText: latest.content.slice(0, 500),
  }
}

function resolveAssignedRoom(
  assignment: AgentOpsAgentAssignment | undefined,
  rooms: AgentOpsRoom[]
) {
  if (!assignment) return null
  return (
    rooms.find((room) => room.id === assignment.roomId) ??
    rooms.find(
      (room) =>
        assignment.departmentId && room.departmentId === assignment.departmentId
    ) ??
    rooms.find(
      (room) =>
        assignment.appId && room.applicationIds?.includes(assignment.appId)
    ) ??
    rooms.find(
      (room) =>
        assignment.workflowId &&
        room.workflowIds?.includes(assignment.workflowId)
    ) ??
    null
  )
}

function assignmentSummary(
  assignment: AgentOpsAgentAssignment,
  rooms: AgentOpsRoom[]
) {
  const room = resolveAssignedRoom(assignment, rooms)
  if (
    !assignment.roomId &&
    !assignment.departmentId &&
    !assignment.appId &&
    !assignment.workflowId
  ) {
    return "Assignment: default resolver"
  }
  return [
    room ? `room ${room.label}` : null,
    assignment.departmentId ? `department ${assignment.departmentId}` : null,
    assignment.appId ? `app ${assignment.appId}` : null,
    assignment.workflowId ? `workflow ${assignment.workflowId}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

function formatLiveStateInspector(liveState: AgentOpsLiveAgentState) {
  const ageMs = Date.now() - new Date(liveState.updatedAt).getTime()
  const expiresMs = liveState.expiresAt
    ? new Date(liveState.expiresAt).getTime() - Date.now()
    : null
  return [
    liveState.realState,
    `${liveState.confidence} confidence`,
    liveState.reason,
    Number.isFinite(ageMs) ? `updated ${formatDuration(ageMs)} ago` : null,
    expiresMs !== null && Number.isFinite(expiresMs)
      ? `expires in ${formatDuration(Math.max(0, expiresMs))}`
      : null,
  ]
    .filter(Boolean)
    .join(", ")
}

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "less than 1 minute"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`
  const hours = Math.floor(minutes / 60)
  return `${hours} hour${hours === 1 ? "" : "s"}`
}

function resolveAgentOpsGroupType(agent: Agent) {
  if (agent.groupType === "family") return "family"
  if (
    agent.groupType === "business" ||
    agent.companyId ||
    agent.departmentId ||
    agent.teamId
  ) {
    return "business"
  }
  return "personal"
}

function agentTypeSortIndex(type: ReturnType<typeof resolveAgentOpsGroupType>) {
  return type === "business" ? 0 : type === "family" ? 1 : 2
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value))
    return DEFAULT_VISUAL_FRESHNESS_POLICY.replyKeepsWorkingMinutes
  return Math.max(1, Math.min(180, Math.round(value)))
}

function loadStoredRealAgentIds(workspaceId: string) {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(`agentops.realAgents.${workspaceId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : null
  } catch {
    return null
  }
}

function loadStoredVisualFreshnessPolicy(
  workspaceId: string
): AgentOpsVisualFreshnessPolicy {
  if (typeof window === "undefined") return DEFAULT_VISUAL_FRESHNESS_POLICY
  const raw = window.localStorage.getItem(
    `agentops.visualFreshnessPolicy.${workspaceId}`
  )
  if (!raw) return DEFAULT_VISUAL_FRESHNESS_POLICY
  try {
    const parsed = JSON.parse(raw) as Partial<AgentOpsVisualFreshnessPolicy>
    return {
      ...DEFAULT_VISUAL_FRESHNESS_POLICY,
      ...parsed,
      replyKeepsWorkingMinutes: clampMinutes(
        parsed.replyKeepsWorkingMinutes ??
          DEFAULT_VISUAL_FRESHNESS_POLICY.replyKeepsWorkingMinutes
      ),
    }
  } catch {
    return DEFAULT_VISUAL_FRESHNESS_POLICY
  }
}

function loadStoredAgentAssignments(workspaceId: string) {
  if (typeof window === "undefined") return {}
  const raw = window.localStorage.getItem(
    `agentops.agentAssignments.${workspaceId}`
  )
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, AgentOpsAgentAssignment>)
      : {}
  } catch {
    return {}
  }
}
