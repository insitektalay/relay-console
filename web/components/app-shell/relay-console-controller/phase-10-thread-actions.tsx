"use client"
/* eslint-disable react-hooks/exhaustive-deps -- Controller phases receive stable React setters and refs from prior hooks. */
import type { Message, Paginated, Thread } from "@clawchat/contracts"
import { useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { Bot, LayoutGrid, Network } from "lucide-react"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"
import {
  buildMessagesQueryKey,
  patchThreadForMessage,
  replaceOptimisticMessagePage,
} from "@/lib/message-cache"
import { captureProductEvent } from "@/lib/telemetry"
import {
  defaultRuntimeAgentModel,
  isAgentExecutionAvailable,
} from "@/components/app-shell/relay-controller-data"
import type { MarketplaceAgentRecoveryRequest } from "@/components/marketplace/marketplace-screen"
import { getRuntimeLabel } from "@/features/agents/agent-creation"
import {
  mapThreadPages,
  upsertThreadInPages,
  type ThreadPages,
} from "@/features/threads/thread-pages"
import { useRelayThreadWrapUpActions } from "@/features/threads/use-relay-thread-wrap-up-actions"
import { Button } from "@/components/ui/button"
import { useRelayConsoleDataActions } from "./phase-09-data-actions"
import { DEFAULT_OPENCLAW_AGENT_MODEL, slugifyOpenClawId } from "./shared"

export function useRelayConsoleThreadActions(
  input: ReturnType<typeof useRelayConsoleDataActions>
) {
  const {
    agents,
    agentsQuery,
    allManagerAgentIds,
    canAccessMarketplace,
    departmentChatAgentIdsByDepartmentId,
    departments,
    departmentsById,
    effectiveWorkspaceId,
    queryClient,
    resolveAgentDisplayName,
    resolveThreadTitle,
    runtimeAgentTypeDraft,
    selectedThreadId,
    setAgentIsEditing,
    setAgentsManagementTab,
    setAwaitingAgentReply,
    setCreateAgentAvatarUrl,
    setCreateAgentResponsePresentation,
    setCustomCreateAgentAvatarUrl,
    setIsCreateAgentManagerDraft,
    setIsLibraryManagerOpen,
    setIsProvisioningAgent,
    setIsStartingChat,
    setMarketplaceReturnAppSlug,
    setMessageDraft,
    setMissionControlView,
    setNewChatAgentOneId,
    setNewChatAgentTwoId,
    setNewChatMeetingAgentIds,
    setNewChatMode,
    setNewChatNewTeamName,
    setNewChatNewTeamSelectedAgentIds,
    setNewChatSearch,
    setNewChatShowNewTeamForm,
    setOpenedThreadOverride,
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
    setRuntimeAgentExternalIdDraft,
    setRuntimeAgentExternalIdTouched,
    setRuntimeAgentModelDraft,
    setRuntimeAgentNameDraft,
    setRuntimeAgentRepoKeyDraft,
    setRuntimeAgentRoleDraft,
    setRuntimeAgentTypeDraft,
    setRuntimeAgentWorkspaceRootDraft,
    setSection,
    setSelectedAgentId,
    setSelectedApprovalId,
    setSelectedReportId,
    setSelectedReportKind,
    setSelectedThreadId,
    setSelectedWrappedTranscript,
    setSettingsView,
    teams,
    threads,
  } = input

  const threadArchiveMutation = useMutation({
    mutationFn: async (threadId: string) => sdk.threads.archive(threadId),
    onSuccess: async (_thread, threadId) => {
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null)
      }
      await queryClient.invalidateQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      })
      toast.success("Thread archived")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const { threadWrapUpMutation, wrapUpReportRetryMutation } =
    useRelayThreadWrapUpActions({
      effectiveWorkspaceId,
      queryClient,
      setMessageDraft,
      setSection,
      setSelectedReportId,
      setSelectedReportKind,
      setSelectedThreadId,
      setSelectedWrappedTranscript,
      threads,
    })

  const directChatMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const agent = agents.find((entry) => entry.id === agentId)
      if (!agent || !effectiveWorkspaceId) {
        throw new Error("Agent or workspace unavailable")
      }
      if (!isAgentExecutionAvailable(agent)) {
        throw new Error(
          "This agent's runtime host is offline or has no execution owner."
        )
      }
      return sdk.threads.create(effectiveWorkspaceId, {
        title: agent.name,
        type: "direct",
        agentIds: [agent.id],
      })
    },
    onSuccess: async (thread) => {
      captureProductEvent("product_action", {
        action: "chat.open",
        outcome: "success",
        chat_type: "direct",
      })
      queryClient.setQueriesData<ThreadPages>(
        { queryKey: ["threads", effectiveWorkspaceId] },
        (current) => upsertThreadInPages(current, thread)
      )
      openThread(thread)
      toast.success(`Chat opened with ${resolveThreadTitle(thread)}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function addNewChatThread(thread: Thread) {
    queryClient.setQueriesData<ThreadPages>(
      { queryKey: ["threads", effectiveWorkspaceId] },
      (current) => upsertThreadInPages(current, thread)
    )
    openThread(thread)
  }

  async function openMarketplaceConnectedChat({
    operatorAgentId,
    message,
  }: {
    appName: string
    operatorAgentId: string
    message: string
  }) {
    if (!effectiveWorkspaceId) {
      throw new Error("Workspace unavailable")
    }
    const agent = agents.find((entry) => entry.id === operatorAgentId)
    if (!agent) {
      throw new Error("Operator agent unavailable")
    }
    const thread =
      threads.find(
        (entry) =>
          entry.type === "direct" &&
          entry.agentIds.length === 1 &&
          entry.agentIds[0] === operatorAgentId
      ) ??
      (await sdk.threads.create(effectiveWorkspaceId, {
        title: resolveAgentDisplayName(agent),
        type: "direct",
        agentIds: [operatorAgentId],
      }))

    addNewChatThread(thread)
    setSelectedAgentId(operatorAgentId)
    const savedMessage = await sdk.messages.create(thread.id, {
      content: message,
      attachments: [],
    })
    queryClient.setQueryData<Paginated<Message>>(
      buildMessagesQueryKey(thread.id),
      (current) => replaceOptimisticMessagePage(current, savedMessage)
    )
    queryClient.setQueriesData<ThreadPages>(
      { queryKey: ["threads", effectiveWorkspaceId] },
      (current) =>
        mapThreadPages(current, (entry) =>
          entry.id === thread.id
            ? patchThreadForMessage(entry, savedMessage)
            : entry
        )
    )
    setAwaitingAgentReply({
      threadId: thread.id,
      baselineMessageId: savedMessage.id,
    })
  }

  function openMarketplaceCompatibleAgent({
    runtimeType,
    appName,
    appSlug,
  }: MarketplaceAgentRecoveryRequest) {
    const runtimeName = getRuntimeLabel(runtimeType) ?? "Runtime"
    const agentName =
      runtimeType === "hermes"
        ? `${appName} Hermes Operator`
        : `${appName} Operator`
    const agentExternalId = slugifyOpenClawId(
      `${appSlug}_${runtimeType}_operator`
    )
    const agentRole = `${appName} marketplace operator`

    setMarketplaceReturnAppSlug(appSlug)
    setSection("agents")
    setAgentsManagementTab("instructions")
    setSelectedAgentId(null)
    setIsProvisioningAgent(true)
    setRuntimeAgentTypeDraft(runtimeType)

    if (runtimeType === "openclaw") {
      resetProvisioningForm()
      setRuntimeAgentTypeDraft("openclaw")
      setProvisionAgentNameDraft(agentName)
      setProvisionAgentSlugDraft(agentExternalId)
      setProvisionAgentSlugTouched(true)
      setProvisionAgentRoleDraft(agentRole)
      setProvisionAgentModelDraft(DEFAULT_OPENCLAW_AGENT_MODEL)
    } else {
      resetRuntimeAgentForm(runtimeType)
      setRuntimeAgentTypeDraft(runtimeType)
      setRuntimeAgentNameDraft(agentName)
      setRuntimeAgentExternalIdDraft(agentExternalId)
      setRuntimeAgentExternalIdTouched(true)
      setRuntimeAgentRoleDraft(agentRole)
      setRuntimeAgentModelDraft(defaultRuntimeAgentModel(runtimeType))
    }

    toast.message(
      `Create a ${runtimeName} agent, then return to Marketplace to connect ${appName}.`
    )
  }

  function openMarketplaceRuntimePairing({
    runtimeType,
    appName,
    appSlug,
  }: MarketplaceAgentRecoveryRequest) {
    const runtimeName = getRuntimeLabel(runtimeType) ?? "Runtime"
    setMarketplaceReturnAppSlug(appSlug)
    setSection("settings")
    setSettingsView("integrations")
    toast.message(
      `Pair or update a ${runtimeName} runtime bridge, then return to Marketplace to connect ${appName}.`
    )
  }

  const shouldShowEmptyProductRecoveryActions =
    Boolean(effectiveWorkspaceId) &&
    agentsQuery.isSuccess &&
    agents.length === 0

  function openFirstUseAgentCreation() {
    resetProvisioningForm()
    setSection("agents")
    setAgentsManagementTab("instructions")
    setSelectedAgentId(null)
    setAgentIsEditing(false)
    setIsLibraryManagerOpen(false)
    setRuntimeAgentTypeDraft("openclaw")
    setIsProvisioningAgent(true)
  }

  function openFirstUseRuntimePairing() {
    setSection("settings")
    setSettingsView("integrations")
  }

  function openFirstUseMarketplace() {
    setSection("missionControl")
    setMissionControlView("marketplace")
  }

  function renderEmptyProductRecoveryActions() {
    if (!shouldShowEmptyProductRecoveryActions) {
      return null
    }

    return (
      <>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={openFirstUseAgentCreation}
        >
          <Bot className="size-4" />
          Create agent
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openFirstUseRuntimePairing}
        >
          <Network className="size-4" />
          Connect runtime
        </Button>
        {canAccessMarketplace ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={openFirstUseMarketplace}
          >
            <LayoutGrid className="size-4" />
            Open Marketplace
          </Button>
        ) : null}
      </>
    )
  }

  const teamChatMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const team = teams.find((t) => t.id === teamId)
      if (!team || !effectiveWorkspaceId)
        throw new Error("Team or workspace unavailable")
      return sdk.threads.create(effectiveWorkspaceId, {
        title: team.name,
        type: "team",
        teamId: team.id,
        agentIds: agents
          .filter(
            (agent) =>
              agent.teamId === team.id &&
              agent.id !== team.leadAgentId &&
              agent.id !== departmentsById.get(team.departmentId)?.headAgentId
          )
          .map((agent) => agent.id),
        workspaceId: effectiveWorkspaceId,
      })
    },
    onSuccess: (thread) => {
      captureProductEvent("product_action", {
        action: "chat.open",
        outcome: "success",
        chat_type: "team",
      })
      addNewChatThread(thread)
      toast.success(`Team chat opened`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const departmentChatMutation = useMutation({
    mutationFn: async (departmentId: string) => {
      const dept = departments.find((d) => d.id === departmentId)
      if (!dept || !effectiveWorkspaceId)
        throw new Error("Department or workspace unavailable")
      const agentIds = departmentChatAgentIdsByDepartmentId.get(dept.id) ?? []
      if (!agentIds.length) {
        throw new Error(
          `Assign at least one agent to ${dept.name} before starting a department chat.`
        )
      }
      return sdk.threads.create(effectiveWorkspaceId, {
        title: dept.name,
        type: "department",
        departmentId: dept.id,
        agentIds,
        workspaceId: effectiveWorkspaceId,
      })
    },
    onSuccess: (thread) => {
      addNewChatThread(thread)
      toast.success(`Department chat opened`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const companyMeetingChatMutation = useMutation({
    mutationFn: async (agentIds: string[]) => {
      if (!effectiveWorkspaceId) throw new Error("Workspace unavailable")
      if (!agentIds.length) throw new Error("Select at least one agent")
      const managers = agentIds.filter((agentId) =>
        allManagerAgentIds.has(agentId)
      )
      if (!managers.length) {
        throw new Error("Select at least one manager for the meeting")
      }
      return sdk.threads.create(effectiveWorkspaceId, {
        title: "Company Meeting",
        type: "company_meeting",
        agentIds,
        workspaceId: effectiveWorkspaceId,
      })
    },
    onSuccess: (thread) => {
      addNewChatThread(thread)
      setNewChatMeetingAgentIds(new Set())
      toast.success("Meeting opened")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const resetRuntimeAgentForm = useCallback(
    (nextRuntimeType = runtimeAgentTypeDraft) => {
      setRuntimeAgentNameDraft("")
      setRuntimeAgentExternalIdDraft("")
      setRuntimeAgentExternalIdTouched(false)
      setRuntimeAgentRoleDraft("")
      setRuntimeAgentRepoKeyDraft("")
      setRuntimeAgentWorkspaceRootDraft("")
      setRuntimeAgentModelDraft(defaultRuntimeAgentModel(nextRuntimeType))
      setCreateAgentAvatarUrl(null)
      setCreateAgentResponsePresentation("standard")
      setCustomCreateAgentAvatarUrl(null)
      setIsCreateAgentManagerDraft(false)
    },
    [runtimeAgentTypeDraft]
  )

  function openThread(thread: Thread) {
    setOpenedThreadOverride(thread)
    setSelectedThreadId(thread.id)
    setSelectedApprovalId(null)
    setSection("threads")
    setIsStartingChat(false)
    setNewChatSearch("")
    setNewChatMode("direct")
    setNewChatAgentOneId(null)
    setNewChatAgentTwoId(null)
    setNewChatShowNewTeamForm(false)
    setNewChatNewTeamName("")
    setNewChatNewTeamSelectedAgentIds(new Set())
  }

  function resetProvisioningForm() {
    setProvisionAgentNameDraft("")
    setProvisionAgentSlugDraft("")
    setProvisionAgentSlugTouched(false)
    setProvisionAgentRoleDraft("")
    setProvisionAgentModelDraft(DEFAULT_OPENCLAW_AGENT_MODEL)
    setProvisionAgentGroupTypeDraft("personal")
    setProvisionAgentGroupLabelDraft("")
    setProvisionAgentCompanyIdDraft("")
    setProvisionAgentDepartmentIdDraft("")
    setProvisionAgentTeamIdDraft("")
    setProvisionConnectionIdDraft("")
    setProvisionFileDrafts([])
    setCreateAgentAvatarUrl(null)
    setCreateAgentResponsePresentation("standard")
    setCustomCreateAgentAvatarUrl(null)
    setIsCreateAgentManagerDraft(false)
    setPendingProvisionManagerAssignment(null)
  }
  return {
    ...input,
    addNewChatThread,
    companyMeetingChatMutation,
    departmentChatMutation,
    directChatMutation,
    openFirstUseAgentCreation,
    openFirstUseMarketplace,
    openFirstUseRuntimePairing,
    openMarketplaceCompatibleAgent,
    openMarketplaceConnectedChat,
    openMarketplaceRuntimePairing,
    openThread,
    renderEmptyProductRecoveryActions,
    resetProvisioningForm,
    resetRuntimeAgentForm,
    shouldShowEmptyProductRecoveryActions,
    teamChatMutation,
    threadArchiveMutation,
    threadWrapUpMutation,
    wrapUpReportRetryMutation,
  }
}
