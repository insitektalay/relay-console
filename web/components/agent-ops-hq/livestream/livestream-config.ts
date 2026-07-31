import type { AgentOpsBossActionId, AgentOpsLivestreamConfig } from "./livestream-types"

export const AGENTOPS_LIVESTREAM_CONFIG: AgentOpsLivestreamConfig = {
  bossActions: [
    {
      id: "boss.approve",
      label: "Approved",
      hotkey: "1",
      phrase: "APPROVED",
      kind: "stamp",
      durationMs: 1800,
      soundCue: "approval_stamp",
    },
    {
      id: "boss.backToWork",
      label: "Back to work",
      hotkey: "2",
      phrase: "GET BACK TO WORK",
      kind: "speech",
      durationMs: 2600,
      soundCue: "back_to_work",
    },
    {
      id: "boss.coffee",
      label: "Coffee",
      hotkey: "3",
      phrase: "COFFEE SIP",
      kind: "coffee",
      durationMs: 2400,
      soundCue: "coffee_sip",
    },
    {
      id: "boss.panic",
      label: "Panic",
      hotkey: "4",
      phrase: "AUTH HELL",
      kind: "panic",
      durationMs: 2800,
      soundCue: "panic_alarm",
    },
    {
      id: "boss.missionComplete",
      label: "Mission complete",
      hotkey: "5",
      phrase: "MISSION COMPLETE",
      kind: "toast",
      durationMs: 2500,
      soundCue: "mission_complete",
    },
    {
      id: "boss.toggleVisible",
      label: "Hide/show boss",
      hotkey: "6",
      phrase: "TOGGLE BOSS",
      kind: "calm",
      durationMs: 900,
    },
    {
      id: "boss.shipIt",
      label: "Ship it",
      phrase: "SHIP IT",
      kind: "stamp",
      durationMs: 1800,
      soundCue: "ship_it",
    },
    {
      id: "boss.whyIdle",
      label: "Why idle?",
      phrase: "WHY ARE YOU IDLE?",
      kind: "speech",
      durationMs: 2600,
    },
    {
      id: "boss.calm",
      label: "Everything calm",
      phrase: "EVERYTHING IS RUNNING CALMLY",
      kind: "calm",
      durationMs: 2600,
    },
  ],
  agentPhraseRules: [
    {
      id: "approval",
      realStates: ["waiting_for_approval"],
      eventTypes: ["agent.waiting_for_approval"],
      phrases: ["Waiting for Alex to decide", "Approval queue is my natural habitat", "Needs human approval"],
      kind: "event",
      ttlMs: 4200,
    },
    {
      id: "error",
      realStates: ["error", "blocked"],
      eventTypes: ["agent.error"],
      phrases: ["Stuck in auth hell", "Needs API key", "Context window critical", "Something red happened"],
      kind: "event",
      ttlMs: 4800,
    },
    {
      id: "complete",
      realStates: ["completed"],
      eventTypes: ["agent.task.completed", "workflow.completed", "output.completed"],
      phrases: ["Actually useful for once", "Mission complete", "Shipped it", "Filed under suspiciously productive"],
      kind: "status",
      ttlMs: 3400,
    },
    {
      id: "working",
      realStates: ["queued", "working", "thinking", "tooling"],
      phrases: ["Googling aggressively", "Arguing with TypeScript", "Opened 312 tabs", "Writing 47-page plan", "In vibe coding trance"],
      kind: "status",
      ttlMs: 3600,
      cooldownMs: 9000,
    },
    {
      id: "idle",
      realStates: ["idle"],
      phrases: ["Pretending to work", "Discovered another SaaS idea", "Waiting for context to become someone else’s problem"],
      kind: "speech",
      ttlMs: 3200,
      cooldownMs: 10000,
    },
  ],
  idleChatterPhrases: [
    "Pretending to work",
    "Discovered another SaaS idea",
    "Opened 312 tabs",
    "Waiting for Alex to decide",
    "Googling aggressively",
    "In vibe coding trance",
    "Context window on fire",
    "Writing 47-page plan",
  ],
  whisperPhrases: [
    "Did you deploy that?",
    "No, I thought you deployed it.",
    "The API key is probably in another tab.",
    "Act natural, the boss cursor is watching.",
  ],
  limits: {
    maxBossEffects: 4,
    maxAgentBubbles: 4,
    agentBubbleCooldownMs: 6500,
    idleChatterIntervalMs: 7000,
    eventReactionCooldownMs: 1800,
  },
}

export const AGENTOPS_BOSS_HOTKEYS = new Map<string, AgentOpsBossActionId>(
  AGENTOPS_LIVESTREAM_CONFIG.bossActions
    .filter((action) => action.hotkey)
    .map((action) => [action.hotkey!, action.id])
)

export function getBossActionConfig(actionId: AgentOpsBossActionId) {
  return AGENTOPS_LIVESTREAM_CONFIG.bossActions.find((action) => action.id === actionId)
}
