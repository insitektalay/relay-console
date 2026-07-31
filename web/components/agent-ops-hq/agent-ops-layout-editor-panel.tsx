"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Copy, GripHorizontal, Minimize2, RotateCcw, Save, X } from "lucide-react"
import type {
  AgentOpsEditableAnchorGroup,
  AgentOpsLayoutEditorState,
  AgentOpsPathTag,
  AgentOpsPoint,
  AgentOpsSimulationState,
} from "./domain/estate-types"
import { exportFloorLayoutJson, getRoomAnchorPosition } from "./domain/layout-editor"
import { findRoom } from "./domain/location-resolver"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const EDITOR_PANEL_POSITION_KEY = "clawchat.agentOpsHq.layoutEditorPanelPosition.v1"
const ANCHOR_TYPES: Array<{
  group: AgentOpsEditableAnchorGroup
  label: string
  color: string
  symbol: string
}> = [
  { group: "entryAnchors", label: "Entry", color: "bg-amber-500", symbol: "◆" },
  { group: "workstations", label: "Desk", color: "bg-emerald-500", symbol: "▰" },
  { group: "screenAnchors", label: "Screen", color: "bg-sky-400", symbol: "▭" },
  { group: "idleAnchors", label: "Idle", color: "bg-violet-400", symbol: "●" },
  { group: "lightAnchors", label: "Light", color: "bg-yellow-300", symbol: "✦" },
]
const PATH_TAGS: AgentOpsPathTag[] = ["main", "idle", "room_entry", "outside", "social", "restricted"]
const PATH_LEGEND: Array<{ label: string; className: string }> = [
  { label: "main", className: "bg-zinc-100" },
  { label: "idle", className: "bg-sky-400" },
  { label: "main + idle", className: "bg-cyan-300" },
  { label: "room entry", className: "bg-amber-500" },
  { label: "outside", className: "bg-emerald-400" },
  { label: "social", className: "bg-violet-400" },
  { label: "restricted", className: "bg-rose-400" },
]

export function AgentOpsLayoutEditorPanel({
  state,
  editor,
  mouseWorld,
  hasLocalOverride,
  onEditorChange,
  onCopyExport,
  onSaveLocal,
  onReset,
  onExit,
  onAddPathWaypoint,
  onDeleteSelectedPathItem,
  onSetSelectedPathTags,
  onAddAnchor,
  onDeleteSelectedAnchor,
}: {
  state: AgentOpsSimulationState
  editor: AgentOpsLayoutEditorState
  mouseWorld: AgentOpsPoint | null
  hasLocalOverride: boolean
  onEditorChange: (editor: Partial<AgentOpsLayoutEditorState>) => void
  onCopyExport: () => void
  onSaveLocal: () => void
  onReset: () => void
  onExit: () => void
  onAddPathWaypoint: () => void
  onDeleteSelectedPathItem: () => void
  onSetSelectedPathTags: (tags: AgentOpsPathTag[]) => void
  onAddAnchor: (group: AgentOpsEditableAnchorGroup) => void
  onDeleteSelectedAnchor: () => void
}) {
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [position, setPosition] = useState(() => loadPanelPosition())

  useEffect(() => {
    if (!editor.enabled) return
    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const next = clampPanelPosition({
        x: drag.x + event.clientX - drag.startX,
        y: drag.y + event.clientY - drag.startY,
      })
      setPosition(next)
      savePanelPosition(next)
    }
    function handlePointerUp() {
      if (!dragRef.current) return
      dragRef.current = null
    }
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [editor.enabled])

  if (!editor.enabled) return null
  const room = findRoom(state.layout, editor.selectedRoomId)
  const activeFloor = state.layout.buildings.flatMap((building) => building.floors).find((floor) => floor.id === state.activeFloorId)
  const selectedPath =
    editor.selectedPathItem?.type === "waypoint"
      ? activeFloor?.pathNetwork?.waypoints.find((entry) => entry.id === editor.selectedPathItem?.id)
      : activeFloor?.pathNetwork?.edges.find((entry) => entry.id === editor.selectedPathItem?.id)
  const selectedAnchorRoom = findRoom(state.layout, editor.selectedAnchor?.roomId)
  const selectedAnchorPosition = getRoomAnchorPosition(
    selectedAnchorRoom,
    editor.selectedAnchor?.group,
    editor.selectedAnchor?.index
  )
  const exportJson = exportFloorLayoutJson(state.layout, state.activeFloorId)

  function beginDrag(event: ReactPointerEvent) {
    event.preventDefault()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: position.x,
      y: position.y,
    }
  }

  if (collapsed) {
    return (
      <div
        className="absolute z-40 rounded-[4px] border border-amber-200/25 bg-[#111922]/94 shadow-xl backdrop-blur"
        style={{ left: position.x, top: position.y }}
      >
        <div className="flex items-center gap-1 p-1">
          <button
            type="button"
            className="flex size-7 cursor-move items-center justify-center rounded-[4px] text-zinc-400 hover:bg-white/[0.075]"
            onPointerDown={beginDrag}
            title="Move editor panel"
          >
            <GripHorizontal className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-[4px] px-2 py-1 text-xs font-semibold text-amber-100 hover:bg-white/[0.075]"
            onClick={() => setCollapsed(false)}
          >
            Layout Editor
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-[4px] text-zinc-400 hover:bg-white/[0.075]"
            onClick={onExit}
            title="Exit edit mode"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute z-40 flex max-h-[calc(100%-2rem)] w-[360px] flex-col overflow-hidden rounded-[4px] border border-amber-200/20 bg-[#111922]/94 shadow-xl backdrop-blur"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="cursor-move border-b border-white/10 px-3 py-2.5"
        onPointerDown={beginDrag}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-amber-100">Layout Editor</div>
            <div className="text-xs text-zinc-400">
              Coordinates are image pixels on {state.activeFloorId}.
            </div>
          </div>
          <div className="text-right text-[11px] text-zinc-500">
            {mouseWorld ? `${mouseWorld.x}, ${mouseWorld.y}` : "No cursor"}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-[4px] text-zinc-400 hover:bg-white/[0.075]"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setCollapsed(true)}
              title="Collapse editor"
            >
              <Minimize2 className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-[4px] text-zinc-400 hover:bg-white/[0.075]"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onExit}
              title="Exit edit mode"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          <ToggleButton
            label="Snap grid"
            active={editor.snapToGrid}
            onClick={() => onEditorChange({ snapToGrid: !editor.snapToGrid })}
          />
          <ToggleButton
            label="Labels"
            active={editor.showLabels}
            onClick={() => onEditorChange({ showLabels: !editor.showLabels })}
          />
        </div>
        <div className="rounded-[4px] border border-white/10 bg-black/18 p-2">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Path Network
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <ToggleButton
              label="Edit paths"
              active={editor.pathEditing}
              onClick={() =>
                onEditorChange({
                  pathEditing: !editor.pathEditing,
                  showPathNetwork: !editor.pathEditing || editor.showPathNetwork,
                  pathAddMode: editor.pathEditing ? false : editor.pathAddMode,
                })
              }
            />
            <ToggleButton
              label="Show paths"
              active={editor.showPathNetwork}
              onClick={() => onEditorChange({ showPathNetwork: !editor.showPathNetwork })}
            />
          </div>
          <div className="mt-2 rounded-[4px] border border-sky-300/10 bg-sky-300/[0.045] px-2 py-1.5 text-[11px] leading-4 text-zinc-300">
            Select tags, turn on Add on map, then click the map to place points. To draw a line, select a point, click Connect from this, then click waypoints in sequence.
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <ToggleButton
              label="Add on map"
              active={editor.pathAddMode}
              onClick={() =>
                onEditorChange({
                  pathAddMode: !editor.pathAddMode,
                  pathEditing: true,
                  showPathNetwork: true,
                })
              }
            />
            <Button size="sm" variant="secondary" onClick={onAddPathWaypoint} disabled={!mouseWorld}>
              Add at cursor
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {PATH_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`rounded-[4px] border px-1.5 py-1 text-[11px] ${
                  editor.activePathTags.includes(tag)
                    ? "border-sky-300/30 bg-sky-300/10 text-sky-100"
                    : "border-white/5 text-zinc-500"
                }`}
                onClick={() =>
                  onEditorChange({
                    activePathTags: toggleTag(editor.activePathTags, tag),
                  })
                }
              >
                {tag.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-[4px] border border-white/5 bg-black/14 px-2 py-1.5 text-[10px] text-zinc-400">
            {PATH_LEGEND.map((entry) => (
              <div key={entry.label} className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-5 rounded-full ${entry.className}`} />
                {entry.label}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={editor.selectedAnchor ? onDeleteSelectedAnchor : onDeleteSelectedPathItem}
              disabled={!editor.selectedAnchor && !editor.selectedPathItem}
            >
              {editor.selectedAnchor
                ? "Delete selected anchor"
                : editor.selectedPathItem?.type === "edge"
                  ? "Disconnect edge"
                  : "Delete selected"}
            </Button>
          </div>
          {selectedPath ? (
            <div className="mt-2 rounded-[4px] border border-white/10 p-2 text-xs text-zinc-400">
              <div className="font-mono text-[11px] text-zinc-300">
                {editor.selectedPathItem?.type}:{editor.selectedPathItem?.id}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {PATH_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`rounded-[4px] border px-1 py-0.5 text-[10px] ${
                      selectedPath.tags.includes(tag)
                        ? "border-amber-200/30 bg-amber-200/10 text-amber-100"
                        : "border-white/5 text-zinc-500"
                    }`}
                    onClick={() => onSetSelectedPathTags(toggleTag(selectedPath.tags, tag))}
                  >
                    {tag.replace("_", " ")}
                  </button>
                ))}
              </div>
              {editor.selectedPathItem?.type === "waypoint" ? (
                <Button
                  className="mt-2 w-full"
                  size="sm"
                  variant={editor.pathConnectFromId === editor.selectedPathItem.id ? "secondary" : "ghost"}
                  onClick={() =>
                    onEditorChange({
                      pathConnectFromId:
                        editor.pathConnectFromId === editor.selectedPathItem?.id
                          ? null
                          : editor.selectedPathItem?.id ?? null,
                    })
                  }
                >
                  {editor.pathConnectFromId === editor.selectedPathItem.id ? "Stop connecting" : "Connect from this"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="rounded-[4px] border border-white/10 bg-black/18 p-2">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Anchor Visibility
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ANCHOR_TYPES.map((type) => (
              <button
                key={type.group}
                type="button"
                className={`flex items-center justify-between rounded-[4px] border px-2 py-1.5 text-xs ${
                  editor.anchorVisibility[type.group]
                    ? "border-white/15 bg-white/[0.075] text-zinc-100"
                    : "border-white/5 text-zinc-500"
                }`}
                onClick={() =>
                  onEditorChange({
                    anchorVisibility: {
                      ...editor.anchorVisibility,
                      [type.group]: !editor.anchorVisibility[type.group],
                    },
                  })
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${type.color}`} />
                  {type.label}
                </span>
                <span>{type.symbol}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-white/10 pt-2">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Add Anchor At Cursor
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {ANCHOR_TYPES.map((type) => (
                <Button
                  key={type.group}
                  size="sm"
                  variant="secondary"
                  onClick={() => onAddAnchor(type.group)}
                  disabled={!room || !mouseWorld}
                >
                  <span className={`mr-1.5 size-2 rounded-full ${type.color}`} />
                  {type.label}
                </Button>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] leading-4 text-zinc-500">
              Select a room, move the mouse to the target position, then add the anchor type you need.
            </div>
          </div>
        </div>
        <label className="block text-xs text-zinc-400">
          Overlay opacity
          <Input
            className="mt-1"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={editor.roomOverlayAlpha}
            onChange={(event) =>
              onEditorChange({
                roomOverlayAlpha: Math.max(
                  0,
                  Math.min(1, Number(event.target.value) || 0)
                ),
              })
            }
          />
        </label>
        {room ? (
          <div className="rounded-[4px] border border-white/10 bg-black/18 p-3">
            <div className="text-xs font-semibold text-zinc-100">{room.label}</div>
            <div className="mt-1 font-mono text-[11px] text-zinc-500">{room.id}</div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              <Metric label="x" value={room.bounds.x} />
              <Metric label="y" value={room.bounds.y} />
              <Metric label="w" value={room.bounds.width} />
              <Metric label="h" value={room.bounds.height} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
              <Metric label="variant" value={room.currentVariantId} />
              <Metric label="capacity" value={room.capacity} />
              <Metric label="desks" value={room.workstations.length} />
              <Metric label="screens" value={room.screenAnchors.length} />
              <Metric label="entries" value={room.entryAnchors.length} />
              <Metric label="idle" value={room.idleAnchors.length} />
              <Metric label="lights" value={room.lightAnchors.length} />
            </div>
          </div>
        ) : (
          <div className="rounded-[4px] border border-white/10 bg-black/18 p-3 text-sm text-zinc-400">
            Select a room rectangle to edit bounds and anchors.
          </div>
        )}
        {editor.selectedAnchor && selectedAnchorRoom && selectedAnchorPosition ? (
          <div className="rounded-[4px] border border-amber-200/20 bg-amber-200/[0.06] p-3">
            <div className="text-xs font-semibold text-amber-100">
              Selected Anchor
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <Metric label="type" value={anchorLabel(editor.selectedAnchor.group)} />
              <Metric label="index" value={editor.selectedAnchor.index} />
              <Metric label="x" value={selectedAnchorPosition.x} />
              <Metric label="y" value={selectedAnchorPosition.y} />
            </div>
            <div className="mt-2 text-[11px] text-zinc-400">
              Room: <span className="text-zinc-200">{selectedAnchorRoom.label}</span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-zinc-500">
              {selectedAnchorRoom.id}:{editor.selectedAnchor.group}:{editor.selectedAnchor.index}
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              Arrow keys nudge 1px. Shift + arrow nudges 10px.
            </div>
            <Button
              className="mt-2 w-full"
              size="sm"
              variant="destructive"
              onClick={onDeleteSelectedAnchor}
            >
              Delete selected anchor
            </Button>
          </div>
        ) : null}
        <textarea
          className="h-44 w-full resize-none rounded-[4px] border border-white/10 bg-black/28 p-2 font-mono text-[11px] leading-4 text-zinc-300 outline-none"
          readOnly
          value={exportJson}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 border-t border-white/10 p-3">
        <Button size="sm" variant="secondary" onClick={onCopyExport}>
          <Copy className="mr-1.5 size-3.5" />
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onSaveLocal}>
          <Save className="mr-1.5 size-3.5" />
          Save
        </Button>
        <Button size="sm" variant={hasLocalOverride ? "destructive" : "ghost"} onClick={onReset}>
          <RotateCcw className="mr-1.5 size-3.5" />
          Reset
        </Button>
        <Button size="sm" variant="ghost" onClick={onExit}>
          <X className="mr-1.5 size-3.5" />
          Exit
        </Button>
      </div>
    </div>
  )
}

function anchorLabel(group: AgentOpsEditableAnchorGroup) {
  return ANCHOR_TYPES.find((entry) => entry.group === group)?.label ?? group
}

function toggleTag<T extends string>(tags: T[], tag: T) {
  return tags.includes(tag)
    ? tags.filter((entry) => entry !== tag)
    : [...tags, tag]
}

function loadPanelPosition() {
  if (typeof window === "undefined") return { x: 24, y: 24 }
  try {
    const stored = window.localStorage.getItem(EDITOR_PANEL_POSITION_KEY)
    if (!stored) return { x: 24, y: 24 }
    return clampPanelPosition(JSON.parse(stored) as { x: number; y: number })
  } catch {
    return { x: 24, y: 24 }
  }
}

function savePanelPosition(position: { x: number; y: number }) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(EDITOR_PANEL_POSITION_KEY, JSON.stringify(position))
}

function clampPanelPosition(position: { x: number; y: number }) {
  if (typeof window === "undefined") return position
  return {
    x: Math.max(8, Math.min(window.innerWidth - 72, Math.round(position.x))),
    y: Math.max(8, Math.min(window.innerHeight - 48, Math.round(position.y))),
  }
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`rounded-[4px] border px-2 py-1.5 text-xs ${
        active
          ? "border-amber-200/35 bg-amber-200/10 text-amber-100"
          : "border-white/10 text-zinc-400 hover:bg-white/[0.075]"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">{label}</div>
      <div className="truncate font-mono text-zinc-300">{value}</div>
    </div>
  )
}
