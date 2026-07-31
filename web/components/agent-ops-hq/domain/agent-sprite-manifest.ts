import type { AgentOpsCompassDirection } from "./estate-types"

export type AgentOpsSpriteAnimationKey =
  | `idle_${AgentOpsCompassDirection}`
  | `walk_${AgentOpsCompassDirection}`
  | `work_${AgentOpsCompassDirection}`
  | `approval_${AgentOpsCompassDirection}`
  | `error_${AgentOpsCompassDirection}`

export type AgentOpsSpriteAnimation = {
  row: number
  frames: number
  fps?: number
}

export type AgentOpsAgentSpriteAsset = {
  id: string
  src: string
  frameWidth: number
  frameHeight: number
  scale: number
  anchor?: { x: number; y: number }
  animations: Partial<Record<AgentOpsSpriteAnimationKey, AgentOpsSpriteAnimation>>
}

const BASE_ANIMATIONS: AgentOpsAgentSpriteAsset["animations"] = {
  idle_down: { row: 0, frames: 1 },
  idle_left: { row: 1, frames: 1 },
  idle_right: { row: 2, frames: 1 },
  idle_up: { row: 3, frames: 1 },
  walk_down: { row: 4, frames: 6, fps: 8 },
  walk_left: { row: 5, frames: 6, fps: 8 },
  walk_right: { row: 6, frames: 6, fps: 8 },
  walk_up: { row: 7, frames: 6, fps: 8 },
  work_down: { row: 8, frames: 4, fps: 4 },
  work_left: { row: 9, frames: 4, fps: 4 },
  work_right: { row: 10, frames: 4, fps: 4 },
  work_up: { row: 11, frames: 4, fps: 4 },
}

export const AGENTOPS_AGENT_SPRITES: Record<string, AgentOpsAgentSpriteAsset> =
  Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => {
      const suffix = String(index + 1).padStart(2, "0")
      const id = `office_worker_${suffix}`
      return [
        id,
        {
          id,
          src: `/agent-ops-hq/agents/office-worker-${suffix}.png`,
          frameWidth: 64,
          frameHeight: 64,
          scale: 0.75,
          anchor: { x: 0.5, y: 0.82 },
          animations: BASE_ANIMATIONS,
        } satisfies AgentOpsAgentSpriteAsset,
      ]
    })
  )

export function getAgentOpsAgentSprite(spriteId: string | null | undefined) {
  if (!spriteId) return null
  return AGENTOPS_AGENT_SPRITES[spriteId] ?? null
}
