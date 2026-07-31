"use client"
/* eslint-disable react-hooks/exhaustive-deps -- Controller phases receive stable React setters and refs from prior hooks. */
import type {
  Agent,
  Task,
  Thread,
  ThreadPaperclipLinkView,
} from "@clawchat/contracts"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DEFAULT_DEPARTMENT_COLOR } from "@/lib/department-avatar"
import { sdk } from "@/lib/sdk"
import { buildTaskPatchOverride } from "@/features/tasks/task-schedule"
import { type ThreadViewMode } from "@/components/threads/thread-detail-pane"
import { useRelayConsoleListModels } from "./phase-06-list-models"
import { logAppPerf } from "./shared"

export function useRelayConsoleSelection(
  input: ReturnType<typeof useRelayConsoleListModels>
) {
  const {
    agents,
    agentsById,
    agentsManagementTab,
    approvals,
    companies,
    currentTaskItems,
    dedupedAgentGroups,
    departments,
    departmentsById,
    effectiveSection,
    effectiveThreadId,
    effectiveWorkspaceId,
    filteredAgents,
    filteredReports,
    filteredTaskItems,
    insightsTab,
    openedThreadOverride,
    queryClient,
    resolveAgentDisplayName,
    resolveAgentDisplayNameById,
    selectedAgentId,
    selectedApprovalId,
    selectedCompanyId,
    selectedDepartmentId,
    selectedReportId,
    selectedReportKind,
    selectedTaskId,
    selectedTeamId,
    selectedThreadId,
    session,
    setOpenedThreadOverride,
    setSelectedThreadId,
    setTaskPatchOverrides,
    setThreadAnalyticsAgentRepeatSessionId,
    teams,
    teamsById,
    threadAnalyticsAgentRepeatSessionId,
    threadAnalyticsGapMinutes,
    threadViewModes,
    threads,
    visibleReports,
    visibleTasks,
  } = input

  const selectedThread =
    threads.find((thread) => thread.id === effectiveThreadId) ??
    (openedThreadOverride?.id === effectiveThreadId
      ? openedThreadOverride
      : null)

  const selectedThreadViewMode: ThreadViewMode =
    selectedThread?.id && threadViewModes[selectedThread.id] === "condensed"
      ? "condensed"
      : "full"

  useEffect(() => {
    setThreadAnalyticsAgentRepeatSessionId(null)
  }, [selectedThread?.id])

  const selectedThreadAnalyticsQuery = useQuery({
    queryKey: [
      "thread-analytics",
      selectedThread?.id,
      threadAnalyticsGapMinutes,
      threadAnalyticsAgentRepeatSessionId,
    ],
    enabled: Boolean(
      session &&
      selectedThread?.id &&
      (effectiveSection === "analytics" ||
        (effectiveSection === "reports" && insightsTab === "analytics"))
    ),
    retry: false,
    placeholderData: (previousData) => previousData,
    queryFn: () =>
      sdk.threads.analytics(selectedThread!.id, threadAnalyticsGapMinutes, {
        agentRepeatSessionId: threadAnalyticsAgentRepeatSessionId,
      }),
  })

  const selectedThreadPaperclipLinkQuery = useQuery({
    queryKey: ["thread-paperclip-link", selectedThread?.id],
    enabled: Boolean(session && selectedThread?.id),
    queryFn: async () => {
      logAppPerf("paperclip thread link fetch start", {
        threadId: selectedThread?.id,
      })
      const result = await sdk.paperclip.threadLink(selectedThread!.id)
      logAppPerf("paperclip thread link fetch complete", {
        threadId: selectedThread?.id,
        fetchState: result.fetchState,
      })
      return result
    },
    retry: false,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  })

  const selectedThreadPaperclipLink =
    (selectedThreadPaperclipLinkQuery.data as ThreadPaperclipLinkView | null) ??
    null

  const defaultFilteredAgentGroup =
    filteredAgents.find(({ primary: agent }) => {
      const displayName = resolveAgentDisplayName(agent).trim().toLowerCase()
      return (
        displayName === "gapminer" ||
        agent.name.trim().toLowerCase() === "gapminer"
      )
    }) ?? null

  const defaultUnfilteredAgentGroup =
    dedupedAgentGroups.find(({ primary: agent }) => {
      const displayName = resolveAgentDisplayName(agent).trim().toLowerCase()
      return (
        displayName === "gapminer" ||
        agent.name.trim().toLowerCase() === "gapminer"
      )
    }) ?? null

  const selectedAgentGroup =
    filteredAgents.find((entry) =>
      entry.allAgentIds.includes(selectedAgentId ?? "")
    ) ??
    dedupedAgentGroups.find((entry) =>
      entry.allAgentIds.includes(selectedAgentId ?? "")
    ) ??
    defaultFilteredAgentGroup ??
    filteredAgents[0] ??
    defaultUnfilteredAgentGroup ??
    dedupedAgentGroups[0] ??
    null

  const selectedAgent = selectedAgentGroup?.primary ?? null

  const selectedAgentWorkspaceExternalId = useMemo(() => {
    const linkedAgents = (selectedAgentGroup?.allAgentIds ?? [])
      .map((agentId) => agentsById.get(agentId))
      .filter(Boolean) as Agent[]

    const linkedExternalId = linkedAgents.find((agent) =>
      Boolean(agent.externalId?.trim())
    )?.externalId

    return (
      linkedExternalId?.trim() ||
      selectedAgent?.externalId?.trim() ||
      selectedAgent?.id ||
      null
    )
  }, [
    agentsById,
    selectedAgent?.externalId,
    selectedAgent?.id,
    selectedAgentGroup?.allAgentIds,
  ])

  const selectedTaskItems =
    effectiveSection === "agents" && agentsManagementTab === "tasks"
      ? currentTaskItems
      : filteredTaskItems

  const isAgentTasksView =
    effectiveSection === "agents" && agentsManagementTab === "tasks"

  const selectedTask =
    selectedTaskItems.find((entry) => entry.id === selectedTaskId) ??
    (isAgentTasksView
      ? null
      : visibleTasks.find((entry) => entry.id === selectedTaskId)) ??
    selectedTaskItems[0] ??
    (isAgentTasksView ? null : visibleTasks[0]) ??
    null

  const syncTaskPatchOverride = (task: Task, intended: Partial<Task>) => {
    const nextOverride = buildTaskPatchOverride(task, intended)

    setTaskPatchOverrides((current) => {
      const hasOverride = Boolean(current[task.id])
      if (!Object.keys(nextOverride).length) {
        if (!hasOverride) return current
        const updated = { ...current }
        delete updated[task.id]
        return updated
      }
      return {
        ...current,
        [task.id]: nextOverride,
      }
    })
  }

  const ensureTaskThread = async (task: Task) => {
    if (!effectiveWorkspaceId) {
      return task.threadId ?? null
    }

    if (task.threadId) {
      return task.threadId
    }

    const findExistingAgentThread = (
      agentIds: string[],
      type: Thread["type"]
    ) =>
      threads.find((thread) => {
        if (thread.type !== type) return false
        const currentIds = [...(thread.agentIds ?? [])].sort()
        const expectedIds = [...agentIds].sort()
        return (
          currentIds.length === expectedIds.length &&
          currentIds.every((value, index) => value === expectedIds[index])
        )
      })?.id ?? null

    let threadId: string | null = null

    switch (task.targetType) {
      case "direct": {
        const agentId = task.targetAgentId ?? task.assignedAgentId
        if (!agentId) break

        threadId =
          findExistingAgentThread([agentId], "direct") ??
          (
            await sdk.threads.create(effectiveWorkspaceId, {
              title: resolveAgentDisplayNameById(agentId),
              type: "direct",
              agentIds: [agentId],
            })
          ).id
        break
      }
      case "agent_to_agent": {
        if (!task.targetAgentId || !task.targetAgentTwoId) break

        threadId =
          findExistingAgentThread(
            [task.targetAgentId, task.targetAgentTwoId],
            "agent_to_agent"
          ) ??
          (
            await sdk.threads.create(effectiveWorkspaceId, {
              title: `${resolveAgentDisplayNameById(task.targetAgentId)} ↔ ${resolveAgentDisplayNameById(task.targetAgentTwoId)}`,
              type: "agent_to_agent",
              agentIds: [task.targetAgentId, task.targetAgentTwoId],
            })
          ).id
        break
      }
      case "team": {
        if (!task.teamId) break

        threadId =
          threads.find(
            (thread) => thread.type === "team" && thread.teamId === task.teamId
          )?.id ??
          (
            await sdk.threads.create(effectiveWorkspaceId, {
              title: teamsById.get(task.teamId)?.name ?? "Team thread",
              type: "team",
              teamId: task.teamId,
              agentIds: agents
                .filter((agent) => agent.teamId === task.teamId)
                .map((agent) => agent.id),
            })
          ).id
        break
      }
      case "department": {
        if (!task.departmentId) break

        threadId =
          threads.find(
            (thread) =>
              thread.type === "department" &&
              thread.departmentId === task.departmentId
          )?.id ??
          (
            await sdk.threads.create(effectiveWorkspaceId, {
              title:
                departmentsById.get(task.departmentId)?.name ??
                "Department thread",
              type: "department",
              departmentId: task.departmentId,
              agentIds: agents
                .filter((agent) => agent.departmentId === task.departmentId)
                .map((agent) => agent.id),
            })
          ).id
        break
      }
      default:
        break
    }

    if (!threadId) {
      return null
    }

    syncTaskPatchOverride(task, { threadId })

    try {
      const updatedTask = await sdk.tasks.update(task.id, { threadId })
      syncTaskPatchOverride(updatedTask, { threadId })
    } catch {
      // Keep the resolved thread client-side if the API still drops the field.
    }

    await queryClient.invalidateQueries({
      queryKey: ["threads", effectiveWorkspaceId],
    })

    return threadId
  }

  const effectiveApprovalId =
    approvals.find((entry) => entry.id === selectedApprovalId)?.id ??
    approvals[0]?.id ??
    null

  const selectedReport =
    filteredReports.find(
      (entry) =>
        entry.id === selectedReportId && entry.kind === selectedReportKind
    ) ??
    visibleReports.find(
      (entry) =>
        entry.id === selectedReportId && entry.kind === selectedReportKind
    ) ??
    filteredReports[0] ??
    visibleReports[0] ??
    null

  const selectedReportThreadId =
    selectedReport?.kind === "wrap_up" ? selectedReport.threadId : null

  useEffect(() => {
    if (
      effectiveSection === "reports" &&
      selectedReportThreadId &&
      selectedReportThreadId !== selectedThreadId
    ) {
      setOpenedThreadOverride(null)
      setSelectedThreadId(selectedReportThreadId)
    }
  }, [
    effectiveSection,
    selectedReportThreadId,
    selectedThreadId,
    setSelectedThreadId,
  ])

  const selectedCompany =
    companies.find((entry) => entry.id === selectedCompanyId) ?? null

  const selectedDepartment =
    departments.find((entry) => entry.id === selectedDepartmentId) ?? null

  const selectedTeam =
    teams.find((entry) => entry.id === selectedTeamId) ?? null

  const [selectedDepartmentColorDraft, setSelectedDepartmentColorDraft] =
    useState(DEFAULT_DEPARTMENT_COLOR)
  return {
    ...input,
    defaultFilteredAgentGroup,
    defaultUnfilteredAgentGroup,
    effectiveApprovalId,
    ensureTaskThread,
    isAgentTasksView,
    selectedAgent,
    selectedAgentGroup,
    selectedAgentWorkspaceExternalId,
    selectedCompany,
    selectedDepartment,
    selectedDepartmentColorDraft,
    selectedReport,
    selectedReportThreadId,
    selectedTask,
    selectedTaskItems,
    selectedTeam,
    selectedThread,
    selectedThreadAnalyticsQuery,
    selectedThreadPaperclipLink,
    selectedThreadPaperclipLinkQuery,
    selectedThreadViewMode,
    setSelectedDepartmentColorDraft,
    syncTaskPatchOverride,
  }
}
