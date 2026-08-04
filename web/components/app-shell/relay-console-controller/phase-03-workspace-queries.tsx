"use client"
/* eslint-disable react-hooks/exhaustive-deps -- Controller phases receive stable React setters and refs from prior hooks. */
import type {
  MarketplaceCatalogPage,
  Paginated,
  Task,
  ThreadWrapUpReport,
} from "@clawchat/contracts"
import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import { usePersistentStringMap } from "@/hooks/use-persistent-string-map"
import {
  buildAgentWorkCalendarFallback,
  getScrollableCalendarDays,
  listAllWorkspaceAgents,
} from "@/components/app-shell/relay-controller-data"
import { useRelayNativeRuntimeActions } from "@/features/runtime/use-relay-native-runtime-actions"
import { defaultTaskTimezone } from "@/features/tasks/task-schedule"
import { useRelayConsoleFeatureStateAndAccess } from "./phase-02-feature-state-and-access"
import {
  AGENT_DISPLAY_NAME_KEY,
  THREAD_LIST_PAGE_SIZE,
  isWrapUpReportPending,
  logAppPerf,
} from "./shared"

export function useRelayConsoleWorkspaceQueries(
  input: ReturnType<typeof useRelayConsoleFeatureStateAndAccess>
) {
  const {
    agentWorkCalendarGroup,
    agentWorkCalendarRangeEnd,
    agentsManagementTab,
    canAccessApplications,
    canAccessMarketplace,
    canAccessOperations,
    deferredThreadSearch,
    effectiveSection,
    effectiveWorkspaceId,
    isWorkspaceAdmin,
    provisionAgentModelDraft,
    queryClient,
    runtimeAgentModelDraft,
    runtimeAgentTypeDraft,
    selectedThreadId,
    session,
    setNativeDocumentConsent,
    setProvisionAgentModelDraft,
    setRuntimeAgentModelDraft,
    setSelectedNativeObservationIds,
  } = input

  const [agentDisplayNames, setAgentDisplayNames] = usePersistentStringMap(
    `${AGENT_DISPLAY_NAME_KEY}.${effectiveWorkspaceId ?? "global"}`
  )

  const companiesQuery = useQuery({
    queryKey: ["companies", effectiveWorkspaceId],
    enabled: Boolean(session && effectiveWorkspaceId),
    queryFn: () => sdk.org.companies(effectiveWorkspaceId!),
  })

  const departmentsQuery = useQuery({
    queryKey: ["departments", effectiveWorkspaceId],
    enabled: Boolean(session && effectiveWorkspaceId),
    queryFn: () => sdk.departments.list(effectiveWorkspaceId!),
  })

  const teamsQuery = useQuery({
    queryKey: ["teams", effectiveWorkspaceId],
    enabled: Boolean(session && effectiveWorkspaceId),
    queryFn: () => sdk.teams.list(effectiveWorkspaceId!),
  })

  const threadsQuery = useInfiniteQuery({
    queryKey: [
      "threads",
      effectiveWorkspaceId,
      deferredThreadSearch.trim().toLowerCase(),
    ],
    enabled: Boolean(session && effectiveWorkspaceId),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const search = deferredThreadSearch.trim()
      logAppPerf("thread page fetch", {
        workspaceId: effectiveWorkspaceId,
        page: pageParam,
        search: search || null,
      })
      return search
        ? sdk.threads.search(
            effectiveWorkspaceId!,
            search,
            pageParam,
            THREAD_LIST_PAGE_SIZE
          )
        : sdk.threads.list(
            effectiveWorkspaceId!,
            pageParam,
            THREAD_LIST_PAGE_SIZE
          )
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  })

  const agentsQuery = useQuery({
    queryKey: ["agents", effectiveWorkspaceId],
    enabled: Boolean(session && effectiveWorkspaceId),
    queryFn: () => listAllWorkspaceAgents(effectiveWorkspaceId!),
  })

  const agentModelOptionsQuery = useQuery({
    queryKey: ["agent-model-options", effectiveWorkspaceId],
    enabled: Boolean(session && effectiveWorkspaceId),
    queryFn: () => sdk.agents.modelOptions(effectiveWorkspaceId!),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    const harnesses = agentModelOptionsQuery.data?.harnesses
    const runtimeKey =
      runtimeAgentTypeDraft === "openclaw" ? "openclaw" : "hermes"
    const runtimeOptions = harnesses?.[runtimeKey]
    if (
      runtimeAgentTypeDraft !== "claude_code" &&
      runtimeOptions?.models.length &&
      !runtimeOptions.models.includes(runtimeAgentModelDraft)
    ) {
      setRuntimeAgentModelDraft(runtimeOptions.defaultModel)
    }

    const openClawOptions = harnesses?.openclaw
    if (
      openClawOptions?.models.length &&
      !openClawOptions.models.includes(provisionAgentModelDraft)
    ) {
      setProvisionAgentModelDraft(openClawOptions.defaultModel)
    }
  }, [
    agentModelOptionsQuery.data,
    provisionAgentModelDraft,
    runtimeAgentModelDraft,
    runtimeAgentTypeDraft,
  ])

  const marketplaceCatalogQuery = useInfiniteQuery<
    MarketplaceCatalogPage,
    Error
  >({
    queryKey: ["marketplace", effectiveWorkspaceId, "catalog-sidebar-page"],
    enabled: Boolean(session && effectiveWorkspaceId && canAccessApplications),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      sdk.marketplace.catalogPage(effectiveWorkspaceId!, {
        cursor: (pageParam as string | null) ?? undefined,
        limit: 50,
      }),
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
    staleTime: 60_000,
  })

  const marketplaceInstallsQuery = useQuery({
    queryKey: ["marketplace", effectiveWorkspaceId, "installs"],
    enabled: Boolean(session && effectiveWorkspaceId && canAccessApplications),
    queryFn: () => sdk.marketplace.installs(effectiveWorkspaceId!),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })

  const marketplaceConnectionsQuery = useQuery({
    queryKey: ["marketplace", effectiveWorkspaceId, "connections"],
    enabled: Boolean(session && effectiveWorkspaceId && canAccessApplications),
    queryFn: () => sdk.marketplace.connections(effectiveWorkspaceId!),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })

  const tasksQuery = useQuery({
    queryKey: ["tasks", effectiveWorkspaceId],
    enabled: Boolean(
      session &&
      effectiveWorkspaceId &&
      (effectiveSection === "tasks" ||
        effectiveSection === "agentOpsHq" ||
        (effectiveSection === "agents" && agentsManagementTab === "tasks"))
    ),
    queryFn: () =>
      sdk.tasks.list({
        workspaceId: effectiveWorkspaceId!,
        page: 1,
        pageSize: 100,
      }),
  })

  const approvalsQuery = useQuery({
    queryKey: ["approvals", effectiveWorkspaceId],
    enabled: Boolean(
      session &&
      effectiveWorkspaceId &&
      (effectiveSection === "tasks" || effectiveSection === "agentOpsHq")
    ),
    queryFn: () => sdk.approvals.list(effectiveWorkspaceId!, "pending"),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  const reportsQuery = useQuery({
    queryKey: ["reports", effectiveWorkspaceId],
    enabled: Boolean(
      session && effectiveWorkspaceId && effectiveSection === "reports"
    ),
    queryFn: () => sdk.reports.list(effectiveWorkspaceId!, undefined, 1, 100),
  })

  const wrapUpReportsQuery = useQuery({
    queryKey: ["wrap-up-reports", effectiveWorkspaceId],
    enabled: Boolean(
      session && effectiveWorkspaceId && effectiveSection === "reports"
    ),
    queryFn: () =>
      sdk.reports.wrapUps(effectiveWorkspaceId!, undefined, 1, 100),
    refetchInterval: (query) => {
      const page = query.state.data as Paginated<ThreadWrapUpReport> | undefined
      return page?.data?.some(isWrapUpReportPending) ? 3000 : false
    },
  })

  const bridgeConnectionsQuery = useQuery({
    queryKey: ["bridge-connections", effectiveWorkspaceId],
    enabled: Boolean(session && effectiveWorkspaceId && canAccessOperations),
    queryFn: () => sdk.bridge.connections(effectiveWorkspaceId!),
  })

  const paperclipConnectionsQuery = useQuery({
    queryKey: ["paperclip-connections", effectiveWorkspaceId],
    enabled: Boolean(
      session &&
      effectiveWorkspaceId &&
      canAccessMarketplace &&
      (effectiveSection === "settings" || Boolean(selectedThreadId))
    ),
    queryFn: () => sdk.paperclip.connections(effectiveWorkspaceId!),
  })

  const openClawIntegrationStatusQuery = useQuery({
    queryKey: ["workspace-openclaw-integration-status", effectiveWorkspaceId],
    enabled: Boolean(
      session &&
      effectiveWorkspaceId &&
      (effectiveSection === "settings" || effectiveSection === "agents")
    ),
    queryFn: () =>
      sdk.workspaces.openClawIntegrationStatus(effectiveWorkspaceId!),
  })

  const agentWorkCalendarDays = useMemo(
    () => getScrollableCalendarDays(agentWorkCalendarRangeEnd),
    [agentWorkCalendarRangeEnd]
  )

  const agentWorkCalendarStartDate = agentWorkCalendarDays[0]

  const agentWorkCalendarEndDate =
    agentWorkCalendarDays[agentWorkCalendarDays.length - 1]

  const agentWorkCalendarQuery = useQuery({
    queryKey: [
      "agent-work-calendar",
      effectiveWorkspaceId,
      agentWorkCalendarGroup,
      agentWorkCalendarStartDate,
      agentWorkCalendarEndDate,
      defaultTaskTimezone(),
    ],
    enabled: Boolean(
      session &&
      effectiveWorkspaceId &&
      effectiveSection === "agents" &&
      agentsManagementTab === "calendar"
    ),
    queryFn: async () => {
      const params = {
        startDate: agentWorkCalendarStartDate,
        endDate: agentWorkCalendarEndDate,
        groupType:
          agentWorkCalendarGroup === "all" ? undefined : agentWorkCalendarGroup,
        activityGapMinutes: 30,
        timeZone: defaultTaskTimezone(),
      }
      const buildFallback = () =>
        buildAgentWorkCalendarFallback({
          workspaceId: effectiveWorkspaceId!,
          startDate: params.startDate,
          endDate: params.endDate,
          groupType: agentWorkCalendarGroup,
          activityGapMinutes: params.activityGapMinutes,
          timeZone: params.timeZone,
        })

      try {
        const calendar = await sdk.workspaces.agentWorkCalendar(
          effectiveWorkspaceId!,
          params
        )
        const returnedEndDate = calendar.days[calendar.days.length - 1]
        if (
          calendar.days[0] !== params.startDate ||
          returnedEndDate !== params.endDate
        ) {
          return buildFallback()
        }
        return calendar
      } catch (error) {
        const message = error instanceof Error ? error.message : ""
        if (!message.includes("Cannot GET") && !message.includes("404")) {
          throw error
        }
        return buildFallback()
      }
    },
  })

  const {
    bridgeDevicesQuery,
    runtimeAuthorityQuery,
    runtimeProvisioningTargetsQuery,
    nativeObservationsQuery,
    connectNativeObservationsMutation,
    retryNativeObservationMutation,
    disconnectNativeObservationMutation,
    dismissNativeObservationMutation,
    scanRuntimeHostMutation,
    selectRuntimeProvisioningTargetMutation,
  } = useRelayNativeRuntimeActions({
    canAccessOperations,
    effectiveSection,
    effectiveWorkspaceId,
    isWorkspaceAdmin,
    queryClient,
    sessionActive: Boolean(session),
    setNativeDocumentConsent,
    setSelectedNativeObservationIds,
  })

  const [threadPatchOverrides, setThreadPatchOverrides] = useState<
    Record<string, Partial<import("@clawchat/contracts").Thread>>
  >({})

  const [taskPatchOverrides, setTaskPatchOverrides] = useState<
    Record<string, Partial<Task>>
  >({})
  return {
    ...input,
    agentDisplayNames,
    agentModelOptionsQuery,
    agentWorkCalendarDays,
    agentWorkCalendarEndDate,
    agentWorkCalendarQuery,
    agentWorkCalendarStartDate,
    agentsQuery,
    approvalsQuery,
    bridgeConnectionsQuery,
    bridgeDevicesQuery,
    companiesQuery,
    connectNativeObservationsMutation,
    departmentsQuery,
    disconnectNativeObservationMutation,
    dismissNativeObservationMutation,
    marketplaceCatalogQuery,
    marketplaceConnectionsQuery,
    marketplaceInstallsQuery,
    nativeObservationsQuery,
    openClawIntegrationStatusQuery,
    paperclipConnectionsQuery,
    reportsQuery,
    retryNativeObservationMutation,
    runtimeAuthorityQuery,
    runtimeProvisioningTargetsQuery,
    scanRuntimeHostMutation,
    selectRuntimeProvisioningTargetMutation,
    setAgentDisplayNames,
    setTaskPatchOverrides,
    setThreadPatchOverrides,
    taskPatchOverrides,
    tasksQuery,
    teamsQuery,
    threadPatchOverrides,
    threadsQuery,
    wrapUpReportsQuery,
  }
}
