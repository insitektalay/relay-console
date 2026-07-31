"use client"

import { Search, Target, Bug, Play, Radio } from "lucide-react"
import type {
  AgentOpsEntityType,
  AgentOpsEventHistoryItem,
  AgentOpsLayoutEditorState,
  AgentOpsSimulationState,
} from "./domain/estate-types"
import type { AgentOpsLivestreamSettings } from "./livestream/livestream-types"
import { searchAgentOpsEntities } from "./domain/selectors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

export function AgentOpsHqSidebar({
  state,
  editor,
  onModeChange,
  onSearchChange,
  onSelect,
  onJumpActive,
  onInjectMock,
  onTriggerGapMinerWork,
  onTriggerGapMinerApproval,
  onTriggerGapMinerError,
  onDebugChange,
  onEditorChange,
  livestream,
  onLivestreamChange,
  debugControlsEnabled,
}: {
  state: AgentOpsSimulationState
  editor: AgentOpsLayoutEditorState
  onModeChange: (mode: "live" | "mock") => void
  onSearchChange: (query: string) => void
  onSelect: (type: AgentOpsEntityType, id: string) => void
  onJumpActive: () => void
  onInjectMock: () => void
  onTriggerGapMinerWork: (agentCount: number) => void
  onTriggerGapMinerApproval: () => void
  onTriggerGapMinerError: () => void
  onDebugChange: (debug: Partial<AgentOpsSimulationState["debug"]>) => void
  onEditorChange: (editor: Partial<AgentOpsLayoutEditorState>) => void
  livestream: AgentOpsLivestreamSettings
  onLivestreamChange: (settings: Partial<AgentOpsLivestreamSettings>) => void
  debugControlsEnabled: boolean
}) {
  const results = searchAgentOpsEntities(state, state.searchQuery)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-3 py-2.5">
        <div className="claw-title-pane font-semibold tracking-[-0.02em]">
          AgentOps HQ
        </div>
        <div className="mt-1 text-sm leading-5 text-zinc-400">
          Living estate map for agents, apps, properties, outputs, and workflows.
        </div>
      </div>
      <div className="space-y-3 border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-2.5">
        {debugControlsEnabled ? (
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant={state.mode === "mock" ? "secondary" : "ghost"}
              onClick={() => onModeChange("mock")}
            >
              <Play className="mr-1.5 size-3.5" />
              Mock
            </Button>
            <Button
              size="sm"
              variant={state.mode === "live" ? "secondary" : "ghost"}
              onClick={() => onModeChange("live")}
            >
              <Radio className="mr-1.5 size-3.5" />
              Live
            </Button>
          </div>
        ) : (
          <div className="rounded-[4px] border border-emerald-300/20 bg-emerald-300/10 px-2 py-1.5 text-xs font-medium text-emerald-100">
            Live mode
          </div>
        )}
        <Button className="w-full" size="sm" variant="secondary" onClick={onJumpActive}>
          <Target className="mr-1.5 size-3.5" />
          Jump to active work
        </Button>
        {debugControlsEnabled && state.mode === "mock" ? (
          <Button className="w-full" size="sm" variant="ghost" onClick={onInjectMock}>
            Inject mock event
          </Button>
        ) : null}
        <div className="space-y-1.5 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] p-2">
          <div className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Livestream
          </div>
          <ToggleRow
            label="Livestream Mode"
            active={livestream.enabled}
            onClick={() => onLivestreamChange({ enabled: !livestream.enabled })}
          />
          <ToggleRow
            label="Comedy Mode"
            active={livestream.comedyMode}
            disabled={!livestream.enabled}
            onClick={() => onLivestreamChange({ comedyMode: !livestream.comedyMode })}
          />
          <ToggleRow
            label="Boss Cursor"
            active={livestream.bossVisible}
            disabled={!livestream.enabled}
            onClick={() => onLivestreamChange({ bossVisible: !livestream.bossVisible })}
          />
          <div className="rounded-[4px] bg-black/16 px-2 py-1.5 text-[11px] leading-4 text-zinc-500">
            Hotkeys: 1 approve · 2 back to work · 3 coffee · 4 panic · 5 complete · 6 hide/show.
          </div>
        </div>
        {debugControlsEnabled && state.mode === "mock" ? (
          <div className="space-y-1.5 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] p-2">
            <div className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
              GapMiner Pilot
            </div>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-[4px] px-2 py-1.5 text-xs text-zinc-400 hover:bg-[var(--claw-bg-surface)]"
              onClick={() =>
                onDebugChange({
                  gapMinerPilotOnly: !state.debug.gapMinerPilotOnly,
                })
              }
            >
              <span>Only GapMiner agents</span>
              <span>{state.debug.gapMinerPilotOnly ? "On" : "Off"}</span>
            </button>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((count) => (
                <Button
                  key={count}
                  size="sm"
                  variant={count === 1 ? "secondary" : "ghost"}
                  onClick={() => onTriggerGapMinerWork(count)}
                >
                  {count} agent{count > 1 ? "s" : ""}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant="ghost" onClick={onTriggerGapMinerApproval}>
                Approval
              </Button>
              <Button size="sm" variant="ghost" onClick={onTriggerGapMinerError}>
                Error
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-[var(--claw-text-muted)]" />
          <Input
            className="pl-9"
            placeholder="Search app, website, agent..."
            value={state.searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        {results.length ? (
          <div className="mt-2 max-h-52 space-y-1 overflow-auto">
            {results.map((result) => (
              <button
                key={`${result.type}:${result.id}`}
                type="button"
                className="w-full rounded-[4px] border border-transparent px-2 py-1.5 text-left text-xs hover:border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] hover:bg-[var(--claw-bg-surface)]"
                onClick={() => onSelect(result.type, result.id)}
              >
                <div className="font-semibold text-[var(--claw-text-primary)]">
                  {result.label}
                </div>
                <div className="truncate text-[var(--claw-text-muted)]">
                  {result.type.replace(/_/g, " ")} · {result.meta}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ScrollArea className="mission-scrollbar min-h-0 flex-1">
        <div className="space-y-2 p-2.5">
          <div className="claw-kicker px-1 font-medium tracking-[0.18em] text-zinc-500 uppercase">
            Event Feed
          </div>
          {state.eventHistory.length ? (
            state.eventHistory.slice(0, 40).map((event) => (
              <EventFeedItem key={event.id} event={event} />
            ))
          ) : (
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] p-3 text-sm text-zinc-500">
              Waiting for AgentOps activity.
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-2.5">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-[4px] px-2 py-1.5 text-xs text-zinc-400 hover:bg-[var(--claw-bg-surface)]"
          onClick={() => onDebugChange({ showBounds: !state.debug.showBounds })}
        >
          <span className="inline-flex items-center gap-1.5">
            <Bug className="size-3.5" />
            Bounds
          </span>
          <span>{state.debug.showBounds ? "On" : "Off"}</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-[4px] px-2 py-1.5 text-xs text-zinc-400 hover:bg-[var(--claw-bg-surface)]"
          onClick={() => onDebugChange({ showPaths: !state.debug.showPaths })}
        >
          <span>Paths</span>
          <span>{state.debug.showPaths ? "On" : "Off"}</span>
        </button>
        <button
          type="button"
          className={`mt-1 flex w-full items-center justify-between rounded-[4px] px-2 py-1.5 text-xs hover:bg-[var(--claw-bg-surface)] ${
            editor.enabled ? "text-amber-200" : "text-zinc-400"
          }`}
          onClick={() => onEditorChange({ enabled: !editor.enabled })}
        >
          <span>Edit Layout</span>
          <span>{editor.enabled ? "On" : "Off"}</span>
        </button>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-[4px] px-2 py-1.5 text-xs text-zinc-400 hover:bg-[var(--claw-bg-surface)] disabled:cursor-not-allowed disabled:opacity-45"
      onClick={onClick}
    >
      <span>{label}</span>
      <span className={active ? "text-fuchsia-200" : "text-zinc-500"}>{active ? "On" : "Off"}</span>
    </button>
  )
}

function EventFeedItem({ event }: { event: AgentOpsEventHistoryItem }) {
  const color =
    event.severity === "error"
      ? "text-rose-300"
      : event.severity === "warning"
        ? "text-amber-300"
        : event.severity === "success"
          ? "text-emerald-300"
          : event.severity === "revenue"
            ? "text-yellow-200"
            : "text-blue-200"
  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-2">
      <div className={`text-xs font-semibold ${color}`}>{event.title}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-4 text-zinc-400">
        {event.summary ?? event.type}
      </div>
    </div>
  )
}
