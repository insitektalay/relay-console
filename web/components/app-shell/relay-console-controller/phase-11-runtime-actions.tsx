"use client"
import { useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"
import { useRelayAgentActions } from "@/features/agents/use-relay-agent-actions"
import { useRelayApprovalActions } from "@/features/approvals/use-relay-approval-actions"
import { useRelayIntegrationActions } from "@/features/integrations/use-relay-integration-actions"
import { useRelayRuntimeDispatchActions } from "@/features/runtime/use-relay-runtime-dispatch-actions"
import { useRelayTaskCreateAction } from "@/features/tasks/use-relay-task-create-action"
import { useRelayTaskActions } from "@/features/tasks/use-relay-task-actions"
import {
  mapThreadPages,
  type ThreadPages,
} from "@/features/threads/thread-pages"
import { useRelaySendMessageAction } from "@/features/threads/use-relay-send-message-action"
import { useRelayConsoleThreadActions } from "./phase-10-thread-actions"

export function useRelayConsoleRuntimeActions(
  input: ReturnType<typeof useRelayConsoleThreadActions>
) {
  const {
    addNewChatThread,
    agents,
    agentsById,
    approvalNote,
    bridgeDeviceLabelDraft,
    connectionApiKeyDraft,
    connectionUrlDraft,
    createAgentAvatarUrl,
    createAgentResponsePresentation,
    departments,
    departmentsById,
    displayNameByAgentId,
    effectiveApprovalId,
    effectiveWorkspaceId,
    ensureTaskThread,
    handledProvisionJobIdsRef,
    invalidateStructure,
    isCreateAgentManagerDraft,
    memoryContentDraft,
    memoryTitleDraft,
    memoryTypeDraft,
    messageDraft,
    messages,
    newChatNewTeamDeptId,
    newChatNewTeamName,
    provisionAgentCompanyIdDraft,
    provisionAgentDepartmentIdDraft,
    provisionAgentGroupLabelDraft,
    provisionAgentGroupTypeDraft,
    provisionAgentModelDraft,
    provisionAgentNameDraft,
    provisionAgentRoleDraft,
    provisionAgentSlugDraft,
    provisionAgentTeamIdDraft,
    provisionConnectionIdDraft,
    provisionFileDrafts,
    queryClient,
    resetRuntimeAgentForm,
    runtimeAgentExternalIdDraft,
    runtimeAgentModelDraft,
    runtimeAgentNameDraft,
    runtimeAgentRepoKeyDraft,
    runtimeAgentRoleDraft,
    runtimeAgentTypeDraft,
    runtimeAgentWorkspaceRootDraft,
    runtimeExperience,
    selectedAgent,
    selectedTask,
    selectedTeam,
    selectedThread,
    selectedWorkspaceId,
    session,
    setActiveBridgeEnrollment,
    setActiveProvisionJobId,
    setAgentIsEditing,
    setAgentsManagementTab,
    setApprovalNote,
    setAwaitingAgentReply,
    setConnectionApiKeyDraft,
    setConnectionUrlDraft,
    setCustomCreateAgentAvatarUrl,
    setIsCreatingTask,
    setIsProvisioningAgent,
    setMemoryContentDraft,
    setMemoryTitleDraft,
    setMessageDraft,
    setNewChatAgentOneId,
    setNewChatAgentTwoId,
    setNewChatNewTeamName,
    setNewChatNewTeamSelectedAgentIds,
    setNewChatShowNewTeamForm,
    setPendingProvisionManagerAssignment,
    setSection,
    setSelectedAgentId,
    setSelectedRunId,
    setSelectedTaskId,
    setSelectedWorkspaceId,
    setSelectedWrappedTranscript,
    setTaskMessageDraft,
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
    setTestingPaperclipConnectionId,
    setThreadPatchOverrides,
    syncTaskPatchOverride,
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
    teams,
    viewedWrappedTranscript,
  } = input

  const newChatCreateTeamMutation = useMutation({
    mutationFn: async (selectedAgentIds: string[]) => {
      const deptId = newChatNewTeamDeptId?.trim() || undefined
      const name = newChatNewTeamName.trim()
      if (!name) throw new Error("Enter a team name")
      if (!selectedAgentIds.length) throw new Error("Select at least one agent")
      if (!effectiveWorkspaceId) throw new Error("Workspace unavailable")
      return sdk.threads.create(effectiveWorkspaceId, {
        title: name,
        type: "team",
        departmentId: deptId,
        agentIds: selectedAgentIds,
        workspaceId: effectiveWorkspaceId,
      })
    },
    onSuccess: (thread) => {
      addNewChatThread(thread)
      setNewChatNewTeamName("")
      setNewChatNewTeamSelectedAgentIds(new Set())
      setNewChatShowNewTeamForm(false)
      toast.success("Team chat created")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const agentToAgentChatMutation = useMutation({
    mutationFn: async ({
      agentOneId,
      agentTwoId,
    }: {
      agentOneId: string
      agentTwoId: string
    }) => {
      const a1 = agents.find((a) => a.id === agentOneId)
      const a2 = agents.find((a) => a.id === agentTwoId)
      if (!a1 || !a2 || !effectiveWorkspaceId)
        throw new Error("Agents or workspace unavailable")
      return sdk.threads.create(effectiveWorkspaceId, {
        title: `${a1.name} ↔ ${a2.name}`,
        type: "agent_to_agent",
        agentIds: [a1.id, a2.id],
        workspaceId: effectiveWorkspaceId,
      })
    },
    onSuccess: (thread) => {
      addNewChatThread(thread)
      setNewChatAgentOneId(null)
      setNewChatAgentTwoId(null)
      toast.success(`Agent coordination started`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const teamMemberMutation = useMutation({
    mutationFn: async ({
      threadId,
      newAgentIds,
    }: {
      threadId: string
      newAgentIds: string[]
    }) => {
      await sdk.threads.update(threadId, { agentIds: newAgentIds })
    },
    onMutate: async ({ threadId, newAgentIds }) => {
      // Cancel any in-flight refetch so it doesn't overwrite our optimistic update.
      await queryClient.cancelQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      })
      queryClient.setQueriesData<ThreadPages>(
        { queryKey: ["threads", effectiveWorkspaceId] },
        (old) =>
          mapThreadPages(old, (t) =>
            t.id === threadId ? { ...t, agentIds: newAgentIds } : t
          )
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const threadUpdateMutation = useMutation({
    mutationFn: ({
      threadId,
      patch,
    }: {
      threadId: string
      patch: { avatarUrl?: string }
    }) => sdk.threads.update(threadId, patch),
    onMutate: async ({ threadId, patch }) => {
      await queryClient.cancelQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      })
      queryClient.setQueriesData<ThreadPages>(
        { queryKey: ["threads", effectiveWorkspaceId] },
        (old) =>
          mapThreadPages(old, (t) =>
            t.id === threadId ? { ...t, ...patch } : t
          )
      )
      setThreadPatchOverrides((current) => ({
        ...current,
        [threadId]: {
          ...(current[threadId] ?? {}),
          ...patch,
        },
      }))
      return { threadId, patch }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const teamDeleteMutation = useMutation({
    mutationFn: (teamId: string) => sdk.teams.delete(teamId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["teams", effectiveWorkspaceId],
      })
      toast.success("Team deleted")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const { taskCreateMutation } = useRelayTaskCreateAction({
    departments,
    effectiveWorkspaceId,
    ensureTaskThread,
    queryClient,
    setAgentsManagementTab,
    setIsCreatingTask,
    setSection,
    setSelectedRunId,
    setSelectedTaskId,
    setTaskMessageDraft,
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
    syncTaskPatchOverride,
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
    teams,
  })

  const {
    bridgeConnectionCreateMutation,
    bridgeEnrollmentCreateMutation,
    revokeBridgeDeviceMutation,
    bridgeSyncMutation,
    paperclipConnectionCreateMutation,
    paperclipConnectionUpdateMutation,
    paperclipConnectionTestMutation,
    paperclipThreadLinkMutation,
    paperclipThreadUnlinkMutation,
  } = useRelayIntegrationActions({
    bridgeDeviceLabelDraft,
    connectionApiKeyDraft,
    connectionUrlDraft,
    effectiveWorkspaceId,
    queryClient,
    setActiveBridgeEnrollment,
    setConnectionApiKeyDraft,
    setConnectionUrlDraft,
    setTestingPaperclipConnectionId,
  })

  const { sendMessageMutation } = useRelaySendMessageAction({
    effectiveWorkspaceId,
    messageDraft,
    queryClient,
    selectedThread,
    session,
    setAwaitingAgentReply,
    setMessageDraft,
  })

  const { handleCancelRuntimeDispatch, handleRetryRuntimeDispatch } =
    useRelayRuntimeDispatchActions({
      messages,
      runtimeExperience,
      selectedThread,
      sendMessageMutation,
      setSelectedWrappedTranscript,
      viewedWrappedTranscript,
    })

  const { approvalDecisionMutation } = useRelayApprovalActions({
    approvalNote,
    effectiveApprovalId,
    effectiveWorkspaceId,
    queryClient,
    setApprovalNote,
  })

  const {
    agentAvatarMutation,
    agentClassificationMutation,
    agentDeleteMutation,
    assignCreatedAgentAsDepartmentManager,
    handleCreateAgentAvatarUpload,
    provisionAgentMutation,
    runtimeAgentCreateMutation,
  } = useRelayAgentActions({
    agentsById,
    createAgentAvatarUrl,
    createAgentResponsePresentation,
    departmentsById,
    displayNameByAgentId,
    effectiveWorkspaceId,
    handledProvisionJobIdsRef,
    invalidateStructure,
    isCreateAgentManagerDraft,
    provisionAgentCompanyIdDraft,
    provisionAgentDepartmentIdDraft,
    provisionAgentGroupLabelDraft,
    provisionAgentGroupTypeDraft,
    provisionAgentModelDraft,
    provisionAgentNameDraft,
    provisionAgentRoleDraft,
    provisionAgentSlugDraft,
    provisionAgentTeamIdDraft,
    provisionConnectionIdDraft,
    provisionFileDrafts,
    queryClient,
    resetRuntimeAgentForm,
    runtimeAgentExternalIdDraft,
    runtimeAgentModelDraft,
    runtimeAgentNameDraft,
    runtimeAgentRepoKeyDraft,
    runtimeAgentRoleDraft,
    runtimeAgentTypeDraft,
    runtimeAgentWorkspaceRootDraft,
    selectedAgent,
    setActiveProvisionJobId,
    setAgentIsEditing,
    setCustomCreateAgentAvatarUrl,
    setIsProvisioningAgent,
    setPendingProvisionManagerAssignment,
    setSelectedAgentId,
  })

  const {
    taskCancelMutation,
    taskDispatchMutation,
    taskStatusMutation,
    taskUpdateMutation,
  } = useRelayTaskActions({
    effectiveWorkspaceId,
    queryClient,
    selectedTask,
    syncTaskPatchOverride,
  })

  const teamMemoryCreateMutation = useMutation({
    mutationFn: () =>
      sdk.teams.createMemory(selectedTeam!.id, {
        title: memoryTitleDraft.trim(),
        content: memoryContentDraft.trim(),
        type: memoryTypeDraft,
        tags: [],
      }),
    onSuccess: async () => {
      setMemoryTitleDraft("")
      setMemoryContentDraft("")
      await queryClient.invalidateQueries({
        queryKey: ["team-memory", selectedTeam?.id],
      })
      toast.success("Team memory item created")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  useEffect(() => {
    if (effectiveWorkspaceId && effectiveWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(effectiveWorkspaceId)
    }
  }, [effectiveWorkspaceId, selectedWorkspaceId, setSelectedWorkspaceId])
  return {
    ...input,
    agentAvatarMutation,
    agentClassificationMutation,
    agentDeleteMutation,
    agentToAgentChatMutation,
    approvalDecisionMutation,
    assignCreatedAgentAsDepartmentManager,
    bridgeConnectionCreateMutation,
    bridgeEnrollmentCreateMutation,
    bridgeSyncMutation,
    handleCancelRuntimeDispatch,
    handleCreateAgentAvatarUpload,
    handleRetryRuntimeDispatch,
    newChatCreateTeamMutation,
    paperclipConnectionCreateMutation,
    paperclipConnectionTestMutation,
    paperclipConnectionUpdateMutation,
    paperclipThreadLinkMutation,
    paperclipThreadUnlinkMutation,
    provisionAgentMutation,
    revokeBridgeDeviceMutation,
    runtimeAgentCreateMutation,
    sendMessageMutation,
    taskCancelMutation,
    taskCreateMutation,
    taskDispatchMutation,
    taskStatusMutation,
    taskUpdateMutation,
    teamDeleteMutation,
    teamMemberMutation,
    teamMemoryCreateMutation,
    threadUpdateMutation,
  }
}
