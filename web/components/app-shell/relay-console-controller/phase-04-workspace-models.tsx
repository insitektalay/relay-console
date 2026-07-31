"use client"
/* eslint-disable react-hooks/exhaustive-deps -- Controller phases receive stable React setters and refs from prior hooks. */
import type { MarketplaceConnection, Thread } from "@clawchat/contracts"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { buildAgentAppBadgesByAgentId } from "@/components/app-shell/relay-controller-data"
import { useRelayConsoleWorkspaceQueries } from "./phase-03-workspace-queries"
import { ReportListItem, logAppPerf } from "./shared"

export function useRelayConsoleWorkspaceModels(
  input: ReturnType<typeof useRelayConsoleWorkspaceQueries>
) {
  const {
    agentDisplayNames,
    agentsQuery,
    approvalQueueInitializedRef,
    approvalsQuery,
    archivedReportMap,
    archivedTaskMap,
    companiesQuery,
    deferredReportSearch,
    departmentsQuery,
    effectiveWorkspaceId,
    knownPendingApprovalIdsRef,
    marketplaceCatalogQuery,
    marketplaceConnectionsQuery,
    marketplaceInstallsQuery,
    openedThreadOverride,
    reportSortDraft,
    reportSourceFilter,
    reportsQuery,
    setSection,
    setSelectedApprovalId,
    setTaskPanelMode,
    taskPatchOverrides,
    tasksQuery,
    teamsQuery,
    threadPatchOverrides,
    threadsQuery,
    wrapUpReportsQuery,
  } = input

  const threads = useMemo(() => {
    const raw = threadsQuery.data?.pages.flatMap((page) => page.data) ?? []
    const withOpenedThread =
      openedThreadOverride &&
      !raw.some((thread) => thread.id === openedThreadOverride.id)
        ? [openedThreadOverride, ...raw]
        : raw
    if (!Object.keys(threadPatchOverrides).length) return withOpenedThread
    return withOpenedThread.map((t) =>
      threadPatchOverrides[t.id] ? { ...t, ...threadPatchOverrides[t.id] } : t
    )
  }, [openedThreadOverride, threadPatchOverrides, threadsQuery.data?.pages])

  useEffect(() => {
    if (threadsQuery.data?.pages[0]) {
      logAppPerf("first thread page ready", {
        count: threadsQuery.data.pages[0].data.length,
        hasMore: threadsQuery.data.pages[0].hasMore,
        loadedPages: threadsQuery.data.pages.length,
      })
    }
  }, [threadsQuery.data?.pages])

  const agents = useMemo(
    () =>
      (agentsQuery.data?.data ?? []).filter(
        (agent) => !agent.lifecycleStatus || agent.lifecycleStatus === "active"
      ),
    [agentsQuery.data?.data]
  )

  const marketplaceApps = useMemo(
    () =>
      (
        marketplaceCatalogQuery.data?.pages.flatMap((page) => page.apps) ?? []
      ).filter((app) =>
        app.release
          ? app.release.connectEligible
          : app.availability === "available"
      ),
    [marketplaceCatalogQuery.data?.pages]
  )

  const marketplaceTotalCount =
    marketplaceCatalogQuery.data?.pages[0]?.pageInfo.totalCount ??
    marketplaceApps.length

  const connectedMarketplaceAppSlugs = useMemo(
    () =>
      new Set(
        ((marketplaceConnectionsQuery.data ?? []) as MarketplaceConnection[])
          .filter((connection) => connection.status === "ready")
          .map((connection) => connection.appSlug)
      ),
    [marketplaceConnectionsQuery.data]
  )

  const marketplaceSidebarApps = useMemo(
    () =>
      marketplaceApps.filter((app) =>
        connectedMarketplaceAppSlugs.has(app.slug)
      ),
    [connectedMarketplaceAppSlugs, marketplaceApps]
  )

  useEffect(() => {
    const loadedSlugs = new Set(marketplaceApps.map((app) => app.slug))
    const hasMissingConnectedApp = [...connectedMarketplaceAppSlugs].some(
      (slug) => !loadedSlugs.has(slug)
    )
    if (
      hasMissingConnectedApp &&
      marketplaceCatalogQuery.hasNextPage &&
      !marketplaceCatalogQuery.isFetchingNextPage
    ) {
      void marketplaceCatalogQuery.fetchNextPage()
    }
  }, [connectedMarketplaceAppSlugs, marketplaceCatalogQuery, marketplaceApps])

  const agentAppBadgesByAgentId = useMemo(
    () =>
      buildAgentAppBadgesByAgentId({
        apps: marketplaceApps,
        installs: marketplaceInstallsQuery.data ?? [],
      }),
    [marketplaceApps, marketplaceInstallsQuery.data]
  )

  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents]
  )

  const displayNameByAgentId = useMemo(
    () =>
      Object.fromEntries(
        agents.map((agent) => [
          agent.id,
          agentDisplayNames[agent.id]?.trim() || agent.name,
        ])
      ),
    [agentDisplayNames, agents]
  )

  const tasks = useMemo(() => {
    const raw = tasksQuery.data?.data ?? []
    if (!Object.keys(taskPatchOverrides).length) return raw
    return raw.map((task) =>
      taskPatchOverrides[task.id]
        ? { ...task, ...taskPatchOverrides[task.id] }
        : task
    )
  }, [taskPatchOverrides, tasksQuery.data?.data])

  const visibleTasks = useMemo(
    () =>
      tasks
        .filter((task) => !archivedTaskMap[task.id]?.trim())
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt).getTime()
          const rightTime = new Date(right.createdAt).getTime()
          return rightTime - leftTime
        }),
    [archivedTaskMap, tasks]
  )

  const approvals = useMemo(
    () => approvalsQuery.data?.data ?? [],
    [approvalsQuery.data?.data]
  )

  useEffect(() => {
    if (!effectiveWorkspaceId) {
      approvalQueueInitializedRef.current = false
      knownPendingApprovalIdsRef.current = new Set()
      return
    }

    if (!approvalsQuery.isFetched) {
      return
    }

    const currentIds = new Set(approvals.map((approval) => approval.id))
    const newApproval = approvals.find(
      (approval) => !knownPendingApprovalIdsRef.current.has(approval.id)
    )

    if (approvalQueueInitializedRef.current && newApproval) {
      toast("Approval required", {
        description: newApproval.title,
        action: {
          label: "Review",
          onClick: () => {
            setSelectedApprovalId(newApproval.id)
            setTaskPanelMode("approvals")
            setSection("tasks")
          },
        },
      })
    }

    knownPendingApprovalIdsRef.current = currentIds
    approvalQueueInitializedRef.current = true
  }, [approvals, approvalsQuery.isFetched, effectiveWorkspaceId])

  const reports = useMemo(
    () =>
      (reportsQuery.data?.data ?? []).map(
        (report) =>
          ({
            ...report,
            id: `snapshot:${report.id}`,
            reportId: report.id,
            kind: "snapshot",
          }) as ReportListItem
      ),
    [reportsQuery.data?.data]
  )

  const wrapUpReports = useMemo(
    () =>
      (wrapUpReportsQuery.data?.data ?? []).map(
        (report) =>
          ({
            ...report,
            id: `wrap_up:${report.id}`,
            reportId: report.id,
            kind: "wrap_up",
          }) as ReportListItem
      ),
    [wrapUpReportsQuery.data?.data]
  )

  const allReports = useMemo(
    () => [...reports, ...wrapUpReports],
    [reports, wrapUpReports]
  )

  const visibleReports = useMemo(
    () => allReports.filter((report) => !archivedReportMap[report.id]?.trim()),
    [allReports, archivedReportMap]
  )

  const filteredReports = useMemo(() => {
    let items = visibleReports

    if (reportSourceFilter !== "all") {
      items = items.filter((report) => report.kind === reportSourceFilter)
    }

    if (deferredReportSearch.trim()) {
      const value = deferredReportSearch.trim().toLowerCase()
      items = items.filter((report) => {
        if (report.kind === "wrap_up") {
          return (
            report.title.toLowerCase().includes(value) ||
            report.fileName.toLowerCase().includes(value) ||
            report.model.toLowerCase().includes(value)
          )
        }

        return (
          report.title.toLowerCase().includes(value) ||
          report.type.toLowerCase().includes(value) ||
          report.period.toLowerCase().includes(value)
        )
      })
    }

    const sorted = [...items]
    if (reportSortDraft === "title") {
      sorted.sort((left, right) => left.title.localeCompare(right.title))
      return sorted
    }

    sorted.sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime()
      const rightTime = new Date(right.createdAt).getTime()
      return reportSortDraft === "oldest"
        ? leftTime - rightTime
        : rightTime - leftTime
    })

    return sorted
  }, [
    deferredReportSearch,
    reportSortDraft,
    reportSourceFilter,
    visibleReports,
  ])

  const companies = useMemo(
    () => companiesQuery.data ?? [],
    [companiesQuery.data]
  )

  const departments = useMemo(
    () => departmentsQuery.data ?? [],
    [departmentsQuery.data]
  )

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])

  const threadsById = useMemo(
    () => new Map(threads.map((thread) => [thread.id, thread])),
    [threads]
  )

  const departmentsById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments]
  )

  const departmentChatAgentIdsByDepartmentId = useMemo(() => {
    const byDepartment = new Map<string, string[]>(
      departments.map((department) => [department.id, []])
    )
    for (const agent of agents) {
      if (!agent.departmentId) continue
      byDepartment.get(agent.departmentId)?.push(agent.id)
    }
    return byDepartment
  }, [agents, departments])

  const teamsById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  )

  const departmentManagerAgentIds = useMemo(
    () =>
      new Set(
        departments
          .map((department) => department.headAgentId)
          .filter((value): value is string => Boolean(value))
      ),
    [departments]
  )

  const teamManagerAgentIds = useMemo(
    () =>
      new Set(
        teams
          .map((team) => team.leadAgentId)
          .filter((value): value is string => Boolean(value))
      ),
    [teams]
  )

  const allManagerAgentIds = useMemo(
    () => new Set([...departmentManagerAgentIds, ...teamManagerAgentIds]),
    [departmentManagerAgentIds, teamManagerAgentIds]
  )

  const resolveThreadManagerAgentIds = (thread?: Thread | null) => {
    if (!thread) return []
    if (thread.type === "team" && thread.teamId) {
      const managerAgentId = teamsById.get(thread.teamId)?.leadAgentId
      return managerAgentId ? [managerAgentId] : []
    }
    if (thread.type === "department" && thread.departmentId) {
      const managerAgentId = departmentsById.get(
        thread.departmentId
      )?.headAgentId
      return managerAgentId ? [managerAgentId] : []
    }
    if (thread.type === "company_meeting") {
      return thread.agentIds.filter((agentId) =>
        allManagerAgentIds.has(agentId)
      )
    }
    return []
  }
  return {
    ...input,
    agentAppBadgesByAgentId,
    agents,
    agentsById,
    allManagerAgentIds,
    allReports,
    approvals,
    companies,
    connectedMarketplaceAppSlugs,
    departmentChatAgentIdsByDepartmentId,
    departmentManagerAgentIds,
    departments,
    departmentsById,
    displayNameByAgentId,
    filteredReports,
    marketplaceApps,
    marketplaceSidebarApps,
    marketplaceTotalCount,
    reports,
    resolveThreadManagerAgentIds,
    tasks,
    teamManagerAgentIds,
    teams,
    teamsById,
    threads,
    threadsById,
    visibleReports,
    visibleTasks,
    wrapUpReports,
  }
}
