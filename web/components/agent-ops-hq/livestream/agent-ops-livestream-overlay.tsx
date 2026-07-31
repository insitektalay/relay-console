"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AgentOpsAgentState, AgentOpsEventHistoryItem, AgentOpsPoint, AgentOpsRenderSnapshot } from "../domain/estate-types"
import { AGENTOPS_LIVESTREAM_CONFIG, getBossActionConfig } from "./livestream-config"
import type {
  AgentOpsAgentBubble,
  AgentOpsBossActionId,
  AgentOpsBossEffect,
  AgentOpsLivestreamSettings,
  AgentOpsViewportTransform,
} from "./livestream-types"
import { useAgentOpsHotkeys } from "./use-agent-ops-hotkeys"

export function AgentOpsLivestreamOverlay({
  snapshot,
  settings,
  cursor,
  viewport,
  onSettingsChange,
}: {
  snapshot: AgentOpsRenderSnapshot
  settings: AgentOpsLivestreamSettings
  cursor: AgentOpsPoint | null
  viewport: AgentOpsViewportTransform
  onSettingsChange: (settings: Partial<AgentOpsLivestreamSettings>) => void
}) {
  const [bossEffects, setBossEffects] = useState<AgentOpsBossEffect[]>([])
  const [agentBubbles, setAgentBubbles] = useState<AgentOpsAgentBubble[]>([])
  const seenEventsRef = useRef<Set<string>>(new Set())
  const agentCooldownsRef = useRef<Record<string, number>>({})
  const latestCursorRef = useRef<AgentOpsPoint>({ x: 140, y: 140 })
  const latestSnapshotRef = useRef(snapshot)
  const latestSettingsRef = useRef(settings)

  useEffect(() => {
    latestSnapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    latestSettingsRef.current = settings
  }, [settings])

  useEffect(() => {
    if (cursor) latestCursorRef.current = cursor
  }, [cursor])

  const triggerBossAction = useCallback((actionId: AgentOpsBossActionId) => {
    if (actionId === "boss.toggleVisible") {
      onSettingsChange({ bossVisible: !latestSettingsRef.current.bossVisible })
      return
    }
    const action = getBossActionConfig(actionId)
    if (!action) return
    const now = Date.now()
    const effect: AgentOpsBossEffect = {
      id: `boss:${actionId}:${now}`,
      actionId,
      phrase: action.phrase,
      kind: action.kind,
      position: latestCursorRef.current,
      createdAt: now,
      expiresAt: now + action.durationMs,
    }
    setBossEffects((current) =>
      [...current, effect]
        .filter((entry) => entry.expiresAt > now)
        .slice(-AGENTOPS_LIVESTREAM_CONFIG.limits.maxBossEffects)
    )
  }, [onSettingsChange])

  const canShowAgentBubble = useCallback((agentId: string, now: number) => {
    return (agentCooldownsRef.current[agentId] ?? 0) <= now
  }, [])

  const addAgentBubble = useCallback((
    agentId: string,
    phrase: string,
    kind: AgentOpsAgentBubble["kind"],
    now: number,
    ttlMs: number
  ) => {
    agentCooldownsRef.current[agentId] = now + AGENTOPS_LIVESTREAM_CONFIG.limits.agentBubbleCooldownMs
    const bubble: AgentOpsAgentBubble = {
      id: `agent:${agentId}:${now}`,
      agentId,
      phrase,
      kind,
      createdAt: now,
      expiresAt: now + ttlMs,
    }
    setAgentBubbles((current) =>
      [...current, bubble]
        .filter((entry) => entry.expiresAt > now)
        .slice(-AGENTOPS_LIVESTREAM_CONFIG.limits.maxAgentBubbles)
    )
  }, [])

  const addAgentBubbleForEvent = useCallback((agent: AgentOpsAgentState, event: AgentOpsEventHistoryItem, now: number) => {
    const rule = AGENTOPS_LIVESTREAM_CONFIG.agentPhraseRules.find((entry) =>
      entry.eventTypes?.includes(event.type)
    )
    if (!rule || !canShowAgentBubble(agent.agentId, now)) return
    addAgentBubble(agent.agentId, pick(rule.phrases, `${event.id}:${agent.agentId}`), rule.kind, now, rule.ttlMs)
  }, [addAgentBubble, canShowAgentBubble])

  const phraseForAgent = useCallback((agent: AgentOpsAgentState, now: number) => {
    const rule = AGENTOPS_LIVESTREAM_CONFIG.agentPhraseRules.find((entry) =>
      entry.realStates?.includes(agent.realState) || entry.visibleStates?.includes(agent.visibleState)
    )
    return pick(rule?.phrases ?? AGENTOPS_LIVESTREAM_CONFIG.idleChatterPhrases, `${agent.agentId}:${now}`)
  }, [])

  useAgentOpsHotkeys({ enabled: settings.enabled, onAction: triggerBossAction })

  useEffect(() => {
    if (!settings.enabled) {
      const clearTimer = window.setTimeout(() => {
        setBossEffects([])
        setAgentBubbles([])
      }, 0)
      return () => window.clearTimeout(clearTimer)
    }
    const timer = window.setInterval(() => {
      const now = Date.now()
      setBossEffects((current) => current.filter((effect) => effect.expiresAt > now))
      setAgentBubbles((current) => current.filter((bubble) => bubble.expiresAt > now))
    }, 500)
    return () => window.clearInterval(timer)
  }, [settings.enabled])

  useEffect(() => {
    if (!settings.enabled) return
    const now = Date.now()
    const nextEvents = snapshot.events
      .slice(0, 8)
      .filter((event) => !seenEventsRef.current.has(event.id))
      .reverse()
    if (!nextEvents.length) return
    const timer = window.setTimeout(() => {
      for (const event of nextEvents) {
        seenEventsRef.current.add(event.id)
        const agent = event.agentId ? snapshot.agents.find((entry) => entry.agentId === event.agentId) : null
        if (agent) addAgentBubbleForEvent(agent, event, now)
        if (event.type === "agent.error") triggerBossAction("boss.panic")
        if (event.type === "agent.waiting_for_approval") triggerBossAction("boss.approve")
        if (event.type === "agent.task.completed") triggerBossAction("boss.missionComplete")
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [addAgentBubbleForEvent, snapshot.events, snapshot.agents, settings.enabled, triggerBossAction])

  useEffect(() => {
    if (!settings.enabled || !settings.comedyMode) return
    const timer = window.setInterval(() => {
      const agents = latestSnapshotRef.current.agents.filter((agent) => agent.realState !== "offline")
      if (!agents.length) return
      const now = Date.now()
      const available = agents.filter((agent) => canShowAgentBubble(agent.agentId, now))
      if (!available.length) return
      const agent = available[Math.floor(now / 1000) % available.length]
      const phrase = phraseForAgent(agent, now)
      addAgentBubble(agent.agentId, phrase, agent.realState === "idle" ? "whisper" : "status", now, 3200)
    }, AGENTOPS_LIVESTREAM_CONFIG.limits.idleChatterIntervalMs)
    return () => window.clearInterval(timer)
  }, [addAgentBubble, canShowAgentBubble, phraseForAgent, settings.enabled, settings.comedyMode])

  const agentById = useMemo(
    () => new Map(snapshot.agents.map((agent) => [agent.agentId, agent])),
    [snapshot.agents]
  )

  if (!settings.enabled) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {settings.bossVisible && cursor ? <BossCursor cursor={cursor} /> : null}
      {settings.bossVisible
        ? bossEffects.map((effect) => <BossEffect key={effect.id} effect={effect} />)
        : null}
      {settings.comedyMode
        ? agentBubbles.map((bubble) => {
            const agent = agentById.get(bubble.agentId)
            if (!agent) return null
            return (
              <AgentBubble
                key={bubble.id}
                bubble={bubble}
                position={worldToScreen(agent.position, viewport)}
              />
            )
          })
        : null}
      <LivestreamHud settings={settings} onSettingsChange={onSettingsChange} />
    </div>
  )
}

function BossCursor({ cursor }: { cursor: AgentOpsPoint }) {
  return (
    <div
      className="absolute flex items-center gap-2 will-change-transform"
      style={{ transform: `translate(${cursor.x + 14}px, ${cursor.y + 14}px)` }}
    >
      <div className="relative size-12 animate-[agentops-boss-float_1.4s_ease-in-out_infinite]">
        <div className="absolute left-1 top-1 h-10 w-7 rotate-[-24deg] rounded-t-full rounded-bl-[10px] border border-amber-100/70 bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.35)]" />
        <div className="absolute left-6 top-6 h-5 w-8 rotate-[-24deg] rounded-full border border-amber-100/60 bg-amber-400" />
        <div className="absolute left-1 top-1 size-3 rounded-full bg-[#111922]" />
      </div>
    </div>
  )
}

function BossEffect({ effect }: { effect: AgentOpsBossEffect }) {
  const base = {
    transform: `translate(${effect.position.x + 28}px, ${effect.position.y - 18}px)`,
  }
  if (effect.kind === "stamp") {
    return (
      <div
        className="absolute rounded-[6px] border-4 border-emerald-300 px-4 py-2 text-2xl font-black tracking-[0.12em] text-emerald-200 opacity-95 shadow-[0_0_28px_rgba(52,211,153,0.35)] animate-[agentops-stamp_900ms_ease-out]"
        style={base}
      >
        {effect.phrase}
      </div>
    )
  }
  const tone =
    effect.kind === "panic"
      ? "border-rose-300/40 bg-rose-950/85 text-rose-100"
      : effect.kind === "coffee"
        ? "border-amber-200/40 bg-zinc-950/85 text-amber-100"
        : "border-sky-200/30 bg-[#111922]/90 text-zinc-100"
  return (
    <div
      className={`absolute max-w-[280px] rounded-[8px] border px-3 py-2 text-sm font-bold shadow-xl backdrop-blur animate-[agentops-pop_220ms_ease-out] ${tone}`}
      style={base}
    >
      {effect.kind === "coffee" ? "☕ " : null}
      {effect.kind === "panic" ? "⚠ " : null}
      {effect.phrase}
    </div>
  )
}

function AgentBubble({ bubble, position }: { bubble: AgentOpsAgentBubble; position: AgentOpsPoint }) {
  const tone =
    bubble.kind === "event"
      ? "border-amber-200/35 bg-amber-950/90 text-amber-50"
      : bubble.kind === "status"
        ? "border-cyan-200/25 bg-cyan-950/85 text-cyan-50"
        : "border-white/20 bg-[#111922]/88 text-zinc-100"
  return (
    <div
      className={`absolute max-w-[220px] rounded-[8px] border px-2.5 py-1.5 text-xs font-semibold leading-4 shadow-xl backdrop-blur animate-[agentops-pop_180ms_ease-out] ${tone}`}
      style={{ transform: `translate(${position.x + 14}px, ${position.y - 52}px)` }}
    >
      {bubble.phrase}
    </div>
  )
}

function LivestreamHud({
  settings,
  onSettingsChange,
}: {
  settings: AgentOpsLivestreamSettings
  onSettingsChange: (settings: Partial<AgentOpsLivestreamSettings>) => void
}) {
  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-1 rounded-[4px] border border-white/10 bg-[#111922]/78 p-1 text-[11px] text-zinc-300 shadow-xl backdrop-blur">
      <button
        type="button"
        className={`rounded-[4px] px-2 py-1 ${settings.comedyMode ? "bg-fuchsia-300/15 text-fuchsia-100" : "text-zinc-500"}`}
        onClick={() => onSettingsChange({ comedyMode: !settings.comedyMode })}
      >
        Comedy
      </button>
      <button
        type="button"
        className={`rounded-[4px] px-2 py-1 ${settings.bossVisible ? "bg-amber-300/15 text-amber-100" : "text-zinc-500"}`}
        onClick={() => onSettingsChange({ bossVisible: !settings.bossVisible })}
      >
        Boss
      </button>
    </div>
  )
}

function worldToScreen(point: AgentOpsPoint, viewport: AgentOpsViewportTransform) {
  return {
    x: point.x * viewport.scale + viewport.pan.x,
    y: point.y * viewport.scale + viewport.pan.y,
  }
}

function pick(values: string[], seed: string) {
  if (!values.length) return ""
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return values[hash % values.length]
}
