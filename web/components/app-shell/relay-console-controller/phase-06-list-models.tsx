"use client"
import type { Agent, Task } from "@clawchat/contracts"
import { useMemo } from "react"
import {
  resolveAgentGroupType,
  resolveFamilyLabel,
} from "@/components/app-shell/relay-console-domain"
import { buildAgentSearchText } from "@/components/app-shell/relay-controller-data"
import { useRelayConsoleReportsAndThreads } from "./phase-05-reports-and-threads"
import { slugifyLabel } from "./shared"

export function useRelayConsoleListModels(
  input: ReturnType<typeof useRelayConsoleReportsAndThreads>
) {
  const {
    agents,
    agentsById,
    approvals,
    deferredAgentSearch,
    deferredNewChatSearch,
    deferredTaskSearch,
    displayNameByAgentId,
    filteredThreads,
    selectedCompanyId,
    selectedDepartmentId,
    selectedFamilyLabel,
    selectedGroupType,
    selectedTeamId,
    taskFilterGroup,
    threadsQuery,
    visibleTasks,
  } = input

  const threadListErrorMessage =
    filteredThreads.length > 0
      ? null
      : threadsQuery.error instanceof Error
        ? threadsQuery.error.message
        : threadsQuery.isError
          ? "The conversation request failed."
          : null

  const dedupedAgentGroups = useMemo(() => {
    const grouped = new Map<
      string,
      { primary: (typeof agents)[number]; allAgentIds: string[] }
    >()

    const statusRank = (status: string) => {
      switch (status) {
        case "active":
          return 0
        case "on_duty":
          return 1
        case "busy":
          return 2
        case "off_duty":
          return 3
        default:
          return 4
      }
    }

    const sourceRank = (agent: (typeof agents)[number]) => {
      const description = (agent.description ?? "").toLowerCase()
      if (description.includes("[bridge]")) return 0
      return 1
    }

    // Canonical ids are identity. Display names are never used to merge or
    // relink agents because two independent runtimes may use the same name.
    const identityKey = (agent: (typeof agents)[number]) => agent.id

    for (const agent of agents) {
      const key = identityKey(agent)
      const existing = grouped.get(key)
      if (!existing) {
        grouped.set(key, { primary: agent, allAgentIds: [agent.id] })
        continue
      }

      existing.allAgentIds.push(agent.id)

      const currentPrimary = existing.primary
      const currentScore = [
        sourceRank(currentPrimary),
        statusRank(currentPrimary.status),
        currentPrimary.updatedAt ?? currentPrimary.createdAt ?? "",
      ] as const
      const candidateScore = [
        sourceRank(agent),
        statusRank(agent.status),
        agent.updatedAt ?? agent.createdAt ?? "",
      ] as const

      if (
        candidateScore[0] < currentScore[0] ||
        (candidateScore[0] === currentScore[0] &&
          candidateScore[1] < currentScore[1]) ||
        (candidateScore[0] === currentScore[0] &&
          candidateScore[1] === currentScore[1] &&
          candidateScore[2] > currentScore[2])
      ) {
        existing.primary = agent
      }
    }

    return Array.from(grouped.values())
  }, [agents])

  const personalAgentGroups = useMemo(
    () =>
      dedupedAgentGroups.filter(
        ({ primary }) => resolveAgentGroupType(primary) === "personal"
      ),
    [dedupedAgentGroups]
  )

  const familyAgentGroups = useMemo(
    () =>
      dedupedAgentGroups.filter(
        ({ primary }) => resolveAgentGroupType(primary) === "family"
      ),
    [dedupedAgentGroups]
  )

  const businessAgentGroups = useMemo(
    () =>
      dedupedAgentGroups.filter(
        ({ primary }) => resolveAgentGroupType(primary) === "business"
      ),
    [dedupedAgentGroups]
  )

  const familyMemberGroups = useMemo(() => {
    const grouped = new Map<string, typeof familyAgentGroups>()

    for (const entry of familyAgentGroups) {
      const label = resolveFamilyLabel(entry.primary.groupLabel)
      const existing = grouped.get(label)
      if (existing) {
        existing.push(entry)
      } else {
        grouped.set(label, [entry])
      }
    }

    return Array.from(grouped.entries())
      .map(([label, entries]) => ({
        id: slugifyLabel(label),
        label,
        count: entries.length,
        entries,
      }))
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [familyAgentGroups])

  const scopedGroupAgentGroups = useMemo(() => {
    if (selectedTeamId) {
      return businessAgentGroups.filter(
        ({ primary }) => primary.teamId === selectedTeamId
      )
    }

    if (selectedDepartmentId) {
      return businessAgentGroups.filter(
        ({ primary }) => primary.departmentId === selectedDepartmentId
      )
    }

    if (selectedCompanyId) {
      return businessAgentGroups.filter(
        ({ primary }) => primary.companyId === selectedCompanyId
      )
    }

    if (selectedGroupType === "family" && selectedFamilyLabel) {
      return familyAgentGroups.filter(
        ({ primary }) =>
          resolveFamilyLabel(primary.groupLabel) === selectedFamilyLabel
      )
    }

    if (selectedGroupType === "family") return familyAgentGroups
    if (selectedGroupType === "business") return businessAgentGroups
    return personalAgentGroups
  }, [
    businessAgentGroups,
    familyAgentGroups,
    personalAgentGroups,
    selectedCompanyId,
    selectedDepartmentId,
    selectedFamilyLabel,
    selectedGroupType,
    selectedTeamId,
  ])

  const filteredAgents = useMemo(() => {
    if (!deferredAgentSearch) return dedupedAgentGroups
    const value = deferredAgentSearch.toLowerCase()
    return dedupedAgentGroups.filter(({ primary, allAgentIds }) => {
      const linkedAgents = allAgentIds
        .map((agentId) => agentsById.get(agentId))
        .filter(Boolean) as Agent[]
      const searchableAgents = linkedAgents.length ? linkedAgents : [primary]

      return searchableAgents.some((agent) =>
        buildAgentSearchText(
          agent,
          displayNameByAgentId[agent.id] ?? agent.name
        ).includes(value)
      )
    })
  }, [
    agentsById,
    dedupedAgentGroups,
    deferredAgentSearch,
    displayNameByAgentId,
  ])

  const newChatAgents = useMemo(() => {
    const value = deferredNewChatSearch.toLowerCase()
    return dedupedAgentGroups.filter(({ primary, allAgentIds }) => {
      if (!value) return true
      const linkedAgents = allAgentIds
        .map((agentId) => agentsById.get(agentId))
        .filter(Boolean) as Agent[]
      const searchableAgents = linkedAgents.length ? linkedAgents : [primary]

      return searchableAgents.some((agent) =>
        buildAgentSearchText(
          agent,
          displayNameByAgentId[agent.id] ?? agent.name
        ).includes(value)
      )
    })
  }, [
    agentsById,
    dedupedAgentGroups,
    deferredNewChatSearch,
    displayNameByAgentId,
  ])

  const filteredTaskItems = useMemo(() => {
    let items = visibleTasks

    if (taskFilterGroup !== "all") {
      items = items.filter((task) => {
        const scopedAgent =
          (task.assignedAgentId
            ? agentsById.get(task.assignedAgentId)
            : null) ??
          (task.targetAgentId ? agentsById.get(task.targetAgentId) : null) ??
          (task.targetAgentTwoId ? agentsById.get(task.targetAgentTwoId) : null)

        return scopedAgent
          ? resolveAgentGroupType(scopedAgent) === taskFilterGroup
          : taskFilterGroup === "personal"
      })
    }

    if (!deferredTaskSearch) return items

    const value = deferredTaskSearch.toLowerCase()
    return items.filter(
      (task) =>
        task.title.toLowerCase().includes(value) ||
        (task.messageBody ?? task.description ?? "")
          .toLowerCase()
          .includes(value) ||
        task.status.toLowerCase().includes(value) ||
        task.priority.toLowerCase().includes(value) ||
        task.targetType.toLowerCase().includes(value)
    )
  }, [agentsById, deferredTaskSearch, taskFilterGroup, visibleTasks])

  const currentTaskItems = useMemo(
    () =>
      filteredTaskItems
        .filter(
          (task) => task.status !== "completed" && task.status !== "cancelled"
        )
        .sort((left, right) => {
          const taskTime = (task: Task) => {
            const scheduledAt = task.nextRunAt ?? task.scheduledFor
            if (!scheduledAt) return Number.POSITIVE_INFINITY
            const parsed = new Date(scheduledAt).getTime()
            return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
          }
          const leftTime = taskTime(left)
          const rightTime = taskTime(right)
          if (leftTime !== rightTime) return leftTime - rightTime
          const leftCreatedAt = new Date(left.createdAt).getTime()
          const rightCreatedAt = new Date(right.createdAt).getTime()
          if (Number.isNaN(leftCreatedAt) || Number.isNaN(rightCreatedAt)) {
            return 0
          }
          return rightCreatedAt - leftCreatedAt
        }),
    [filteredTaskItems]
  )

  const filteredApprovals = useMemo(() => {
    let items = approvals

    if (taskFilterGroup !== "all") {
      items = items.filter((approval) => {
        const requester = approval.requestedByAgentId
          ? agentsById.get(approval.requestedByAgentId)
          : null

        return requester
          ? resolveAgentGroupType(requester) === taskFilterGroup
          : taskFilterGroup === "personal"
      })
    }

    if (!deferredTaskSearch) return items

    const value = deferredTaskSearch.toLowerCase()
    return items.filter(
      (approval) =>
        approval.title.toLowerCase().includes(value) ||
        approval.description.toLowerCase().includes(value) ||
        approval.risk.toLowerCase().includes(value) ||
        approval.status.toLowerCase().includes(value)
    )
  }, [agentsById, approvals, deferredTaskSearch, taskFilterGroup])
  return {
    ...input,
    businessAgentGroups,
    currentTaskItems,
    dedupedAgentGroups,
    familyAgentGroups,
    familyMemberGroups,
    filteredAgents,
    filteredApprovals,
    filteredTaskItems,
    newChatAgents,
    personalAgentGroups,
    scopedGroupAgentGroups,
    threadListErrorMessage,
  }
}
