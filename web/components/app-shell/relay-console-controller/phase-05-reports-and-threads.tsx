"use client"
import type { Thread } from "@clawchat/contracts"
import { useCallback, useMemo } from "react"
import {
  resolveThreadDepartmentId as resolveThreadDepartmentIdFromStructure,
  resolveThreadGroupType as resolveThreadGroupTypeFromAgents,
} from "@/components/app-shell/relay-console-domain"
import { sortThreadsByRecentActivity } from "@/lib/thread-order"
import { useRelayConsoleWorkspaceModels } from "./phase-04-workspace-models"
import { AgentGroupType, ReportListGroup, titleCase } from "./shared"

export function useRelayConsoleReportsAndThreads(
  input: ReturnType<typeof useRelayConsoleWorkspaceModels>
) {
  const {
    agentsById,
    bridgeConnectionsQuery,
    bridgeDevicesQuery,
    deferredThreadSearch,
    departments,
    departmentsById,
    displayNameByAgentId,
    filteredReports,
    openedThreadOverride,
    paperclipConnectionsQuery,
    provisionAgentCompanyIdDraft,
    provisionAgentDepartmentIdDraft,
    provisionAgentGroupTypeDraft,
    selectedThreadId,
    teams,
    teamsById,
    threadFilterDepartmentId,
    threadFilterGroup,
    threads,
    threadsById,
  } = input

  const reportGroups = useMemo<ReportListGroup[]>(() => {
    const groups = new Map<string, ReportListGroup>()
    const orderedGroupIds: string[] = []
    const ensureGroup = (group: ReportListGroup) => {
      const existing = groups.get(group.id)
      if (existing) {
        return existing
      }

      groups.set(group.id, group)
      orderedGroupIds.push(group.id)
      return group
    }

    for (const report of filteredReports) {
      const sourceThread =
        report.kind === "wrap_up" ? threadsById.get(report.threadId) : null
      const sourceTeam =
        report.kind === "wrap_up" && report.teamId
          ? teamsById.get(report.teamId)
          : null
      const primaryAgentId = sourceThread?.agentIds[0]
      const avatarLabel =
        sourceThread?.title ?? sourceTeam?.name ?? report.title
      const avatarUrl =
        sourceThread?.avatarUrl ??
        (primaryAgentId ? agentsById.get(primaryAgentId)?.avatarUrl : null)

      if (report.kind === "wrap_up" && sourceThread?.type === "team") {
        const group = ensureGroup({
          id: `team-chat:${report.teamId ?? report.threadId}`,
          title: sourceThread.title ?? sourceTeam?.name ?? report.title,
          subtitle: "Team chat reports",
          avatarLabel,
          avatarUrl,
          badgeLabel: "Team",
          badgeTone: "border-emerald-400/20 bg-emerald-400/12 text-emerald-100",
          latestCreatedAt: report.createdAt,
          isCollapsible: true,
          reports: [],
        })

        group.reports.push(report)
        if (
          new Date(report.createdAt).getTime() >
          new Date(group.latestCreatedAt).getTime()
        ) {
          group.latestCreatedAt = report.createdAt
        }
        const latestCycle = Math.max(
          ...group.reports.map((item) =>
            item.kind === "wrap_up" ? item.threadSessionSequenceNumber : 0
          )
        )
        group.subtitle = `${group.reports.length} ${group.reports.length === 1 ? "report" : "reports"} · Latest cycle ${latestCycle}`
        continue
      }

      if (report.kind === "wrap_up" && sourceThread?.type === "direct") {
        const agentName = primaryAgentId
          ? (displayNameByAgentId[primaryAgentId] ??
            agentsById.get(primaryAgentId)?.name)
          : null
        const group = ensureGroup({
          id: `direct-chat:${primaryAgentId ?? report.threadId}`,
          title: agentName ?? sourceThread.title ?? report.title,
          subtitle: "Direct chat reports",
          avatarLabel: agentName ?? avatarLabel,
          avatarUrl,
          badgeLabel: "Direct",
          badgeTone: "border-cyan-400/20 bg-cyan-400/12 text-cyan-100",
          latestCreatedAt: report.createdAt,
          isCollapsible: true,
          reports: [],
        })

        group.reports.push(report)
        if (
          new Date(report.createdAt).getTime() >
          new Date(group.latestCreatedAt).getTime()
        ) {
          group.latestCreatedAt = report.createdAt
        }
        const latestCycle = Math.max(
          ...group.reports.map((item) =>
            item.kind === "wrap_up" ? item.threadSessionSequenceNumber : 0
          )
        )
        group.subtitle = `${group.reports.length} ${group.reports.length === 1 ? "report" : "reports"} · Latest cycle ${latestCycle}`
        continue
      }

      const badgeTone =
        report.kind === "wrap_up"
          ? sourceThread?.type === "direct"
            ? "border-cyan-400/20 bg-cyan-400/12 text-cyan-100"
            : "border-violet-400/20 bg-violet-400/12 text-violet-100"
          : "border-sky-400/20 bg-sky-400/12 text-sky-100"
      const badgeLabel =
        report.kind === "wrap_up"
          ? sourceThread?.type === "direct"
            ? "Direct"
            : "Wrap-up"
          : "Snapshot"

      ensureGroup({
        id: `single:${report.id}`,
        title: report.title,
        subtitle:
          report.kind === "wrap_up"
            ? `Cycle ${report.threadSessionSequenceNumber}`
            : `${titleCase(report.type)} snapshot · ${report.period}`,
        avatarLabel,
        avatarUrl,
        badgeLabel,
        badgeTone,
        latestCreatedAt: report.createdAt,
        isCollapsible: false,
        reports: [report],
      })
    }

    return orderedGroupIds.flatMap((groupId) => {
      const group = groups.get(groupId)
      return group ? [group] : []
    })
  }, [
    agentsById,
    displayNameByAgentId,
    filteredReports,
    teamsById,
    threadsById,
  ])

  const bridgeConnections = bridgeConnectionsQuery.data ?? []

  const paperclipConnections = paperclipConnectionsQuery.data ?? []

  const bridgeDevices = bridgeDevicesQuery.data ?? []

  const provisionFilteredDepartments = useMemo(
    () =>
      provisionAgentCompanyIdDraft
        ? departments.filter(
            (department) =>
              department.companyId === provisionAgentCompanyIdDraft
          )
        : departments,
    [departments, provisionAgentCompanyIdDraft]
  )

  const provisionFilteredTeams = useMemo(
    () =>
      provisionAgentDepartmentIdDraft
        ? teams.filter(
            (team) => team.departmentId === provisionAgentDepartmentIdDraft
          )
        : teams,
    [teams, provisionAgentDepartmentIdDraft]
  )

  const createAgentManagerToggleReason =
    provisionAgentGroupTypeDraft !== "business"
      ? "Manager assignment is only available for Business agents."
      : !provisionAgentDepartmentIdDraft
        ? "Choose a department before setting this agent as its manager."
        : null

  const createAgentManagerDepartment = provisionAgentDepartmentIdDraft
    ? departmentsById.get(provisionAgentDepartmentIdDraft)
    : null

  const createAgentExistingManagerName =
    createAgentManagerDepartment?.headAgentId
      ? (displayNameByAgentId[createAgentManagerDepartment.headAgentId] ??
        agentsById.get(createAgentManagerDepartment.headAgentId)?.name ??
        null)
      : null

  const effectiveThreadId = useMemo(() => {
    if (
      selectedThreadId &&
      (threads.some((thread) => thread.id === selectedThreadId) ||
        openedThreadOverride?.id === selectedThreadId)
    ) {
      return selectedThreadId
    }
    return threads[0]?.id ?? null
  }, [openedThreadOverride?.id, selectedThreadId, threads])

  const resolveAgentDisplayName = (
    agent?: { id: string; name: string } | null
  ) => (agent ? (displayNameByAgentId[agent.id] ?? agent.name) : "Unassigned")

  const resolveAgentDisplayNameById = (agentId?: string | null) => {
    if (!agentId) {
      return "Unassigned"
    }

    const agent = agentsById.get(agentId)
    return agent ? resolveAgentDisplayName(agent) : "Unassigned"
  }

  const resolveThreadTitle = (thread: Thread) => {
    const primaryAgentId = thread.agentIds[0]
    if (!primaryAgentId) {
      return thread.title
    }

    const displayName = displayNameByAgentId[primaryAgentId]
    if (!displayName) {
      return thread.title
    }

    if (thread.type === "direct") {
      return displayName
    }

    const backendName = agentsById.get(primaryAgentId)?.name?.trim()
    if (
      backendName &&
      thread.title.trim().toLowerCase() === backendName.toLowerCase()
    ) {
      return displayName
    }

    return thread.title
  }

  const resolveThreadGroupType = useCallback(
    (thread: Thread): AgentGroupType =>
      resolveThreadGroupTypeFromAgents(thread, agentsById),
    [agentsById]
  )

  const resolveThreadDepartmentId = useCallback(
    (thread: Thread) =>
      resolveThreadDepartmentIdFromStructure(thread, agentsById, teamsById),
    [agentsById, teamsById]
  )

  const filteredThreads = useMemo(() => {
    let items = threads

    if (threadFilterGroup !== "all") {
      items = items.filter(
        (thread) => resolveThreadGroupType(thread) === threadFilterGroup
      )
    }

    if (threadFilterGroup === "business" && threadFilterDepartmentId) {
      items = items.filter(
        (thread) =>
          resolveThreadDepartmentId(thread) === threadFilterDepartmentId
      )
    }

    if (deferredThreadSearch) {
      const value = deferredThreadSearch.toLowerCase()
      items = items.filter((thread) => {
        const primaryAgentId = thread.agentIds[0]
        const displayName = primaryAgentId
          ? displayNameByAgentId[primaryAgentId]
          : undefined
        const backendName = primaryAgentId
          ? agentsById.get(primaryAgentId)?.name?.trim()
          : undefined
        const threadTitle =
          displayName &&
          (thread.type === "direct" ||
            (backendName &&
              thread.title.trim().toLowerCase() === backendName.toLowerCase()))
            ? displayName
            : thread.title

        return (
          threadTitle.toLowerCase().includes(value) ||
          thread.title.toLowerCase().includes(value) ||
          thread.type.toLowerCase().includes(value) ||
          thread.lastMessage?.content.toLowerCase().includes(value)
        )
      })
    }

    return sortThreadsByRecentActivity(items)
  }, [
    agentsById,
    deferredThreadSearch,
    displayNameByAgentId,
    resolveThreadDepartmentId,
    resolveThreadGroupType,
    threadFilterDepartmentId,
    threadFilterGroup,
    threads,
  ])

  function agentName(agentId?: string | null) {
    return resolveAgentDisplayNameById(agentId)
  }
  return {
    ...input,
    agentName,
    bridgeConnections,
    bridgeDevices,
    createAgentExistingManagerName,
    createAgentManagerDepartment,
    createAgentManagerToggleReason,
    effectiveThreadId,
    filteredThreads,
    paperclipConnections,
    provisionFilteredDepartments,
    provisionFilteredTeams,
    reportGroups,
    resolveAgentDisplayName,
    resolveAgentDisplayNameById,
    resolveThreadDepartmentId,
    resolveThreadGroupType,
    resolveThreadTitle,
  }
}
