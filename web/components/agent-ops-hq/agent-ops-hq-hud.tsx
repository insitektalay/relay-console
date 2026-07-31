"use client"

import Image from "next/image"
import { X } from "lucide-react"
import type { AgentOpsSimulationState } from "./domain/estate-types"

export function AgentOpsHqHud({
  state,
  statusOpen,
  onFloorChange,
  onStatusClose,
}: {
  state: AgentOpsSimulationState
  statusOpen: boolean
  onFloorChange: (buildingId: string, floorId: string) => void
  onStatusClose: () => void
}) {
  const building = state.layout.buildings.find(
    (entry) => entry.id === state.activeBuildingId
  )
  const agents = Object.values(state.agents)
  const activeAgents = agents.filter((agent) =>
    ["queued", "working", "thinking", "tooling"].includes(agent.realState)
  ).length
  const approvals = agents.filter(
    (agent) => agent.realState === "waiting_for_approval"
  ).length
  const errors = agents.filter((agent) => agent.realState === "error").length

  return (
    <div className="pointer-events-none absolute top-3 right-3 left-3 z-10 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
        <Image
          src="/brand/relay-console-logo.png"
          alt="Relay Console"
          width={34}
          height={34}
          className="size-8 shrink-0"
          priority
        />
        <span className="claw-title-pane text-white">Relay Console</span>
      </div>
      {statusOpen ? (
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-[4px] border border-white/10 bg-[#111922]/90 px-2 py-2 shadow-xl backdrop-blur">
          <select
            className="h-8 rounded-[4px] border border-white/10 bg-transparent px-2 text-xs text-zinc-200"
            value={state.activeFloorId}
            onChange={(event) =>
              onFloorChange(state.activeBuildingId, event.target.value)
            }
          >
            {building?.floors
              .slice()
              .sort((a, b) => b.level - a.level)
              .map((floor) => (
                <option key={floor.id} value={floor.id}>
                  L{floor.level} · {floor.label}
                </option>
              ))}
          </select>
          <HudStat label="Active" value={activeAgents} />
          <HudStat label="Approvals" value={approvals} />
          <HudStat
            label="Errors"
            value={errors}
            tone={errors ? "error" : "default"}
          />
          <HudStat label="Mode" value={state.mode} />
          <button
            type="button"
            title="Hide AgentOps status"
            className="flex size-8 items-center justify-center rounded-[4px] border border-white/10 text-zinc-400 transition hover:bg-white/[0.075] hover:text-zinc-100"
            onClick={onStatusClose}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function HudStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string | number
  tone?: "default" | "error"
}) {
  return (
    <div className="min-w-16 rounded-[4px] border border-white/10 bg-white/[0.035] px-2 py-1">
      <div className="text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
        {label}
      </div>
      <div
        className={`text-xs font-semibold ${
          tone === "error" ? "text-rose-300" : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  )
}
