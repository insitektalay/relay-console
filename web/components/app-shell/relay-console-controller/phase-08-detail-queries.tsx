"use client"
/* eslint-disable react-hooks/exhaustive-deps -- Controller phases receive stable React setters and refs from prior hooks. */
import type { AgentProvisioningJob } from "@clawchat/contracts"
import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { DEFAULT_DEPARTMENT_COLOR } from "@/lib/department-avatar"
import { sdk } from "@/lib/sdk"
import { buildMessagesQueryKey } from "@/lib/message-cache"
import {
  getAgentRuntimeType,
  listLatestThreadMessages,
  listThreadMessageWindow,
} from "@/components/app-shell/relay-controller-data"
import { DEFAULT_AGENTOPS_LAYOUT } from "@/components/agent-ops-hq/domain/default-estate-layout"
import { normalizeLibraryFolderPath } from "@/components/agents/openclaw-library-paths"
import { loadAgentOpsLayoutOverride } from "@/components/agent-ops-hq/domain/layout-editor"
import {
  getAssignableDepartmentRooms,
  loadDepartmentRoomAssignments,
} from "@/components/agent-ops-hq/domain/department-room-assignments"
import { getRuntimeLabel } from "@/features/agents/agent-creation"
import {
  defaultTaskTimezone,
  toDatetimeLocalValue,
} from "@/features/tasks/task-schedule"
import { useRelayConsoleSelection } from "./phase-07-selection"
import { logAppPerf, slugifyOpenClawId } from "./shared"

export function useRelayConsoleDetailQueries(
  input: ReturnType<typeof useRelayConsoleSelection>
) {
  const {
    activeProvisionJobId,
    agentDisplayNames,
    canAccessLocalWorkspaceFiles,
    companies,
    effectiveApprovalId,
    effectiveSection,
    effectiveThreadId,
    effectiveWorkspaceId,
    isLibraryManagerOpen,
    provisionAgentCompanyIdDraft,
    provisionAgentDepartmentIdDraft,
    provisionAgentGroupTypeDraft,
    provisionAgentNameDraft,
    provisionAgentSlugTouched,
    resolveAgentDisplayName,
    runtimeAgentExternalIdTouched,
    runtimeAgentNameDraft,
    selectedAgent,
    selectedAgentGroup,
    selectedAgentId,
    selectedDepartment,
    selectedLibraryFileName,
    selectedLibraryFolder,
    selectedReport,
    selectedRunId,
    selectedTask,
    selectedWrappedTranscript,
    session,
    setAgentDisplayNameDraft,
    setAgentIsEditing,
    setDepartmentRoomAssignments,
    setIsCreateAgentManagerDraft,
    setIsLibraryManagerOpen,
    setLibraryEditorContent,
    setLibraryEditorDirty,
    setLibraryEditorFilename,
    setProvisionAgentCompanyIdDraft,
    setProvisionAgentSlugDraft,
    setRuntimeAgentExternalIdDraft,
    setSelectedDepartmentColorDraft,
    setSelectedLibraryFileName,
    setSettingsUserEmailDraft,
    setSettingsUserNameDraft,
    setSettingsWorkspaceNameDraft,
    setTaskEditMessageDraft,
    setTaskEditRecurrenceDraft,
    setTaskEditScheduleDraft,
    setTaskEditTimezoneDraft,
    setTaskEditTitleDraft,
    setWrapUpMarkdownExpanded,
    setWrapUpStructuredExpanded,
    taskPatchOverrides,
    workspace,
  } = input

  useEffect(() => {
    setSelectedDepartmentColorDraft(
      selectedDepartment?.color?.trim() || DEFAULT_DEPARTMENT_COLOR
    )
  }, [selectedDepartment?.color, selectedDepartment?.id])

  useEffect(() => {
    setDepartmentRoomAssignments(
      loadDepartmentRoomAssignments(effectiveWorkspaceId)
    )
  }, [effectiveWorkspaceId])

  const agentOpsDepartmentLayout = useMemo(
    () => loadAgentOpsLayoutOverride() ?? DEFAULT_AGENTOPS_LAYOUT,
    []
  )

  const agentOpsDepartmentRooms = useMemo(
    () => getAssignableDepartmentRooms(agentOpsDepartmentLayout),
    [agentOpsDepartmentLayout]
  )

  const viewedWrappedTranscript =
    selectedWrappedTranscript?.threadId === effectiveThreadId
      ? selectedWrappedTranscript
      : null

  const viewedThreadSessionId = viewedWrappedTranscript?.threadSessionId

  const messagesQuery = useQuery({
    queryKey: effectiveThreadId
      ? buildMessagesQueryKey(effectiveThreadId, viewedThreadSessionId)
      : ["messages", "none", "active"],
    enabled: Boolean(session && effectiveThreadId),
    queryFn: async () => {
      logAppPerf("active chat messages fetch start", {
        threadId: effectiveThreadId,
        threadSessionId: viewedThreadSessionId ?? "active",
      })
      const page = viewedThreadSessionId
        ? await listThreadMessageWindow(
            effectiveThreadId!,
            viewedThreadSessionId
          )
        : await listLatestThreadMessages(effectiveThreadId!)
      logAppPerf("active chat messages fetch complete", {
        threadId: effectiveThreadId,
        count: page.data.length,
        hasMore: page.hasMore,
      })
      return page
    },
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })

  const selectedApprovalQuery = useQuery({
    queryKey: ["approval", effectiveApprovalId],
    enabled: Boolean(session && effectiveApprovalId),
    queryFn: () => sdk.approvals.detail(effectiveApprovalId!),
  })

  const selectedAgentDetailQuery = useQuery({
    queryKey: ["agent", selectedAgent?.id],
    enabled: Boolean(
      session && selectedAgent?.id && effectiveSection === "agents"
    ),
    queryFn: () => sdk.agents.detail(selectedAgent!.id),
  })

  const activeProvisionJobQuery = useQuery({
    queryKey: ["agent-provision-job", activeProvisionJobId],
    enabled: Boolean(session && activeProvisionJobId),
    queryFn: () => sdk.agents.provisionJob(activeProvisionJobId!),
    refetchInterval: (query) => {
      const job = query.state.data as AgentProvisioningJob | undefined
      return job && ["completed", "failed"].includes(job.status) ? false : 2000
    },
  })

  const libraryListQuery = useQuery({
    queryKey: [
      "workspace-library",
      effectiveWorkspaceId,
      selectedLibraryFolder,
    ],
    enabled: Boolean(
      session &&
      effectiveWorkspaceId &&
      isLibraryManagerOpen &&
      canAccessLocalWorkspaceFiles
    ),
    queryFn: () =>
      sdk.workspaces.libraryList(
        effectiveWorkspaceId!,
        normalizeLibraryFolderPath(selectedLibraryFolder)
      ),
  })

  const libraryReadQuery = useQuery({
    queryKey: [
      "workspace-library-file",
      effectiveWorkspaceId,
      selectedLibraryFolder,
      selectedLibraryFileName,
    ],
    enabled: Boolean(
      session &&
      effectiveWorkspaceId &&
      isLibraryManagerOpen &&
      selectedLibraryFileName &&
      canAccessLocalWorkspaceFiles
    ),
    queryFn: () =>
      sdk.workspaces.libraryReadFile(
        effectiveWorkspaceId!,
        normalizeLibraryFolderPath(selectedLibraryFolder),
        selectedLibraryFileName!
      ),
  })

  const selectedAgentRecord = selectedAgentDetailQuery.data ?? selectedAgent

  const selectedAgentDisplayName = selectedAgentRecord
    ? resolveAgentDisplayName(selectedAgentRecord)
    : selectedAgent
      ? resolveAgentDisplayName(selectedAgent)
      : null

  const selectedAgentRuntimeType = getAgentRuntimeType(selectedAgentRecord)

  const selectedAgentRuntimeLabel = getRuntimeLabel(selectedAgentRuntimeType)

  useEffect(() => {
    if (!selectedAgentGroup) {
      setAgentDisplayNameDraft("")
      return
    }

    const currentAlias = selectedAgentGroup.allAgentIds
      .map((agentId) => agentDisplayNames[agentId]?.trim())
      .find(Boolean)

    setAgentDisplayNameDraft(currentAlias ?? selectedAgentGroup.primary.name)
  }, [agentDisplayNames, selectedAgentGroup])

  useEffect(() => {
    setAgentIsEditing(false)
    setIsLibraryManagerOpen(false)
  }, [selectedAgentId])

  useEffect(() => {
    if (selectedAgentRuntimeType !== "openclaw" && isLibraryManagerOpen) {
      setIsLibraryManagerOpen(false)
    }
  }, [isLibraryManagerOpen, selectedAgentRuntimeType])

  useEffect(() => {
    if (provisionAgentSlugTouched) return
    setProvisionAgentSlugDraft(slugifyOpenClawId(provisionAgentNameDraft))
  }, [provisionAgentNameDraft, provisionAgentSlugTouched])

  useEffect(() => {
    if (provisionAgentCompanyIdDraft) return
    const nexusCorp = companies.find(
      (c) => c.name.toLowerCase() === "nexus corp"
    )
    if (nexusCorp) setProvisionAgentCompanyIdDraft(nexusCorp.id)
  }, [companies, provisionAgentCompanyIdDraft])

  useEffect(() => {
    if (runtimeAgentExternalIdTouched) return
    setRuntimeAgentExternalIdDraft(slugifyOpenClawId(runtimeAgentNameDraft))
  }, [runtimeAgentExternalIdTouched, runtimeAgentNameDraft])

  useEffect(() => {
    if (
      provisionAgentGroupTypeDraft !== "business" ||
      !provisionAgentDepartmentIdDraft
    ) {
      setIsCreateAgentManagerDraft(false)
    }
  }, [provisionAgentDepartmentIdDraft, provisionAgentGroupTypeDraft])

  useEffect(() => {
    setSelectedLibraryFileName(null)
    setLibraryEditorFilename("")
    setLibraryEditorContent("")
    setLibraryEditorDirty(false)
  }, [selectedLibraryFolder])

  useEffect(() => {
    const currentFiles = libraryListQuery.data?.files ?? []
    if (
      selectedLibraryFileName &&
      !currentFiles.some((entry) => entry.filename === selectedLibraryFileName)
    ) {
      setSelectedLibraryFileName(null)
      setLibraryEditorFilename("")
      setLibraryEditorContent("")
      setLibraryEditorDirty(false)
    }
  }, [libraryListQuery.data?.files, selectedLibraryFileName])

  useEffect(() => {
    const file = libraryReadQuery.data
    if (!file) return
    setLibraryEditorFilename(file.filename)
    setLibraryEditorContent(file.content)
    setLibraryEditorDirty(false)
  }, [libraryReadQuery.data])

  useEffect(() => {
    if (selectedReport?.kind !== "wrap_up") return
    setWrapUpMarkdownExpanded(true)
    setWrapUpStructuredExpanded(false)
  }, [selectedReport?.kind, selectedReport?.reportId])

  useEffect(() => {
    if (!session?.user) return
    setSettingsUserNameDraft(session.user.name ?? "")
    setSettingsUserEmailDraft(session.user.email ?? "")
  }, [session?.user])

  useEffect(() => {
    setSettingsWorkspaceNameDraft(workspace?.name ?? "")
  }, [workspace?.name])

  const selectedTaskDetailQuery = useQuery({
    queryKey: ["task", selectedTask?.id],
    enabled: Boolean(session && selectedTask?.id),
    queryFn: () => sdk.tasks.detail(selectedTask!.id),
  })

  const selectedTaskDetail = useMemo(() => {
    const detail = selectedTaskDetailQuery.data
    if (!detail) return detail
    const override = taskPatchOverrides[detail.id]
    return override ? { ...detail, ...override } : detail
  }, [selectedTaskDetailQuery.data, taskPatchOverrides])

  const selectedTaskRunsQuery = useQuery({
    queryKey: ["task-runs", selectedTask?.id],
    enabled: Boolean(session && selectedTask?.id),
    queryFn: () => sdk.tasks.runs(selectedTask!.id, 1, 20),
  })

  const selectedRunEventsQuery = useQuery({
    queryKey: ["run-events", selectedRunId],
    enabled: Boolean(session && selectedRunId),
    queryFn: () => sdk.tasks.runEvents(selectedRunId!, 1, 50),
  })

  useEffect(() => {
    const task = selectedTaskDetail ?? selectedTask
    if (!task) {
      setTaskEditTitleDraft("")
      setTaskEditMessageDraft("")
      setTaskEditScheduleDraft("")
      setTaskEditTimezoneDraft(defaultTaskTimezone())
      setTaskEditRecurrenceDraft("none")
      return
    }

    setTaskEditTitleDraft(task.title)
    setTaskEditMessageDraft(task.messageBody ?? task.description ?? "")
    setTaskEditScheduleDraft(
      toDatetimeLocalValue(
        task.nextRunAt ?? task.scheduledFor,
        task.timezone || defaultTaskTimezone()
      )
    )
    setTaskEditTimezoneDraft(task.timezone || defaultTaskTimezone())
    setTaskEditRecurrenceDraft(task.recurrenceRule ?? "none")
  }, [
    selectedTask,
    selectedTask?.id,
    selectedTask?.title,
    selectedTask?.description,
    selectedTask?.messageBody,
    selectedTask?.nextRunAt,
    selectedTask?.scheduledFor,
    selectedTask?.timezone,
    selectedTask?.recurrenceRule,
    selectedTaskDetail,
  ])
  return {
    ...input,
    activeProvisionJobQuery,
    agentOpsDepartmentLayout,
    agentOpsDepartmentRooms,
    libraryListQuery,
    libraryReadQuery,
    messagesQuery,
    selectedAgentDetailQuery,
    selectedAgentDisplayName,
    selectedAgentRecord,
    selectedAgentRuntimeLabel,
    selectedAgentRuntimeType,
    selectedApprovalQuery,
    selectedRunEventsQuery,
    selectedTaskDetail,
    selectedTaskDetailQuery,
    selectedTaskRunsQuery,
    viewedThreadSessionId,
    viewedWrappedTranscript,
  }
}
