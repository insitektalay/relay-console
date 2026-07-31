"use client"

import type { AgentOpsSimulationState } from "./domain/estate-types"
import { getSelectedEntity } from "./domain/selectors"

export function AgentOpsSelectedEntityPanel({
  state,
}: {
  state: AgentOpsSimulationState
}) {
  const selected = getSelectedEntity(state)
  if (!selected) return null

  let title = "Selected"
  let rows: Array<[string, string]> = []

  if (selected.type === "agent" && "state" in selected) {
    title = selected.profile?.displayName ?? "Agent"
    rows = [
      ["Real state", selected.state?.realState ?? "unknown"],
      ["Visible state", selected.state?.visibleState ?? "unknown"],
      ["Room", selected.state?.roomId ?? "none"],
      ["App", selected.state?.currentAppId ?? "none"],
      ["Dispatch", selected.state?.currentDispatchId ?? "none"],
      ["Assignment", selected.state?.targetRoomId ?? selected.state?.roomId ?? "none"],
      ["Confidence", selected.state?.liveConfidence ?? "unknown"],
      ["Reason", selected.state?.liveReason ?? "none"],
      ["Expires", selected.state?.liveExpiresAt ? new Date(selected.state.liveExpiresAt).toLocaleTimeString() : "none"],
    ]
  } else if (selected.type === "room" && "room" in selected && selected.room) {
    const room = selected.room
    const zone = selected.zone
    const floor = selected.floor
    title = room.label
    rows = [
      ["Status", room.status],
      ["Variant", room.currentVariantId],
      ["Zone", zone?.label ?? "unknown"],
      ["Floor", floor?.label ?? "unknown"],
      ["Apps", room.applicationIds?.join(", ") || "none"],
      ["Outputs", room.outputTypeIds?.join(", ") || "none"],
    ]
  } else if ("entity" in selected && selected.entity) {
    const entity = selected.entity as unknown as Record<string, unknown>
    title = String(entity.label ?? entity.id ?? entity.appId ?? "Entity")
    rows = Object.entries(entity)
      .filter(([, value]) => typeof value === "string" || Array.isArray(value))
      .slice(0, 8)
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") || "none" : String(value),
      ])
  }

  return (
    <div className="absolute right-3 bottom-3 z-10 w-[340px] rounded-[4px] border border-white/10 bg-[#111922]/92 p-3 shadow-xl backdrop-blur">
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <div className="mt-3 space-y-1.5">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[96px_1fr] gap-3 text-xs leading-5"
          >
            <div className="text-zinc-500">{label}</div>
            <div className="truncate text-zinc-200">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
