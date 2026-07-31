"use client"

import { useEffect, useRef } from "react"
import type {
  AgentOpsLayoutEditorState,
  AgentOpsLayoutPathPatch,
  AgentOpsLayoutRoomPatch,
  AgentOpsPoint,
  AgentOpsRenderSnapshot,
} from "./domain/estate-types"
import { AgentOpsPixiRenderer } from "./pixi/agent-ops-pixi-renderer"

export function AgentOpsEstateStage({
  snapshot,
  editor,
  onSelect,
  onRoomPatch,
  onPathPatch,
  onPathSelect,
  onPathAddPoint,
  onAnchorSelect,
  onMouseWorldChange,
  onViewportChange,
}: {
  snapshot: AgentOpsRenderSnapshot
  editor: AgentOpsLayoutEditorState
  onSelect: (type: "agent" | "room", id: string) => void
  onRoomPatch: (patch: AgentOpsLayoutRoomPatch) => void
  onPathPatch: (patch: AgentOpsLayoutPathPatch) => void
  onPathSelect: (item: AgentOpsLayoutEditorState["selectedPathItem"], connectFromId?: string | null) => void
  onPathAddPoint: (point: AgentOpsPoint) => void
  onAnchorSelect: (anchor: NonNullable<AgentOpsLayoutEditorState["selectedAnchor"]>) => void
  onMouseWorldChange: (point: AgentOpsPoint | null) => void
  onViewportChange: (viewport: { scale: number; pan: AgentOpsPoint }) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<AgentOpsPixiRenderer | null>(null)
  const onSelectRef = useRef(onSelect)
  const onRoomPatchRef = useRef(onRoomPatch)
  const onPathPatchRef = useRef(onPathPatch)
  const onPathSelectRef = useRef(onPathSelect)
  const onPathAddPointRef = useRef(onPathAddPoint)
  const onAnchorSelectRef = useRef(onAnchorSelect)
  const onMouseWorldChangeRef = useRef(onMouseWorldChange)
  const onViewportChangeRef = useRef(onViewportChange)
  const latestSnapshotRef = useRef(snapshot)
  const latestEditorRef = useRef(editor)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    onRoomPatchRef.current = onRoomPatch
  }, [onRoomPatch])

  useEffect(() => {
    onPathPatchRef.current = onPathPatch
  }, [onPathPatch])

  useEffect(() => {
    onPathSelectRef.current = onPathSelect
  }, [onPathSelect])

  useEffect(() => {
    onPathAddPointRef.current = onPathAddPoint
  }, [onPathAddPoint])

  useEffect(() => {
    onAnchorSelectRef.current = onAnchorSelect
  }, [onAnchorSelect])

  useEffect(() => {
    onMouseWorldChangeRef.current = onMouseWorldChange
  }, [onMouseWorldChange])

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange
  }, [onViewportChange])

  useEffect(() => {
    latestSnapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    latestEditorRef.current = editor
  }, [editor])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    const renderer = new AgentOpsPixiRenderer({
      onSelect: (type, id) => onSelectRef.current(type, id),
      onRoomPatch: (patch) => onRoomPatchRef.current(patch),
      onPathPatch: (patch) => onPathPatchRef.current(patch),
      onPathSelect: (item, connectFromId) => onPathSelectRef.current(item, connectFromId),
      onPathAddPoint: (point) => onPathAddPointRef.current(point),
      onAnchorSelect: (anchor) => onAnchorSelectRef.current(anchor),
      onMouseWorldChange: (point) => onMouseWorldChangeRef.current(point),
      onViewportChange: (viewport) => onViewportChangeRef.current(viewport),
    })
    rendererRef.current = renderer
    void renderer.mount(container).then(() => {
      if (cancelled) return
      renderer.updateEditor(latestEditorRef.current)
      renderer.update(latestSnapshotRef.current)
      requestAnimationFrame(() => {
        if (!cancelled) renderer.resize()
      })
    })
    return () => {
      cancelled = true
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    rendererRef.current?.update(snapshot)
  }, [snapshot])

  useEffect(() => {
    rendererRef.current?.updateEditor(editor)
  }, [editor])

  useEffect(() => {
    const handle = () => rendererRef.current?.resize()
    window.addEventListener("resize", handle)
    const observer =
      typeof ResizeObserver !== "undefined" && containerRef.current
        ? new ResizeObserver(() => rendererRef.current?.resize())
        : null
    if (containerRef.current) observer?.observe(containerRef.current)
    requestAnimationFrame(handle)
    return () => {
      window.removeEventListener("resize", handle)
      observer?.disconnect()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-full min-h-0 w-full overflow-hidden bg-[#101820]"
    />
  )
}
