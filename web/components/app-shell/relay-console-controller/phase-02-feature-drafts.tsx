"use client"

import type { TaskRecurrenceRule, TaskTargetType } from "@clawchat/contracts"
import { useRef, useState } from "react"
import {
  type ResponsePresentationDraft,
  type RuntimeAgentDraftType,
} from "@/components/app-shell/relay-console-domain"
import { defaultRuntimeAgentModel } from "@/components/app-shell/relay-controller-data"
import { type ProvisionFileDraft } from "@/features/agents/agent-creation"
import {
  defaultTaskScheduleValue,
  defaultTaskTimezone,
} from "@/features/tasks/task-schedule"
import {
  AgentGroupType,
  DEFAULT_OPENCLAW_AGENT_MODEL,
  InsightsTab,
} from "./shared"

export function useRelayConsoleFeatureDrafts() {
  const [teamNameDraft, setTeamNameDraft] = useState("")
  const [taskTitleDraft, setTaskTitleDraft] = useState("")
  const [taskMessageDraft, setTaskMessageDraft] = useState("")
  const [taskPriorityDraft, setTaskPriorityDraft] = useState("normal")
  const [taskTargetTypeDraft, setTaskTargetTypeDraft] =
    useState<TaskTargetType>("direct")
  const [taskTargetAgentIdDraft, setTaskTargetAgentIdDraft] = useState("")
  const [taskTargetAgentTwoIdDraft, setTaskTargetAgentTwoIdDraft] = useState("")
  const [taskTargetTeamIdDraft, setTaskTargetTeamIdDraft] = useState("")
  const [taskTargetDepartmentIdDraft, setTaskTargetDepartmentIdDraft] =
    useState("")
  const [taskScheduleDraft, setTaskScheduleDraft] = useState(
    defaultTaskScheduleValue()
  )
  const [taskTimezoneDraft, setTaskTimezoneDraft] = useState(
    defaultTaskTimezone()
  )
  const [taskRecurrenceDraft, setTaskRecurrenceDraft] =
    useState<TaskRecurrenceRule>("none")
  const [taskRequiresApprovalDraft, setTaskRequiresApprovalDraft] =
    useState(false)
  const [taskEditTitleDraft, setTaskEditTitleDraft] = useState("")
  const [taskEditMessageDraft, setTaskEditMessageDraft] = useState("")
  const [taskEditScheduleDraft, setTaskEditScheduleDraft] = useState("")
  const [taskEditTimezoneDraft, setTaskEditTimezoneDraft] = useState(
    defaultTaskTimezone()
  )
  const [taskEditRecurrenceDraft, setTaskEditRecurrenceDraft] =
    useState<TaskRecurrenceRule>("none")
  const [reportSearchDraft, setReportSearchDraft] = useState("")
  const [reportSourceFilter, setReportSourceFilter] = useState<
    "all" | "snapshot" | "wrap_up"
  >("all")
  const [reportSortDraft, setReportSortDraft] = useState<
    "newest" | "oldest" | "title"
  >("newest")
  const [insightsTab, setInsightsTab] = useState<InsightsTab>("report")
  const [expandedReportGroupIds, setExpandedReportGroupIds] = useState<
    Record<string, boolean>
  >({})
  const [wrapUpMarkdownExpanded, setWrapUpMarkdownExpanded] = useState(true)
  const [wrapUpStructuredExpanded, setWrapUpStructuredExpanded] =
    useState(false)
  const [connectionUrlDraft, setConnectionUrlDraft] = useState("")
  const [connectionApiKeyDraft, setConnectionApiKeyDraft] = useState("")
  const [testingPaperclipConnectionId, setTestingPaperclipConnectionId] =
    useState<string | null>(null)
  const [settingsUserNameDraft, setSettingsUserNameDraft] = useState("")
  const [settingsUserEmailDraft, setSettingsUserEmailDraft] = useState("")
  const [settingsWorkspaceNameDraft, setSettingsWorkspaceNameDraft] =
    useState("")
  const [currentPasswordDraft, setCurrentPasswordDraft] = useState("")
  const [newPasswordDraft, setNewPasswordDraft] = useState("")
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState("")
  const [accountDeletionPasswordDraft, setAccountDeletionPasswordDraft] =
    useState("")
  const [
    accountDeletionConfirmationDraft,
    setAccountDeletionConfirmationDraft,
  ] = useState("")
  const [memoryTitleDraft, setMemoryTitleDraft] = useState("")
  const [memoryContentDraft, setMemoryContentDraft] = useState("")
  const [memoryTypeDraft, setMemoryTypeDraft] = useState("note")
  const [, setGroupAgentTypeDraft] = useState<AgentGroupType>("business")
  const [, setGroupAgentLabelDraft] = useState("")
  const [isProvisioningAgent, setIsProvisioningAgent] = useState(false)
  const [isLibraryManagerOpen, setIsLibraryManagerOpen] = useState(false)
  const [provisionAgentNameDraft, setProvisionAgentNameDraft] = useState("")
  const [provisionAgentSlugDraft, setProvisionAgentSlugDraft] = useState("")
  const [provisionAgentSlugTouched, setProvisionAgentSlugTouched] =
    useState(false)
  const [provisionAgentRoleDraft, setProvisionAgentRoleDraft] = useState("")
  const [provisionAgentModelDraft, setProvisionAgentModelDraft] = useState(
    DEFAULT_OPENCLAW_AGENT_MODEL
  )
  const [provisionAgentGroupTypeDraft, setProvisionAgentGroupTypeDraft] =
    useState<AgentGroupType>("personal")
  const [provisionAgentGroupLabelDraft, setProvisionAgentGroupLabelDraft] =
    useState("")
  const [provisionAgentCompanyIdDraft, setProvisionAgentCompanyIdDraft] =
    useState("")
  const [provisionAgentDepartmentIdDraft, setProvisionAgentDepartmentIdDraft] =
    useState("")
  const [provisionAgentTeamIdDraft, setProvisionAgentTeamIdDraft] = useState("")
  const [provisionConnectionIdDraft, setProvisionConnectionIdDraft] =
    useState("")
  const [runtimeAgentTypeDraft, setRuntimeAgentTypeDraft] =
    useState<RuntimeAgentDraftType>("openclaw")
  const [runtimeAgentNameDraft, setRuntimeAgentNameDraft] = useState("")
  const [runtimeAgentExternalIdDraft, setRuntimeAgentExternalIdDraft] =
    useState("")
  const [runtimeAgentExternalIdTouched, setRuntimeAgentExternalIdTouched] =
    useState(false)
  const [runtimeAgentRoleDraft, setRuntimeAgentRoleDraft] = useState("")
  const [runtimeAgentRepoKeyDraft, setRuntimeAgentRepoKeyDraft] = useState("")
  const [runtimeAgentWorkspaceRootDraft, setRuntimeAgentWorkspaceRootDraft] =
    useState("")
  const [runtimeAgentModelDraft, setRuntimeAgentModelDraft] = useState(
    defaultRuntimeAgentModel("claude_code")
  )
  const [createAgentAvatarUrl, setCreateAgentAvatarUrl] = useState<
    string | null
  >(null)
  const [createAgentResponsePresentation, setCreateAgentResponsePresentation] =
    useState<ResponsePresentationDraft>("standard")
  const [customCreateAgentAvatarUrl, setCustomCreateAgentAvatarUrl] = useState<
    string | null
  >(null)
  const [isCreateAgentManagerDraft, setIsCreateAgentManagerDraft] =
    useState(false)
  const [
    pendingProvisionManagerAssignment,
    setPendingProvisionManagerAssignment,
  ] = useState<{
    jobId: string
    departmentId: string
  } | null>(null)
  const [provisionFileDrafts, setProvisionFileDrafts] = useState<
    ProvisionFileDraft[]
  >([])
  const [activeProvisionJobId, setActiveProvisionJobId] = useState<
    string | null
  >(null)
  const [selectedLibraryFolder] = useState("")
  const [selectedLibraryFileName, setSelectedLibraryFileName] = useState<
    string | null
  >(null)
  const [, setLibraryEditorFilename] = useState("")
  const [, setLibraryEditorContent] = useState("")
  const [, setLibraryEditorDirty] = useState(false)
  const handledProvisionJobIdsRef = useRef<Set<string>>(new Set())

  return {
    accountDeletionConfirmationDraft,
    accountDeletionPasswordDraft,
    activeProvisionJobId,
    confirmPasswordDraft,
    connectionApiKeyDraft,
    connectionUrlDraft,
    createAgentAvatarUrl,
    createAgentResponsePresentation,
    currentPasswordDraft,
    customCreateAgentAvatarUrl,
    expandedReportGroupIds,
    handledProvisionJobIdsRef,
    insightsTab,
    isCreateAgentManagerDraft,
    isLibraryManagerOpen,
    isProvisioningAgent,
    memoryContentDraft,
    memoryTitleDraft,
    memoryTypeDraft,
    newPasswordDraft,
    pendingProvisionManagerAssignment,
    provisionAgentCompanyIdDraft,
    provisionAgentDepartmentIdDraft,
    provisionAgentGroupLabelDraft,
    provisionAgentGroupTypeDraft,
    provisionAgentModelDraft,
    provisionAgentNameDraft,
    provisionAgentRoleDraft,
    provisionAgentSlugDraft,
    provisionAgentSlugTouched,
    provisionAgentTeamIdDraft,
    provisionConnectionIdDraft,
    provisionFileDrafts,
    reportSearchDraft,
    reportSortDraft,
    reportSourceFilter,
    runtimeAgentExternalIdDraft,
    runtimeAgentExternalIdTouched,
    runtimeAgentModelDraft,
    runtimeAgentNameDraft,
    runtimeAgentRepoKeyDraft,
    runtimeAgentRoleDraft,
    runtimeAgentTypeDraft,
    runtimeAgentWorkspaceRootDraft,
    selectedLibraryFileName,
    selectedLibraryFolder,
    setAccountDeletionConfirmationDraft,
    setAccountDeletionPasswordDraft,
    setActiveProvisionJobId,
    setConfirmPasswordDraft,
    setConnectionApiKeyDraft,
    setConnectionUrlDraft,
    setCreateAgentAvatarUrl,
    setCreateAgentResponsePresentation,
    setCurrentPasswordDraft,
    setCustomCreateAgentAvatarUrl,
    setExpandedReportGroupIds,
    setGroupAgentLabelDraft,
    setGroupAgentTypeDraft,
    setInsightsTab,
    setIsCreateAgentManagerDraft,
    setIsLibraryManagerOpen,
    setIsProvisioningAgent,
    setLibraryEditorContent,
    setLibraryEditorDirty,
    setLibraryEditorFilename,
    setMemoryContentDraft,
    setMemoryTitleDraft,
    setMemoryTypeDraft,
    setNewPasswordDraft,
    setPendingProvisionManagerAssignment,
    setProvisionAgentCompanyIdDraft,
    setProvisionAgentDepartmentIdDraft,
    setProvisionAgentGroupLabelDraft,
    setProvisionAgentGroupTypeDraft,
    setProvisionAgentModelDraft,
    setProvisionAgentNameDraft,
    setProvisionAgentRoleDraft,
    setProvisionAgentSlugDraft,
    setProvisionAgentSlugTouched,
    setProvisionAgentTeamIdDraft,
    setProvisionConnectionIdDraft,
    setProvisionFileDrafts,
    setReportSearchDraft,
    setReportSortDraft,
    setReportSourceFilter,
    setRuntimeAgentExternalIdDraft,
    setRuntimeAgentExternalIdTouched,
    setRuntimeAgentModelDraft,
    setRuntimeAgentNameDraft,
    setRuntimeAgentRepoKeyDraft,
    setRuntimeAgentRoleDraft,
    setRuntimeAgentTypeDraft,
    setRuntimeAgentWorkspaceRootDraft,
    setSelectedLibraryFileName,
    setSettingsUserEmailDraft,
    setSettingsUserNameDraft,
    setSettingsWorkspaceNameDraft,
    setTaskEditMessageDraft,
    setTaskEditRecurrenceDraft,
    setTaskEditScheduleDraft,
    setTaskEditTimezoneDraft,
    setTaskEditTitleDraft,
    setTaskMessageDraft,
    setTaskPriorityDraft,
    setTaskRecurrenceDraft,
    setTaskRequiresApprovalDraft,
    setTaskScheduleDraft,
    setTaskTargetAgentIdDraft,
    setTaskTargetAgentTwoIdDraft,
    setTaskTargetDepartmentIdDraft,
    setTaskTargetTeamIdDraft,
    setTaskTargetTypeDraft,
    setTaskTimezoneDraft,
    setTaskTitleDraft,
    setTeamNameDraft,
    setTestingPaperclipConnectionId,
    setWrapUpMarkdownExpanded,
    setWrapUpStructuredExpanded,
    settingsUserEmailDraft,
    settingsUserNameDraft,
    settingsWorkspaceNameDraft,
    taskEditMessageDraft,
    taskEditRecurrenceDraft,
    taskEditScheduleDraft,
    taskEditTimezoneDraft,
    taskEditTitleDraft,
    taskMessageDraft,
    taskPriorityDraft,
    taskRecurrenceDraft,
    taskRequiresApprovalDraft,
    taskScheduleDraft,
    taskTargetAgentIdDraft,
    taskTargetAgentTwoIdDraft,
    taskTargetDepartmentIdDraft,
    taskTargetTeamIdDraft,
    taskTargetTypeDraft,
    taskTimezoneDraft,
    taskTitleDraft,
    teamNameDraft,
    testingPaperclipConnectionId,
    wrapUpMarkdownExpanded,
    wrapUpStructuredExpanded,
  }
}
