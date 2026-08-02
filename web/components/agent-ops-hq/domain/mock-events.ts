import type { Agent } from "@clawchat/contracts"
import type { AgentOpsEstateLayout, AgentOpsEvent, AgentOpsEventType } from "./estate-types"

const MOCK_SEQUENCE: Array<{
  type: AgentOpsEventType
  appId?: string
  summary: string
  severity?: AgentOpsEvent["severity"]
}> = [
  { type: "agent.task.queued", appId: "gapminer", summary: "SERP gap research queued." },
  { type: "agent.task.started", appId: "gapminer", summary: "GapMiner opportunity scan started." },
  { type: "agent.tool.called", appId: "rankscope", summary: "RankScope keyword comparison running." },
  { type: "agent.task.started", appId: "ai_tube_watch", summary: "YouTube channel analysis started." },
  { type: "agent.tool.called", appId: "visualforge", summary: "Visual Forge thumbnail layout draft." },
  { type: "agent.waiting_for_approval", appId: "short_relay", summary: "Short publishing approval requested.", severity: "warning" },
  { type: "agent.context.warning", appId: "pagejourney", summary: "Page intent thread is near context limit.", severity: "warning" },
  { type: "agent.task.completed", appId: "gapminer", summary: "Affiliate opportunity packet completed.", severity: "success" },
  { type: "revenue.event", appId: "saasgrowth", summary: "Revenue signal received for SaaS marketing plan.", severity: "revenue" },
  { type: "agent.error", appId: "localappconnector", summary: "Backlink source rejected a request.", severity: "error" },
]

export function createSeededMockEvent(input: {
  layout: AgentOpsEstateLayout
  workspaceId: string
  agents: Agent[]
  tick: number
  now?: string
}): AgentOpsEvent | null {
  if (!input.agents.length) return null
  const step = MOCK_SEQUENCE[input.tick % MOCK_SEQUENCE.length]
  const app = input.layout.applications.find((entry) => entry.appId === step.appId)
  const agent = input.agents[input.tick % input.agents.length]
  const timestamp = input.now ?? new Date().toISOString()
  return {
    id: `mock:${input.tick}:${timestamp}`,
    type: step.type,
    workspaceId: input.workspaceId,
    timestamp,
    source: "mock",
    agentId: agent.id,
    appId: app?.appId ?? null,
    businessUnitId: app?.businessUnitId ?? null,
    departmentId: app?.defaultDepartmentId ?? null,
    outputTypeId: app?.outputTypes[0] ?? null,
    workflowId: app?.workflowIds?.[0] ?? null,
    websiteId: app?.publicProperties[0] ?? null,
    severity: step.severity ?? "info",
    title: titleFor(step.type),
    summary: step.summary,
  }
}

export type GapMinerMockScenario = "work" | "approval" | "error"

export function createGapMinerMockEventSequence(input: {
  layout: AgentOpsEstateLayout
  workspaceId: string
  agents: Agent[]
  agentCount?: number
  scenario?: GapMinerMockScenario
  now?: Date
}): AgentOpsEvent[] {
  const selectedAgents = pickGapMinerAgents(input.agents, input.agentCount ?? 1)
  if (!selectedAgents.length) return []
  const app = input.layout.applications.find((entry) => entry.appId === "gapminer")
  const base = input.now ?? new Date()
  const steps: Array<{
    type: AgentOpsEventType
    offsetMs: number
    severity: AgentOpsEvent["severity"]
    title: string
    summary: string
    payload?: Record<string, unknown>
  }> = [
    {
      type: "agent.task.queued",
      offsetMs: 0,
      severity: "info",
      title: "GapMiner queued",
      summary: "GapMiner SERP gap research queued.",
    },
    {
      type: "agent.task.started",
      offsetMs: 1200,
      severity: "info",
      title: "GapMiner started",
      summary: "Agent is moving to the GapMiner Office workstation.",
    },
    {
      type: "agent.tool.called",
      offsetMs: 6200,
      severity: "info",
      title: "GapMiner tool called",
      summary: "GapMiner is scanning opportunity and affiliate research signals.",
      payload: { toolName: "gapminer.scan_serp_gaps" },
    },
    {
      type: "agent.task.progress",
      offsetMs: 9600,
      severity: "info",
      title: "GapMiner progress",
      summary: "Candidate keyword gaps and affiliate angles are being ranked.",
      payload: { progress: 0.68 },
    },
  ]

  if (input.scenario === "approval") {
    steps.push({
      type: "agent.waiting_for_approval",
      offsetMs: 12800,
      severity: "warning",
      title: "GapMiner approval required",
      summary: "Human approval is required before publishing the opportunity packet.",
    })
  } else if (input.scenario === "error") {
    steps.push({
      type: "agent.error",
      offsetMs: 12800,
      severity: "error",
      title: "GapMiner error",
      summary: "GapMiner encountered an error while fetching SERP comparison data.",
    })
  } else {
    steps.push({
      type: "agent.task.completed",
      offsetMs: 13800,
      severity: "success",
      title: "GapMiner completed",
      summary: "Affiliate opportunity packet completed.",
    })
  }

  return selectedAgents.flatMap((agent, agentIndex) => {
    const taskId = `mock:gapminer:${base.getTime()}:${agentIndex}`
    const common = {
      workspaceId: input.workspaceId,
      source: "mock" as const,
      agentId: agent.id,
      appId: "gapminer",
      roomId: "gapminer_office",
      businessUnitId: app?.businessUnitId ?? "seo_growth",
      departmentId: app?.defaultDepartmentId ?? "gapminer_office",
      outputTypeId: app?.outputTypes[0] ?? "opportunity",
      workflowId: app?.workflowIds?.[0] ?? null,
      websiteId: app?.publicProperties[0] ?? null,
      taskId,
    }
    return steps.map((step, index) => ({
      ...common,
      id: `${taskId}:${step.type}:${index}`,
      type: step.type,
      timestamp: new Date(base.getTime() + step.offsetMs + agentIndex * 180).toISOString(),
      severity: step.severity,
      title: selectedAgents.length > 1 ? `${step.title} ${agentIndex + 1}` : step.title,
      summary: step.summary,
      payload: { ...step.payload, agentIndex },
    }))
  })
}

function pickGapMinerAgents(agents: Agent[], count: number) {
  const ranked = [...agents].sort((left, right) => scoreGapMinerAgent(right) - scoreGapMinerAgent(left))
  return ranked.slice(0, Math.max(1, Math.min(count, ranked.length)))
}

function scoreGapMinerAgent(agent: Agent) {
  const text = `${agent.name} ${agent.role}`.toLowerCase()
  if (text.includes("gap")) return 3
  if (text.includes("seo")) return 2
  if (text.includes("research")) return 1
  return 0
}

function titleFor(type: AgentOpsEventType) {
  return type
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" / ")
}
