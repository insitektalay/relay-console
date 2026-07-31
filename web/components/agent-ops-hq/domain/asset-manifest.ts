export type AgentOpsFloorAsset = {
  id: string
  src: string
  width: number
  height: number
}

export const AGENTOPS_FLOOR_ASSETS: Record<string, AgentOpsFloorAsset> = {
  agentops_tower_main_operations_floor: {
    id: "agentops_tower_main_operations_floor",
    src: "/agent-ops-hq/floors/agentops-tower-main-operations-floor.png",
    width: 1586,
    height: 992,
  },
}

export function getAgentOpsFloorAsset(assetId: string | null | undefined) {
  if (!assetId) return null
  return AGENTOPS_FLOOR_ASSETS[assetId] ?? null
}
