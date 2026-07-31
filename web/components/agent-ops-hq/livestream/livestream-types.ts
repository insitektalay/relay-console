import type {
  AgentOpsEventType,
  AgentOpsPoint,
  AgentOpsRealState,
  AgentOpsVisibleState,
} from "../domain/estate-types"

export type AgentOpsBossActionId =
  | "boss.approve"
  | "boss.backToWork"
  | "boss.shipIt"
  | "boss.missionComplete"
  | "boss.whyIdle"
  | "boss.coffee"
  | "boss.calm"
  | "boss.panic"
  | "boss.toggleVisible"

export type AgentOpsBossEffectKind =
  | "speech"
  | "stamp"
  | "toast"
  | "coffee"
  | "panic"
  | "calm"

export type AgentOpsAgentBubbleKind = "speech" | "status" | "whisper" | "event"

export interface AgentOpsLivestreamSettings {
  enabled: boolean
  comedyMode: boolean
  bossVisible: boolean
}

export interface AgentOpsViewportTransform {
  scale: number
  pan: AgentOpsPoint
}

export interface AgentOpsBossActionConfig {
  id: AgentOpsBossActionId
  label: string
  hotkey?: string
  phrase: string
  kind: AgentOpsBossEffectKind
  durationMs: number
  soundCue?: string
}

export interface AgentOpsAgentPhraseRule {
  id: string
  realStates?: AgentOpsRealState[]
  visibleStates?: AgentOpsVisibleState[]
  eventTypes?: AgentOpsEventType[]
  phrases: string[]
  kind: AgentOpsAgentBubbleKind
  ttlMs: number
  cooldownMs?: number
}

export interface AgentOpsLivestreamConfig {
  bossActions: AgentOpsBossActionConfig[]
  agentPhraseRules: AgentOpsAgentPhraseRule[]
  idleChatterPhrases: string[]
  whisperPhrases: string[]
  limits: {
    maxBossEffects: number
    maxAgentBubbles: number
    agentBubbleCooldownMs: number
    idleChatterIntervalMs: number
    eventReactionCooldownMs: number
  }
}

export interface AgentOpsBossEffect {
  id: string
  actionId: AgentOpsBossActionId
  phrase: string
  kind: AgentOpsBossEffectKind
  position: AgentOpsPoint
  createdAt: number
  expiresAt: number
}

export interface AgentOpsAgentBubble {
  id: string
  agentId: string
  phrase: string
  kind: AgentOpsAgentBubbleKind
  createdAt: number
  expiresAt: number
}
