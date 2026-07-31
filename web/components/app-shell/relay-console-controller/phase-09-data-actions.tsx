"use client"
import type {
  Message,
  Paginated,
  ThreadWrapUpReport,
} from "@clawchat/contracts"
import { useCallback, useMemo } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { DEFAULT_DEPARTMENT_COLOR } from "@/lib/department-avatar"
import { sdk } from "@/lib/sdk"
import {
  buildMessagesQueryKey,
  logMessageSyncDiagnostic,
  prependOlderMessagePage,
} from "@/lib/message-cache"
import { useRelayConsoleRealtime } from "@/hooks/use-clawchat-realtime"
import {
  listLatestThreadMessages,
  listThreadMessageWindow,
} from "@/components/app-shell/relay-controller-data"
import { useRelayAccountActions } from "@/features/account/use-relay-account-actions"
import { useRelayOrganizationActions } from "@/features/organizations/use-relay-organization-actions"
import { useRelayConsoleDetailQueries } from "./phase-08-detail-queries"
import {
  FIRST_WORKSPACE_SECTION,
  ReportKind,
  ReportListItem,
  isWrapUpReportPending,
} from "./shared"

export function useRelayConsoleDataActions(
  input: ReturnType<typeof useRelayConsoleDetailQueries>
) {
  const {
    accountDeletionConfirmationDraft,
    accountDeletionPasswordDraft,
    agentsManagementTab,
    billingConfirmationPending,
    billingReturn,
    clearSensitiveAuthDrafts,
    companies,
    companyIndustryDraft,
    companyNameDraft,
    confirmPasswordDraft,
    confirmResetPassword,
    currentPasswordDraft,
    departmentColorDraft,
    departmentCompanyIdDraft,
    departmentNameDraft,
    departmentRoomAssignments,
    departmentRoomDraft,
    departments,
    effectiveSection,
    effectiveThreadId,
    effectiveWorkspaceId,
    email,
    emailChangeToken,
    emailVerificationToken,
    inviteCode,
    messagesQuery,
    name,
    newPasswordDraft,
    password,
    passwordResetToken,
    queryClient,
    selectedCompany,
    selectedDepartment,
    selectedDepartmentColorDraft,
    selectedReport,
    selectedReportId,
    selectedTaskId,
    selectedTeam,
    selectedThread,
    serverEntitlements,
    session,
    setAccountDeletionConfirmationDraft,
    setAccountDeletionPasswordDraft,
    setArchivedReportMap,
    setArchivedTaskMap,
    setAuthMode,
    setBillingConfirmationPending,
    setBillingReturn,
    setCompanyIndustryDraft,
    setCompanyNameDraft,
    setConfirmPasswordDraft,
    setCurrentPasswordDraft,
    setDepartmentColorDraft,
    setDepartmentCompanyIdDraft,
    setDepartmentNameDraft,
    setDepartmentRoomAssignments,
    setDepartmentRoomDraft,
    setEmailChangeToken,
    setEmailVerificationToken,
    setNewPasswordDraft,
    setOpenedThreadOverride,
    setPasswordResetToken,
    setSection,
    setSelectedApprovalId,
    setSelectedCompanyId,
    setSelectedDepartmentId,
    setSelectedReportId,
    setSelectedReportKind,
    setSelectedTaskId,
    setSelectedTeamId,
    setSelectedThreadId,
    setSelectedWorkspaceId,
    setSettingsView,
    setSettingsWorkspaceNameDraft,
    setStructureCreateStatus,
    setTeamDepartmentIdDraft,
    setTeamNameDraft,
    setWorkspaceNameDraft,
    settingsUserEmailDraft,
    settingsUserNameDraft,
    settingsWorkspaceNameDraft,
    teamDepartmentIdDraft,
    teamNameDraft,
    viewedThreadSessionId,
    workspaceNameDraft,
    workspaceTypeDraft,
  } = input

  const archiveReportFromList = (reportId: string) => {
    setArchivedReportMap((current) => ({
      ...current,
      [reportId]: new Date().toISOString(),
    }))
    if (selectedReportId === reportId) {
      setSelectedReportId(null)
    }
    toast.success("Report archived from this list")
  }

  const selectReportFromList = (report: ReportListItem) => {
    const [kind] = report.id.split(":")
    setSelectedReportKind(kind as ReportKind)
    setSelectedReportId(report.id)
    if (report.kind === "wrap_up") {
      setOpenedThreadOverride(null)
      setSelectedThreadId(report.threadId)
    }
  }

  const archiveTaskFromList = (taskId: string) => {
    setArchivedTaskMap((current) => ({
      ...current,
      [taskId]: new Date().toISOString(),
    }))
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null)
    }
    toast.success("Task archived from this list")
  }

  const selectedReportQuery = useQuery({
    queryKey: ["report", selectedReport?.kind, selectedReport?.reportId],
    enabled: Boolean(session && selectedReport?.id),
    queryFn: async (): Promise<
      import("@clawchat/contracts").ReportSnapshot | ThreadWrapUpReport
    > =>
      selectedReport?.kind === "wrap_up"
        ? sdk.reports.wrapUpDetail(selectedReport.reportId)
        : sdk.reports.detail(selectedReport!.reportId),
    refetchInterval: (query) => {
      const report = query.state.data as ThreadWrapUpReport | undefined
      return selectedReport?.kind === "wrap_up" && isWrapUpReportPending(report)
        ? 3000
        : false
    },
  })

  const selectedThreadWrapUpReportsQuery = useQuery({
    queryKey: ["thread-wrap-up-reports", selectedThread?.id],
    enabled: Boolean(
      session &&
      effectiveWorkspaceId &&
      selectedThread?.id &&
      (selectedThread?.type === "team" || selectedThread?.type === "direct")
    ),
    queryFn: () =>
      sdk.reports.wrapUps(
        effectiveWorkspaceId!,
        undefined,
        1,
        20,
        selectedThread!.id
      ),
    refetchInterval: (query) => {
      const page = query.state.data as Paginated<ThreadWrapUpReport> | undefined
      return page?.data?.some(isWrapUpReportPending) ? 3000 : false
    },
  })

  const teamDashboardQuery = useQuery({
    queryKey: ["team-dashboard", selectedTeam?.id],
    enabled: Boolean(
      session && selectedTeam?.id && effectiveSection === "agents"
    ),
    queryFn: () => sdk.teams.dashboard(selectedTeam!.id),
  })

  const teamHandoversQuery = useQuery({
    queryKey: ["team-handovers", selectedTeam?.id],
    enabled: Boolean(
      session && selectedTeam?.id && effectiveSection === "agents"
    ),
    queryFn: () => sdk.teams.handovers(selectedTeam!.id, 1, 20),
  })

  const teamMemoryQuery = useQuery({
    queryKey: ["team-memory", selectedTeam?.id],
    enabled: Boolean(
      session && selectedTeam?.id && effectiveSection === "agents"
    ),
    queryFn: () =>
      sdk.teams.memory(selectedTeam!.id, undefined, undefined, 1, 50),
  })

  const departmentDashboardQuery = useQuery({
    queryKey: ["department-dashboard", selectedDepartment?.id],
    enabled: Boolean(
      session && selectedDepartment?.id && effectiveSection === "agents"
    ),
    queryFn: () => sdk.departments.dashboard(selectedDepartment!.id),
  })

  const departmentInboxQuery = useQuery({
    queryKey: ["department-inbox", selectedDepartment?.id],
    enabled: Boolean(
      session && selectedDepartment?.id && effectiveSection === "agents"
    ),
    queryFn: () => sdk.departments.inbox(selectedDepartment!.id, 1, 50),
  })

  const companyDetailQuery = useQuery({
    queryKey: ["company", selectedCompany?.id],
    enabled: Boolean(
      session && selectedCompany?.id && effectiveSection === "agents"
    ),
    queryFn: () => sdk.org.company(selectedCompany!.id),
  })

  const messages = useMemo(
    () => messagesQuery.data?.data ?? [],
    [messagesQuery.data?.data]
  )

  const latestMessage = messages[messages.length - 1] ?? null

  const oldestMessage = messages[0] ?? null

  const hasOlderMessages = Boolean(messagesQuery.data?.hasMore)

  const loadOlderMessagesMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveThreadId || !oldestMessage) {
        throw new Error("No older message cursor available")
      }

      return viewedThreadSessionId
        ? listThreadMessageWindow(
            effectiveThreadId,
            viewedThreadSessionId,
            oldestMessage.createdAt
          )
        : listLatestThreadMessages(effectiveThreadId, oldestMessage.createdAt)
    },
    onSuccess: (olderPage) => {
      if (!effectiveThreadId) {
        return
      }

      queryClient.setQueryData<Paginated<Message>>(
        buildMessagesQueryKey(effectiveThreadId, viewedThreadSessionId),
        (current) =>
          prependOlderMessagePage(current, olderPage.data, olderPage.hasMore)
      )
      logMessageSyncDiagnostic("older messages merged", {
        threadId: effectiveThreadId,
        received: olderPage.data.length,
        hasMore: olderPage.hasMore,
      })
    },
    onError: (error: Error) => {
      toast.error(`Could not load older messages: ${error.message}`)
    },
  })

  const messageLoadError =
    messagesQuery.error instanceof Error ? messagesQuery.error.message : null

  const shouldBlockMessageHistory = Boolean(
    messageLoadError && !messages.length
  )

  const handleSessionRevoked = useCallback(() => {
    queryClient.setQueryData(["session"], null)
  }, [queryClient])

  const realtime = useRelayConsoleRealtime({
    enabled: Boolean(session?.user && effectiveWorkspaceId),
    workspaceId: effectiveWorkspaceId,
    selectedThreadId: effectiveThreadId,
    onSessionRevoked: handleSessionRevoked,
  })

  const invalidateWorkspace = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["agents", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["tasks", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["approvals", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["reports", effectiveWorkspaceId],
      }),
    ])
  }, [effectiveWorkspaceId, queryClient])

  const invalidateStructure = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["agents", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["companies", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["departments", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["teams", effectiveWorkspaceId],
      }),
      invalidateWorkspace(),
    ])
  }, [effectiveWorkspaceId, invalidateWorkspace, queryClient])

  const {
    loginMutation,
    registerMutation,
    logoutMutation,
    changePasswordMutation,
    revokeWebSessionMutation,
    revokeAllWebSessionsMutation,
    passwordResetMutation,
    completePasswordResetMutation,
    emailChangeRequestMutation,
    resendEmailVerificationMutation,
    accountExportMutation,
    accountDeletionMutation,
    billingCheckoutMutation,
    billingPortalMutation,
    workspaceCreateMutation,
    profileUpdateMutation,
    workspaceUpdateMutation,
  } = useRelayAccountActions({
    accountDeletionConfirmationDraft,
    accountDeletionPasswordDraft,
    billingConfirmationPending,
    billingReturn,
    clearSensitiveAuthDrafts,
    confirmPasswordDraft,
    confirmResetPassword,
    currentPasswordDraft,
    effectiveWorkspaceId,
    email,
    emailChangeToken,
    emailVerificationToken,
    firstWorkspaceSection: FIRST_WORKSPACE_SECTION,
    inviteCode,
    name,
    newPasswordDraft,
    password,
    passwordResetToken,
    queryClient,
    serverEntitlements,
    session,
    settingsUserEmailDraft,
    settingsUserNameDraft,
    settingsWorkspaceNameDraft,
    setAccountDeletionConfirmationDraft,
    setAccountDeletionPasswordDraft,
    setAuthMode,
    setBillingConfirmationPending,
    setBillingReturn,
    setConfirmPasswordDraft,
    setCurrentPasswordDraft,
    setEmailChangeToken,
    setEmailVerificationToken,
    setNewPasswordDraft,
    setPasswordResetToken,
    setSection,
    setSelectedApprovalId,
    setSelectedThreadId,
    setSelectedWorkspaceId,
    setSettingsView,
    setSettingsWorkspaceNameDraft,
    setWorkspaceNameDraft,
    workspaceNameDraft,
    workspaceTypeDraft,
  })

  const {
    companyCreateMutation,
    departmentCreateMutation,
    departmentColorUpdateMutation,
    departmentDeleteMutation,
    teamCreateMutation,
  } = useRelayOrganizationActions({
    agentsManagementTab,
    companies,
    companyIndustryDraft,
    companyNameDraft,
    defaultDepartmentColor: DEFAULT_DEPARTMENT_COLOR,
    departmentColorDraft,
    departmentCompanyIdDraft,
    departmentNameDraft,
    departmentRoomAssignments,
    departmentRoomDraft,
    departments,
    effectiveWorkspaceId,
    invalidateStructure,
    selectedCompany,
    selectedDepartment,
    selectedDepartmentColorDraft,
    setCompanyIndustryDraft,
    setCompanyNameDraft,
    setDepartmentColorDraft,
    setDepartmentCompanyIdDraft,
    setDepartmentNameDraft,
    setDepartmentRoomAssignments,
    setDepartmentRoomDraft,
    setSelectedCompanyId,
    setSelectedDepartmentId,
    setSelectedTeamId,
    setStructureCreateStatus,
    setTeamDepartmentIdDraft,
    setTeamNameDraft,
    teamDepartmentIdDraft,
    teamNameDraft,
  })
  return {
    ...input,
    accountDeletionMutation,
    accountExportMutation,
    archiveReportFromList,
    archiveTaskFromList,
    billingCheckoutMutation,
    billingPortalMutation,
    changePasswordMutation,
    companyCreateMutation,
    companyDetailQuery,
    completePasswordResetMutation,
    emailChangeRequestMutation,
    departmentColorUpdateMutation,
    departmentCreateMutation,
    departmentDashboardQuery,
    departmentDeleteMutation,
    departmentInboxQuery,
    handleSessionRevoked,
    hasOlderMessages,
    invalidateStructure,
    invalidateWorkspace,
    latestMessage,
    loadOlderMessagesMutation,
    loginMutation,
    logoutMutation,
    messageLoadError,
    messages,
    oldestMessage,
    passwordResetMutation,
    profileUpdateMutation,
    realtime,
    registerMutation,
    resendEmailVerificationMutation,
    revokeAllWebSessionsMutation,
    revokeWebSessionMutation,
    selectReportFromList,
    selectedReportQuery,
    selectedThreadWrapUpReportsQuery,
    shouldBlockMessageHistory,
    teamCreateMutation,
    teamDashboardQuery,
    teamHandoversQuery,
    teamMemoryQuery,
    workspaceCreateMutation,
    workspaceUpdateMutation,
  }
}
