import type {
  Agent,
  AgentResponsePresentation,
  Thread,
} from "@clawchat/contracts"

export type AgentGroupType = "personal" | "family" | "business"

export type WorkCalendarGroup = AgentGroupType | "all"

export type RuntimeAgentDraftType = "openclaw" | "claude_code" | "hermes"

export type ResponsePresentationDraft = AgentResponsePresentation

export type AgentGroupEntry = {
  primary: Agent
  allAgentIds: string[]
}

export function resolveAgentGroupType(agent: Agent): AgentGroupType {
  const groupType = agent.groupType?.toLowerCase()
  if (groupType === "family" || groupType === "business") return groupType
  if (groupType === "personal") return "personal"
  if (agent.companyId || agent.departmentId || agent.teamId) return "business"
  return "personal"
}

export function resolveThreadGroupType(
  thread: Thread,
  agentsById: ReadonlyMap<string, Agent>
): AgentGroupType {
  if (thread.teamId || thread.departmentId) return "business"

  const participantAgents = (thread.agentIds ?? [])
    .map((agentId) => agentsById.get(agentId))
    .filter(Boolean) as Agent[]
  if (!participantAgents.length) return "personal"
  if (
    participantAgents.some(
      (agent) => resolveAgentGroupType(agent) === "business"
    )
  ) {
    return "business"
  }
  return participantAgents.some(
    (agent) => resolveAgentGroupType(agent) === "family"
  )
    ? "family"
    : "personal"
}

export function resolveThreadDepartmentId(
  thread: Thread,
  agentsById: ReadonlyMap<string, Agent>,
  teamsById: ReadonlyMap<string, { departmentId?: string | null }>
) {
  if (thread.departmentId) return thread.departmentId
  if (thread.teamId)
    return teamsById.get(thread.teamId)?.departmentId ?? null

  return (
    (thread.agentIds ?? [])
      .map((agentId) => agentsById.get(agentId))
      .find(
        (agent) => agent && resolveAgentGroupType(agent) === "business"
      )?.departmentId ?? null
  )
}

export function resolveFamilyLabel(label?: string | null) {
  const trimmed = label?.trim()
  return trimmed?.length ? trimmed : "Family"
}
