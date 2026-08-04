"use client"
import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  Agent,
  Paginated,
  TaskRecurrenceRule,
  ThreadWrapUpReport,
} from "@clawchat/contracts"
import { Archive, Pause, Play, RefreshCcw, Trash2, Wrench } from "lucide-react"
import { toast } from "sonner"
import { appConfig } from "@/lib/config"
import { sdk } from "@/lib/sdk"
import { OpenClawLibraryCard } from "@/components/agents/openclaw-library-card"
import {
  CompactNotice,
  LabeledField,
} from "@/components/shared/relay-compact-fields"
import { MarkdownBlock } from "@/components/shared/relay-markdown-content"
import {
  downloadTextFile,
  initials,
  relativeTime,
  selectClassName,
} from "@/lib/relay-presentation-utils"
import { AgentAvatarPicker } from "@/components/agent-avatar-picker"
import { HermesCronJobsPanel } from "@/components/agents/hermes-cron-jobs-panel"
import { ArtifactsScreen } from "@/components/artifacts/artifacts-screen"
import { ThreadAnalyticsPane } from "@/components/threads/thread-analytics-pane"
import { ThreadDetailPane } from "@/components/threads/thread-detail-pane"
import { ApprovalDetailPane } from "@/components/approvals/approval-detail-pane"
import { EmptyPanel } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import type { RelayConsoleController } from "@/components/clawchat-web-app"
import {
  AgentOpsHqScreen,
  MissionControlSection,
} from "@/components/app-shell/lazy-feature-screens"
import { RelayConsoleInsightsTabs } from "@/components/app-shell/views/insights-tabs"
import { RelayConsoleAgentTasksDetail } from "@/components/app-shell/views/agent-tasks-detail"
import { RelayConsoleSettingsDetailPane } from "@/components/app-shell/views/settings-detail-pane"
import { RelayConsoleOperationsDetailPane } from "@/components/app-shell/views/operations-detail-pane"
import { RelayConsoleGroupsDetail } from "@/components/app-shell/views/groups-detail"

function AgentRoleEditor({ agent }: { agent: Agent }) {
  const queryClient = useQueryClient()
  const resolvedRole = agent.role?.trim() || agent.description?.trim() || ""
  const [role, setRole] = useState(resolvedRole)

  useEffect(() => {
    setRole(resolvedRole)
  }, [agent.id, resolvedRole])

  const mutation = useMutation({
    mutationFn: () => sdk.agents.update(agent.id, { role: role.trim() }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agents"] }),
        queryClient.invalidateQueries({ queryKey: ["agent", agent.id] }),
      ])
      toast.success("Agent role saved")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <div
      aria-label="Agent role editor"
      className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_34%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-page))] p-3.5"
    >
      <label
        className="w-28 shrink-0 text-sm font-semibold text-[var(--claw-text-primary)]"
        htmlFor="agent-role"
      >
        Role
      </label>
      <Input
        id="agent-role"
        className="h-[38px] max-w-[360px] min-w-[220px] flex-1 bg-[var(--claw-bg-inset)] px-3"
        placeholder="What does this agent do?"
        value={role}
        onChange={(event) => setRole(event.target.value)}
      />
      <Button
        className="h-9 px-4"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        type="button"
      >
        {mutation.isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  )
}

function DetailThreadsSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const selectedThread = controller.selectedThread
  if (controller.isStartingChat) {
    const needsAgent = controller.agents.length === 0
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center bg-[var(--claw-bg-page)] px-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-[10px] bg-gradient-to-br from-[var(--claw-accent-blue)] to-[var(--claw-accent-green)] text-white">
          <Wrench className="size-5" />
        </div>
        <div className="mt-6 text-lg font-semibold text-[var(--claw-text-primary)]">
          {needsAgent ? "Create an agent to start" : "Choose an agent to start"}
        </div>
        <p className="mt-3 max-w-xl text-sm leading-5 text-[var(--claw-text-muted)]">
          {needsAgent
            ? "Your runtime can be connected without having an agent ready for chat. Create an agent, then return here to start a conversation."
            : "Select an available agent in the new chat panel to begin a conversation."}
        </p>
        {needsAgent ? (
          <Button
            className="mt-5 rounded-[4px]"
            onClick={() => controller.setSection("agents")}
          >
            Open Agents
          </Button>
        ) : null}
      </div>
    )
  }
  return (
    <ThreadDetailPane
      selectedThread={selectedThread}
      activeThreadSessionId={selectedThread?.activeSessionId ?? null}
      viewedWrapUpTranscript={controller.viewedWrappedTranscript}
      isLoading={controller.messagesQuery.isLoading}
      loadError={
        controller.shouldBlockMessageHistory
          ? controller.messageLoadError
          : null
      }
      syncError={
        !controller.shouldBlockMessageHistory
          ? controller.messageLoadError
          : null
      }
      isSyncing={
        controller.messagesQuery.isFetching &&
        !controller.messagesQuery.isLoading
      }
      messages={controller.messages}
      hasOlderMessages={controller.hasOlderMessages}
      isLoadingOlderMessages={controller.loadOlderMessagesMutation.isPending}
      onLoadOlderMessages={() => controller.loadOlderMessagesMutation.mutate()}
      agents={controller.agents}
      departments={controller.departments}
      modelOptionsByRuntime={controller.agentModelOptionsQuery.data?.harnesses}
      onUpdateAgentModel={async (agentId, modelPrimary) => {
        const updated = await sdk.agents.update(agentId, { modelPrimary })
        controller.queryClient.setQueryData(
          ["agents", controller.effectiveWorkspaceId],
          (old: Paginated<Agent> | undefined) => {
            if (!old?.data) return old
            return {
              ...old,
              data: old.data.map((agent) =>
                agent.id === agentId ? updated : agent
              ),
            }
          }
        )
        await controller.queryClient.invalidateQueries({
          queryKey: ["agent", agentId],
        })
        toast.success(
          `Model changed to ${updated.modelPrimary ?? modelPrimary}`
        )
      }}
      wrapUpReports={
        controller.selectedThreadWrapUpReportsQuery.data?.data ?? []
      }
      runtimeDispatches={
        selectedThread && !controller.viewedWrappedTranscript
          ? (controller.realtime.runtimeDispatches[selectedThread.id] ?? [])
          : []
      }
      runtimeParticipantHealth={
        selectedThread && !controller.viewedWrappedTranscript
          ? [
              ...(controller.realtime.runtimeParticipantHealth[
                selectedThread.id
              ] ?? []),
              ...(controller.effectiveWorkspaceId
                ? (controller.realtime.runtimeParticipantHealth[
                    controller.effectiveWorkspaceId
                  ] ?? [])
                : []),
            ]
          : []
      }
      runtimeContextUsage={
        selectedThread
          ? (controller.realtime.runtimeContextUsage[selectedThread.id] ?? [])
          : []
      }
      displayNamesByAgentId={controller.displayNameByAgentId}
      managerAgentId={
        controller.resolveThreadManagerAgentIds(selectedThread)[0] ?? null
      }
      managerAgentIds={controller.resolveThreadManagerAgentIds(selectedThread)}
      currentUserAvatarUrl={controller.authenticatedUserAvatarUrl}
      messageDraft={controller.messageDraft}
      onMessageDraftChange={controller.setMessageDraft}
      onViewLiveChat={() => controller.setSelectedWrappedTranscript(null)}
      onViewWrapUpTranscript={(report) =>
        controller.setSelectedWrappedTranscript(report)
      }
      threadViewMode={controller.selectedThreadViewMode}
      onThreadViewModeChange={(mode) => {
        if (!selectedThread?.id) {
          return
        }

        controller.setThreadViewModes((current) => ({
          ...current,
          [selectedThread.id]: mode,
        }))
      }}
      isCondensedViewEnabled={appConfig.enableCondensedTeamChat}
      showDetailedRuntimeActivity={
        controller.runtimeExperience.detailedActivity
      }
      runtimeApprovalMode={controller.runtimeExperience.approvalMode}
      onRuntimeApprovalModeChange={(approvalMode) =>
        controller.updateRuntimeExperience({
          approvalMode,
        })
      }
      onCancelRuntimeDispatch={controller.handleCancelRuntimeDispatch}
      onRetryRuntimeDispatch={controller.handleRetryRuntimeDispatch}
      onSendMessage={(attachments = [], authority) => {
        if (!selectedThread) {
          return
        }

        if (controller.viewedWrappedTranscript) {
          controller.setSelectedWrappedTranscript(null)
        }

        controller.sendMessageMutation.mutate({
          threadId: selectedThread.id,
          content: controller.messageDraft.trim(),
          attachments,
          runtimeApprovalMode:
            authority?.runtimeApprovalMode ??
            controller.runtimeExperience.approvalMode,
          runtimeDispatchConfirmed: authority?.runtimeDispatchConfirmed ?? true,
        })
      }}
      isSending={controller.sendMessageMutation.isPending}
      emptyTitle={
        controller.shouldShowEmptyProductRecoveryActions
          ? "Create the first agent"
          : undefined
      }
      emptyDescription={
        controller.shouldShowEmptyProductRecoveryActions
          ? "This workspace is ready for agents, runtime connections, and Marketplace apps."
          : undefined
      }
      emptyActions={controller.renderEmptyProductRecoveryActions()}
      emptyMessageActions={controller.renderEmptyProductRecoveryActions()}
      typingUsers={
        selectedThread && !controller.viewedWrappedTranscript
          ? (controller.realtime.typingUsers[selectedThread.id] ?? [])
          : []
      }
      isAwaitingAgentReply={
        !controller.viewedWrappedTranscript &&
        controller.awaitingAgentReply?.threadId === selectedThread?.id
      }
      relativeTime={relativeTime}
      initials={initials}
      onAddAgentToTeam={
        selectedThread?.type === "team"
          ? (agentId) =>
              controller.teamMemberMutation.mutate({
                threadId: selectedThread.id,
                newAgentIds: [...(selectedThread.agentIds ?? []), agentId],
              })
          : undefined
      }
      onRemoveAgentFromTeam={
        selectedThread?.type === "team"
          ? (agentId) =>
              controller.teamMemberMutation.mutate({
                threadId: selectedThread.id,
                newAgentIds: (selectedThread.agentIds ?? []).filter(
                  (id) => id !== agentId
                ),
              })
          : undefined
      }
      isUpdatingTeamMembers={controller.teamMemberMutation.isPending}
      onUpdateAvatarUrl={
        selectedThread
          ? (url) =>
              controller.threadUpdateMutation.mutate({
                threadId: selectedThread.id,
                patch: { avatarUrl: url || undefined },
              })
          : undefined
      }
      onWrapUpThread={
        (selectedThread?.type === "team" ||
          selectedThread?.type === "direct") &&
        !controller.viewedWrappedTranscript
          ? () => controller.threadWrapUpMutation.mutate(selectedThread)
          : undefined
      }
      onOpenWrapUpReport={(report) => {
        controller.setSelectedReportId(`wrap_up:${report.id}`)
        controller.setSelectedReportKind("wrap_up")
        controller.setSelectedThreadId(report.threadId)
        controller.setInsightsTab("report")
        controller.setSection("reports")
      }}
      paperclipLinkView={controller.selectedThreadPaperclipLink}
      isPaperclipAdmin={controller.isWorkspaceAdmin}
      paperclipConnections={controller.paperclipConnections}
      isPaperclipLinkLoading={
        controller.selectedThreadPaperclipLinkQuery.isLoading
      }
      isPaperclipLinkMutating={
        controller.paperclipThreadLinkMutation.isPending ||
        controller.paperclipThreadUnlinkMutation.isPending
      }
      onPaperclipLink={
        selectedThread
          ? (input) =>
              controller.paperclipThreadLinkMutation.mutateAsync({
                threadId: selectedThread.id,
                input,
              })
          : undefined
      }
      onPaperclipUnlink={
        selectedThread
          ? () =>
              controller.paperclipThreadUnlinkMutation.mutateAsync(
                selectedThread.id
              )
          : undefined
      }
      onPaperclipRefresh={() =>
        controller.selectedThreadPaperclipLinkQuery.refetch()
      }
      onOpenPaperclipSettings={() => {
        controller.setSection("settings")
        controller.setSettingsView("integrations")
      }}
      isWrappingUpThread={controller.threadWrapUpMutation.isPending}
    />
  )
}

function DetailAgentsSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  if (controller.isProvisioningAgent) {
    return (
      <div className="h-full min-h-0 w-full min-w-0 bg-[var(--claw-bg-page)]">
        <ScrollArea className="mission-scrollbar h-full min-w-0">
          <div className="w-full min-w-0 px-7 py-9">
            <controller.CreateAgentCard
              isOpen
              modelOptionsByRuntime={
                controller.agentModelOptionsQuery.data?.harnesses
              }
              agentType={controller.runtimeAgentTypeDraft}
              onAgentTypeChange={(value) => {
                controller.setRuntimeAgentTypeDraft(value)
                controller.setRuntimeAgentModelDraft(
                  controller.defaultRuntimeAgentModel(value)
                )
              }}
              runtimeIsSubmitting={
                controller.runtimeAgentCreateMutation.isPending
              }
              provisionIsSubmitting={
                controller.provisionAgentMutation.isPending
              }
              canSubmitRuntime={
                Boolean(
                  controller.effectiveWorkspaceId &&
                  controller.runtimeAgentNameDraft.trim() &&
                  controller.runtimeAgentExternalIdDraft.trim() &&
                  (controller.runtimeAgentTypeDraft === "hermes" ||
                    controller.runtimeAgentRepoKeyDraft.trim())
                ) && !controller.runtimeAgentCreateMutation.isPending
              }
              canSubmitOpenClaw={
                Boolean(
                  controller.effectiveWorkspaceId &&
                  controller.provisionAgentNameDraft.trim() &&
                  controller.provisionAgentSlugDraft.trim()
                ) && !controller.provisionAgentMutation.isPending
              }
              runtimeAgentName={controller.runtimeAgentNameDraft}
              runtimeExternalId={controller.runtimeAgentExternalIdDraft}
              runtimeRole={controller.runtimeAgentRoleDraft}
              runtimeRepoKey={controller.runtimeAgentRepoKeyDraft}
              runtimeWorkspaceRoot={controller.runtimeAgentWorkspaceRootDraft}
              runtimeModel={controller.runtimeAgentModelDraft}
              onRuntimeNameChange={controller.setRuntimeAgentNameDraft}
              onRuntimeExternalIdChange={(value) => {
                controller.setRuntimeAgentExternalIdTouched(true)
                controller.setRuntimeAgentExternalIdDraft(
                  controller.slugifyOpenClawId(value)
                )
              }}
              onRuntimeRoleChange={controller.setRuntimeAgentRoleDraft}
              onRuntimeRepoKeyChange={controller.setRuntimeAgentRepoKeyDraft}
              onRuntimeWorkspaceRootChange={
                controller.setRuntimeAgentWorkspaceRootDraft
              }
              onRuntimeModelChange={controller.setRuntimeAgentModelDraft}
              onResetRuntime={() => controller.resetRuntimeAgentForm()}
              onSubmitRuntime={() =>
                controller.runtimeAgentCreateMutation.mutate()
              }
              bridgeConnections={controller.bridgeConnections}
              companies={controller.companies}
              departments={controller.provisionFilteredDepartments}
              teams={controller.provisionFilteredTeams}
              groupType={controller.provisionAgentGroupTypeDraft}
              groupLabel={controller.provisionAgentGroupLabelDraft}
              companyId={controller.provisionAgentCompanyIdDraft}
              departmentId={controller.provisionAgentDepartmentIdDraft}
              teamId={controller.provisionAgentTeamIdDraft}
              avatarUrl={controller.createAgentAvatarUrl}
              customAvatarUrl={controller.customCreateAgentAvatarUrl}
              onAvatarChange={controller.setCreateAgentAvatarUrl}
              onAvatarUpload={controller.handleCreateAgentAvatarUpload}
              responsePresentation={controller.createAgentResponsePresentation}
              onResponsePresentationChange={
                controller.setCreateAgentResponsePresentation
              }
              isManagerDraft={controller.isCreateAgentManagerDraft}
              onManagerDraftChange={controller.setIsCreateAgentManagerDraft}
              managerDisabledReason={controller.createAgentManagerToggleReason}
              existingManagerName={controller.createAgentExistingManagerName}
              connectionId={controller.provisionConnectionIdDraft}
              openClawAgentName={controller.provisionAgentNameDraft}
              openClawAgentSlug={controller.provisionAgentSlugDraft}
              openClawAgentRole={controller.provisionAgentRoleDraft}
              openClawAgentModel={controller.provisionAgentModelDraft}
              files={controller.provisionFileDrafts}
              job={controller.activeProvisionJobQuery.data ?? null}
              onOpenClawNameChange={controller.setProvisionAgentNameDraft}
              onOpenClawSlugChange={(value) => {
                controller.setProvisionAgentSlugTouched(true)
                controller.setProvisionAgentSlugDraft(
                  controller.slugifyOpenClawId(value)
                )
              }}
              onOpenClawRoleChange={controller.setProvisionAgentRoleDraft}
              onOpenClawModelChange={controller.setProvisionAgentModelDraft}
              onGroupTypeChange={controller.setProvisionAgentGroupTypeDraft}
              onGroupLabelChange={controller.setProvisionAgentGroupLabelDraft}
              onCompanyChange={(value) => {
                controller.setProvisionAgentCompanyIdDraft(value)
                controller.setProvisionAgentDepartmentIdDraft("")
                controller.setProvisionAgentTeamIdDraft("")
              }}
              onDepartmentChange={(value) => {
                controller.setProvisionAgentDepartmentIdDraft(value)
                controller.setProvisionAgentTeamIdDraft("")
              }}
              onTeamChange={controller.setProvisionAgentTeamIdDraft}
              onConnectionChange={controller.setProvisionConnectionIdDraft}
              onBulkImport={controller.handleProvisionBulkUpload}
              onRemoveFile={controller.removeProvisionFileDraft}
              onResetOpenClaw={controller.resetProvisioningForm}
              onSubmitOpenClaw={() =>
                controller.provisionAgentMutation.mutate()
              }
            />
          </div>
        </ScrollArea>
      </div>
    )
  }

  if (controller.agentsManagementTab === "tasks") {
    return <RelayConsoleAgentTasksDetail controller={controller} />
  }

  if (controller.agentsManagementTab === "cron") {
    return (
      <controller.DetailCard
        title="Cron Jobs"
        subtitle="Native OpenClaw and Hermes schedules"
      >
        {controller.selectedAgent ? (
          <HermesCronJobsPanel
            workspaceId={controller.effectiveWorkspaceId}
            agentId={controller.selectedAgentWorkspaceExternalId}
            controlAgentId={
              controller.selectedAgentRecord?.id ?? controller.selectedAgent.id
            }
            agentLabel={
              controller.selectedAgentDisplayName ??
              controller.selectedAgent.name ??
              "Agent"
            }
            runtimeType={controller.getAgentRuntimeType(
              controller.selectedAgent
            )}
            canManage={Boolean(controller.isWorkspaceAdmin)}
            onOpenArtifacts={() => controller.setSection("artifacts")}
          />
        ) : (
          <EmptyPanel
            title="Select an agent"
            description="Choose an OpenClaw or Hermes agent to inspect its scheduled work."
          />
        )}
      </controller.DetailCard>
    )
  }

  if (controller.agentsManagementTab === "library") {
    return controller.selectedAgent ? (
      <OpenClawLibraryCard
        key={`${controller.selectedAgentWorkspaceExternalId ?? controller.selectedAgent.id}:library`}
        isOpen={true}
        workspaceId={controller.effectiveWorkspaceId}
        agentId={controller.selectedAgentWorkspaceExternalId}
        runtimeType={controller.getAgentRuntimeType(controller.selectedAgent)}
        agentLabel={
          controller.selectedAgentDisplayName ??
          controller.selectedAgent.name ??
          "Agent"
        }
        agentAvatarUrl={controller.selectedAgentRecord?.avatarUrl ?? null}
        agentGroupLabel={
          controller.selectedAgentRecord?.groupLabel?.trim() || "Unassigned"
        }
        knowledgeSection="library"
        libraryOnly
        onOpenChat={() => {
          const directThread = controller.threads.find(
            (thread) =>
              thread.type === "direct" &&
              thread.agentIds.includes(controller.selectedAgent.id)
          )
          if (!directThread) return
          controller.setSelectedThreadId(directThread.id)
          controller.setSection("threads")
        }}
      />
    ) : (
      <EmptyPanel
        title="Select an agent"
        description="Choose an agent to open the shared agent library."
      />
    )
  }

  const agentKnowledgeTab =
    controller.agentsManagementTab === "detail"
      ? "instructions"
      : controller.agentsManagementTab

  if (
    agentKnowledgeTab === "instructions" ||
    agentKnowledgeTab === "memory" ||
    agentKnowledgeTab === "skills"
  ) {
    const documentSurface = {
      instructions: {
        title: "Agent Instructions",
        subtitle: "Operating guidance and runtime instruction files",
        emptyCopy:
          "Add instructions that define how this agent should work and respond.",
      },
      memory: {
        title: "Agent Memory",
        subtitle: "Persistent context available to this agent",
        emptyCopy:
          "Add memory files to give this agent durable project context.",
      },
      skills: {
        title: "Agent Skills",
        subtitle: "Installed capabilities and supporting skill files",
        emptyCopy:
          "Add or inspect skill files available to this agent runtime.",
      },
    }[agentKnowledgeTab]

    return controller.selectedAgent ? (
      <OpenClawLibraryCard
        key={`${controller.selectedAgentWorkspaceExternalId ?? controller.selectedAgent.id}:${agentKnowledgeTab}`}
        isOpen={true}
        workspaceId={controller.effectiveWorkspaceId}
        agentId={controller.selectedAgentWorkspaceExternalId}
        runtimeType={controller.getAgentRuntimeType(controller.selectedAgent)}
        agentLabel={
          controller.selectedAgentDisplayName ??
          controller.selectedAgent.name ??
          "Agent"
        }
        agentAvatarUrl={controller.selectedAgentRecord?.avatarUrl ?? null}
        agentGroupLabel={
          controller.selectedAgentRecord?.groupLabel?.trim() || "Unassigned"
        }
        knowledgeSection={agentKnowledgeTab}
        onOpenChat={() => {
          const directThread = controller.threads.find(
            (thread) =>
              thread.type === "direct" &&
              thread.agentIds.includes(controller.selectedAgent.id)
          )
          if (!directThread) return
          controller.setSelectedThreadId(directThread.id)
          controller.setSection("threads")
        }}
      />
    ) : (
      <EmptyPanel
        title="Select an agent"
        description={`Choose an agent to open ${documentSurface.title.toLowerCase()}.`}
      />
    )
  }

  if (
    controller.agentsManagementTab !== "detail" &&
    controller.agentsManagementTab !== "edit"
  ) {
    return <RelayConsoleGroupsDetail controller={controller} />
  }

  return (
    <controller.DetailCard
      title={
        controller.agentIsEditing || controller.agentsManagementTab === "edit"
          ? "Edit Agent"
          : "Agent Detail"
      }
      subtitle={
        controller.agentIsEditing || controller.agentsManagementTab === "edit"
          ? "Display name, role, and avatar"
          : "Library, profile, and runtime workspace"
      }
      hideHeader={
        controller.agentIsEditing || controller.agentsManagementTab === "edit"
      }
      frameless={
        controller.agentIsEditing || controller.agentsManagementTab === "edit"
      }
    >
      <div className="space-y-6">
        {controller.selectedAgent ? (
          controller.agentIsEditing ||
          controller.agentsManagementTab === "edit" ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  aria-label={
                    controller.agentDeleteMutation.isPending
                      ? "Deleting agent"
                      : "Delete agent"
                  }
                  title={
                    controller.agentDeleteMutation.isPending
                      ? "Deleting agent"
                      : "Delete agent"
                  }
                  className="text-[var(--claw-text-muted)] hover:border-red-400/35 hover:bg-red-500/[0.08] hover:text-red-200"
                  disabled={controller.agentDeleteMutation.isPending}
                  size="icon"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!controller.selectedAgentRecord?.id) return
                    if (
                      !window.confirm(
                        `Delete ${controller.selectedAgentDisplayName ?? controller.selectedAgentRecord.name}? This permanently purges its Railway records and any configured physical paired workspace.`
                      )
                    ) {
                      return
                    }
                    controller.agentDeleteMutation.mutate(
                      controller.selectedAgentRecord.id
                    )
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <AgentAvatarPicker
                value={controller.selectedAgentRecord?.avatarUrl ?? null}
                customValue={
                  controller.selectedAgentRecord?.avatarUrl?.startsWith("data:")
                    ? controller.selectedAgentRecord.avatarUrl
                    : null
                }
                onChange={(avatarUrl) =>
                  controller.agentAvatarMutation.mutate(avatarUrl ?? undefined)
                }
                onUpload={controller.handleExistingAgentAvatarUpload}
                disabled={controller.agentAvatarMutation.isPending}
              />
              <div
                aria-label="Display name editor"
                className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_34%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-page))] p-3.5"
              >
                <label
                  className="w-28 shrink-0 text-sm font-semibold text-[var(--claw-text-primary)]"
                  htmlFor="agent-display-name"
                >
                  Display name
                </label>
                <Input
                  id="agent-display-name"
                  className="h-[38px] max-w-[360px] min-w-[220px] flex-1 bg-[var(--claw-bg-inset)] px-3"
                  value={controller.agentDisplayNameDraft}
                  onChange={(event) =>
                    controller.setAgentDisplayNameDraft(event.target.value)
                  }
                />
                <Button
                  className="h-9 px-4"
                  disabled={!controller.selectedAgentGroup}
                  onClick={() => {
                    if (!controller.selectedAgentGroup) {
                      return
                    }

                    const trimmed = controller.agentDisplayNameDraft.trim()
                    controller.setAgentDisplayNames((current) => {
                      const next = { ...current }
                      const shouldClear =
                        !trimmed ||
                        trimmed === controller.selectedAgentGroup.primary.name

                      controller.selectedAgentGroup.allAgentIds.forEach(
                        (agentId) => {
                          if (shouldClear) {
                            delete next[agentId]
                            return
                          }

                          next[agentId] = trimmed
                        }
                      )

                      return next
                    })
                    toast.success(
                      trimmed &&
                        trimmed !== controller.selectedAgentGroup.primary.name
                        ? "Display name saved"
                        : "Display name reset"
                    )
                  }}
                  type="button"
                >
                  Save
                </Button>
              </div>
              <AgentRoleEditor
                agent={
                  controller.selectedAgentRecord ?? controller.selectedAgent
                }
              />
            </div>
          ) : (
            <>
              <OpenClawLibraryCard
                isOpen={true}
                workspaceId={controller.effectiveWorkspaceId}
                agentId={controller.selectedAgentWorkspaceExternalId}
                runtimeType={controller.getAgentRuntimeType(
                  controller.selectedAgent
                )}
                agentLabel={
                  controller.selectedAgentDisplayName ??
                  controller.selectedAgent?.name ??
                  "Agent"
                }
              />
            </>
          )
        ) : (
          <EmptyPanel
            title="Select an agent"
            description="Choose an agent from the left to inspect schedule, work logs, reviews, and runs."
          />
        )}
      </div>
    </controller.DetailCard>
  )
}

function DetailTasksSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  return controller.taskPanelMode === "approvals" ? (
    <div className="h-full min-h-0 bg-[var(--claw-bg-page)] pt-4 pr-6 pb-6 pl-4">
      <Card className="h-full w-full min-w-0 border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] shadow-none">
        <CardContent className="flex h-full min-w-0 flex-col p-0">
          <ApprovalDetailPane
            approval={controller.selectedApprovalQuery.data ?? null}
            approvals={controller.approvals}
            isLoading={controller.selectedApprovalQuery.isLoading}
            approvalNote={controller.approvalNote}
            onApprovalNoteChange={controller.setApprovalNote}
            onApprove={() =>
              controller.approvalDecisionMutation.mutate("approve")
            }
            onReject={() =>
              controller.approvalDecisionMutation.mutate("reject")
            }
            isSubmitting={controller.approvalDecisionMutation.isPending}
            relativeTime={relativeTime}
          />
        </CardContent>
      </Card>
    </div>
  ) : (
    <controller.DetailCard
      title={
        controller.selectedTaskDetail?.title ??
        controller.selectedTask?.title ??
        "Task detail"
      }
      subtitle={
        controller.formatTaskStatusLabel(
          controller.selectedTaskDetail?.status ??
            controller.selectedTask?.status
        ) ?? "Select a task"
      }
    >
      {controller.selectedTask ? (
        (() => {
          const task = controller.selectedTaskDetail ?? controller.selectedTask
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  disabled={
                    controller.taskDispatchMutation.isPending ||
                    task.status === "cancelled"
                  }
                  onClick={() => controller.taskDispatchMutation.mutate()}
                >
                  {controller.taskDispatchMutation.isPending
                    ? "Sending..."
                    : "Send now"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!task.threadId}
                  onClick={() => {
                    if (!task.threadId) return
                    controller.setOpenedThreadOverride(null)
                    controller.setSelectedThreadId(task.threadId)
                    controller.setSection("threads")
                  }}
                >
                  Open chat
                </Button>
                {controller.canResumeTaskSchedule(task) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={controller.taskStatusMutation.isPending}
                    onClick={() =>
                      controller.taskStatusMutation.mutate("queued")
                    }
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Resume schedule
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={
                      controller.taskStatusMutation.isPending ||
                      !controller.canPauseTaskSchedule(task)
                    }
                    onClick={() =>
                      controller.taskStatusMutation.mutate("blocked")
                    }
                  >
                    <Pause className="mr-1.5 h-3.5 w-3.5" />
                    Pause schedule
                  </Button>
                )}
                {task.approvalId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      controller.setSelectedApprovalId(task.approvalId ?? null)
                      controller.setTaskPanelMode("approvals")
                      controller.setSection("agents")
                      controller.setAgentsManagementTab("tasks")
                    }}
                  >
                    Open approval
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={controller.taskCancelMutation.isPending}
                  onClick={() => controller.taskCancelMutation.mutate()}
                >
                  {controller.taskCancelMutation.isPending
                    ? "Cancelling..."
                    : "Cancel schedule"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => controller.archiveTaskFromList(task.id)}
                >
                  <Archive className="mr-1.5 h-3.5 w-3.5" />
                  Archive
                </Button>
              </div>

              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
                <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                  {[
                    ["Priority", task.priority],
                    ["Target", controller.formatTaskTarget(task)],
                    [
                      "Assigned agent",
                      controller.agentName(task.assignedAgentId),
                    ],
                    ["Runs", String(task.runCount)],
                    [
                      "Next send",
                      task.nextRunAt
                        ? controller.formatTaskDateTime(
                            task.nextRunAt,
                            task.timezone
                          )
                        : task.scheduledFor
                          ? controller.formatTaskDateTime(
                              task.scheduledFor,
                              task.timezone
                            )
                          : "n/a",
                    ],
                    [
                      "Repeats",
                      task.recurrenceRule
                        ? controller.formatTaskRecurrence(task.recurrenceRule)
                        : "One-off",
                    ],
                    [
                      "Time zone",
                      task.timezone || controller.defaultTaskTimezone(),
                    ],
                    [
                      "Last sent",
                      task.lastDispatchedAt
                        ? controller.formatTaskDateTime(
                            task.lastDispatchedAt,
                            task.timezone
                          )
                        : "Not yet",
                    ],
                    [
                      "Approval gate",
                      task.requiresApproval ? "Required" : "Not required",
                    ],
                    ["Approval", task.approvalId ?? "n/a"],
                    ["Chat", task.threadId ?? "n/a"],
                    [
                      "Created",
                      task.createdAt ? relativeTime(task.createdAt) : "n/a",
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="text-sm leading-6">
                      <span className="text-zinc-400">{label}:</span>{" "}
                      <span className="text-zinc-100">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {task.lastError ? (
                <CompactNotice>Last error: {task.lastError}</CompactNotice>
              ) : null}

              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-100">
                    Message schedule
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {controller.TASK_MANUAL_STATUS_ACTIONS.map((action) => (
                      <Button
                        key={action.status}
                        size="sm"
                        variant={
                          task.status === action.status
                            ? "default"
                            : "secondary"
                        }
                        disabled={controller.taskStatusMutation.isPending}
                        onClick={() =>
                          controller.taskStatusMutation.mutate(action.status)
                        }
                      >
                        {controller.getTaskManualStatusActionLabel(
                          action,
                          task
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <CompactNotice>
                    {controller.describeTaskSchedule({
                      scheduledFor: controller.taskEditScheduleDraft
                        ? controller.toIsoFromDatetimeLocal(
                            controller.taskEditScheduleDraft,
                            controller.taskEditTimezoneDraft.trim() ||
                              task.timezone ||
                              controller.defaultTaskTimezone()
                          )
                        : (task.nextRunAt ?? task.scheduledFor ?? null),
                      timezone:
                        controller.taskEditTimezoneDraft.trim() ||
                        task.timezone ||
                        controller.defaultTaskTimezone(),
                      recurrenceRule: controller.taskEditRecurrenceDraft,
                      status: task.status,
                      requiresApproval: task.requiresApproval,
                    })}
                  </CompactNotice>
                  <LabeledField label="Title">
                    <Input
                      value={controller.taskEditTitleDraft}
                      onChange={(event) =>
                        controller.setTaskEditTitleDraft(event.target.value)
                      }
                    />
                  </LabeledField>
                  <LabeledField label="Message">
                    <Textarea
                      rows={5}
                      value={controller.taskEditMessageDraft}
                      onChange={(event) =>
                        controller.setTaskEditMessageDraft(event.target.value)
                      }
                    />
                  </LabeledField>
                  <div className="grid gap-4 md:grid-cols-3">
                    <LabeledField label="Send at">
                      <Input
                        type="datetime-local"
                        value={controller.taskEditScheduleDraft}
                        onChange={(event) =>
                          controller.setTaskEditScheduleDraft(
                            event.target.value
                          )
                        }
                      />
                    </LabeledField>
                    <LabeledField label="Time zone">
                      <Input
                        value={controller.taskEditTimezoneDraft}
                        onChange={(event) =>
                          controller.setTaskEditTimezoneDraft(
                            event.target.value
                          )
                        }
                        placeholder={controller.defaultTaskTimezone()}
                      />
                    </LabeledField>
                    <LabeledField label="Repeats">
                      <select
                        className={selectClassName}
                        value={controller.taskEditRecurrenceDraft}
                        onChange={(event) =>
                          controller.setTaskEditRecurrenceDraft(
                            event.target.value as TaskRecurrenceRule
                          )
                        }
                      >
                        {controller.TASK_RECURRENCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </LabeledField>
                  </div>
                  <div className="text-xs leading-5 text-zinc-500">
                    Live status updates automatically once the message is sent
                    and agents start replying. Use the manual actions above only
                    to recover or close out a task.
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      disabled={
                        controller.taskUpdateMutation.isPending ||
                        !controller.taskEditTitleDraft.trim() ||
                        !controller.taskEditMessageDraft.trim()
                      }
                      onClick={() =>
                        controller.taskUpdateMutation.mutate({
                          title: controller.taskEditTitleDraft.trim(),
                          messageBody: controller.taskEditMessageDraft.trim(),
                          scheduledFor: controller.taskEditScheduleDraft
                            ? controller.toIsoFromDatetimeLocal(
                                controller.taskEditScheduleDraft,
                                controller.taskEditTimezoneDraft.trim() ||
                                  controller.defaultTaskTimezone()
                              )
                            : null,
                          timezone:
                            controller.taskEditTimezoneDraft.trim() ||
                            controller.defaultTaskTimezone(),
                          recurrenceRule:
                            controller.taskEditRecurrenceDraft === "none"
                              ? "none"
                              : controller.taskEditRecurrenceDraft,
                        })
                      }
                      type="button"
                    >
                      {controller.taskUpdateMutation.isPending
                        ? "Saving..."
                        : "Save schedule"}
                    </Button>
                  </div>
                </div>
              </div>

              <controller.SectionListHeader title="Runs" />
              {(controller.selectedTaskRunsQuery.data?.data ?? []).length ? (
                <controller.CompactRows
                  rows={controller.selectedTaskRunsQuery.data?.data ?? []}
                  render={(entry) => (
                    <button
                      className="w-full text-left"
                      onClick={() => controller.setSelectedRunId(entry.id)}
                      type="button"
                    >
                      <div className="font-medium">{entry.status}</div>
                      <div className="text-xs text-muted-foreground">
                        {relativeTime(entry.startedAt)} · {entry.tokensUsed}{" "}
                        tokens
                      </div>
                    </button>
                  )}
                />
              ) : (
                <CompactNotice>
                  No runs yet. Run history for this task will appear here.
                </CompactNotice>
              )}
              <controller.SectionListHeader title="Run events" />
              {(controller.selectedRunEventsQuery.data?.data ?? []).length ? (
                <controller.CompactRows
                  rows={controller.selectedRunEventsQuery.data?.data ?? []}
                  render={(entry) => (
                    <>
                      <div className="font-medium">{entry.type}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.content}
                      </div>
                    </>
                  )}
                />
              ) : (
                <CompactNotice>
                  {controller.selectedRunId
                    ? "No run events yet."
                    : "Choose a run above to inspect its events."}
                </CompactNotice>
              )}
            </div>
          )
        })()
      ) : (
        <EmptyPanel
          title="Select a task"
          description="Choose a task from the left to inspect detail, runs, and run events."
        />
      )}
    </controller.DetailCard>
  )
}

function DetailReportsSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const selectedReport = controller.selectedReport
  const selectedWrapUpThread =
    selectedReport?.kind === "wrap_up"
      ? controller.threadsById.get(selectedReport.threadId)
      : null
  const selectedWrapUpAgents =
    selectedWrapUpThread?.agentIds
      .map((agentId) => controller.agentsById.get(agentId))
      .filter((agent): agent is Agent => Boolean(agent)) ?? []

  if (controller.insightsTab === "analytics") {
    return (
      <controller.DetailCard
        title={controller.selectedThread?.title ?? "Insights"}
        subtitle="Thread analytics"
        compact
      >
        <ThreadAnalyticsPane
          selectedThread={controller.selectedThread}
          analytics={controller.selectedThreadAnalyticsQuery.data ?? null}
          isLoading={controller.selectedThreadAnalyticsQuery.isLoading}
          isRefreshing={controller.selectedThreadAnalyticsQuery.isFetching}
          errorMessage={
            controller.selectedThreadAnalyticsQuery.error instanceof Error
              ? controller.selectedThreadAnalyticsQuery.error.message
              : null
          }
          activityGapMinutes={controller.threadAnalyticsGapMinutes}
          agentRepeatSessionId={controller.threadAnalyticsAgentRepeatSessionId}
          onActivityGapMinutesChange={(value) =>
            controller.setThreadAnalyticsGapMinutes(
              Math.max(1, Math.min(1440, value))
            )
          }
          onRunAgentRepeatAnalysis={(threadSessionId) => {
            controller.setThreadAnalyticsAgentRepeatSessionId(threadSessionId)
          }}
          onExportJson={() => {
            if (
              !controller.selectedThread ||
              !controller.selectedThreadAnalyticsQuery.data
            ) {
              return
            }
            downloadTextFile(
              controller.buildThreadAnalyticsFilename(
                controller.selectedThread.title,
                "json"
              ),
              JSON.stringify(
                controller.selectedThreadAnalyticsQuery.data,
                null,
                2
              ),
              "application/json;charset=utf-8"
            )
          }}
          onExportCsv={() => {
            if (
              !controller.selectedThread ||
              !controller.selectedThreadAnalyticsQuery.data
            ) {
              return
            }
            downloadTextFile(
              controller.buildThreadAnalyticsFilename(
                controller.selectedThread.title,
                "csv"
              ),
              controller.buildThreadAnalyticsCsv(
                controller.selectedThreadAnalyticsQuery.data
              ),
              "text/csv;charset=utf-8"
            )
          }}
          topSlot={<RelayConsoleInsightsTabs controller={controller} />}
          embedded
        />
      </controller.DetailCard>
    )
  }

  return (
    <controller.DetailCard
      title={
        controller.selectedReportQuery.data?.title ??
        selectedReport?.title ??
        "Report detail"
      }
      subtitle={
        selectedReport?.kind === "wrap_up"
          ? "Team chat wrap-up"
          : ((
              controller.selectedReportQuery.data as
                | import("@clawchat/contracts").ReportSnapshot
                | undefined
            )?.type ?? "Select a report")
      }
      headerLeft={
        <div className="space-y-1">
          <div className="claw-title-detail font-semibold tracking-[-0.03em]">
            {controller.selectedReportQuery.data?.title ??
              selectedReport?.title ??
              "Report detail"}
          </div>
          {selectedReport?.kind === "wrap_up" ? (
            <div className="text-sm text-zinc-400">Team chat wrap-up</div>
          ) : (
            <div className="text-sm text-zinc-400">
              {(
                controller.selectedReportQuery.data as
                  | import("@clawchat/contracts").ReportSnapshot
                  | undefined
              )?.type ?? "Select a report"}
            </div>
          )}
        </div>
      }
      headerRight={
        selectedReport?.kind === "wrap_up" && selectedWrapUpAgents.length ? (
          <controller.ParticipantAvatarStack agents={selectedWrapUpAgents} />
        ) : undefined
      }
    >
      <div className="space-y-6">
        {<RelayConsoleInsightsTabs controller={controller} />}
        {selectedReport ? (
          <>
            {selectedReport.kind === "wrap_up" ? (
              <>
                <controller.CompactReportMetaCard
                  columns={[
                    [
                      ["Source", "Team chat wrap-up"],
                      [
                        "Cycle",
                        `Cycle ${selectedReport.threadSessionSequenceNumber}`,
                      ],
                      ["Provider", selectedReport.provider],
                      ["Model", selectedReport.model],
                      [
                        "Status",
                        selectedReport.status === "generating"
                          ? "Generating"
                          : selectedReport.status === "failed"
                            ? "Failed"
                            : "Completed",
                      ],
                    ],
                    [
                      ["Messages", String(selectedReport.messageCount)],
                      ["Created", relativeTime(selectedReport.createdAt)],
                      ["File", selectedReport.fileName],
                    ],
                  ]}
                />
                {selectedReport.status === "generating" ? (
                  <div className="rounded-[4px] border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                    This report is still generating. The chat has already been
                    reset and the archived cycle is safe.
                  </div>
                ) : selectedReport.status === "failed" ? (
                  <div className="rounded-[4px] border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        Report generation failed. The chat cycle was still
                        archived and reset safely.
                      </div>
                      <Button
                        className="border-red-300/25 bg-red-300/10 text-red-50 hover:bg-red-300/15"
                        disabled={
                          controller.wrapUpReportRetryMutation.isPending
                        }
                        onClick={() =>
                          controller.wrapUpReportRetryMutation.mutate(
                            selectedReport
                          )
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RefreshCcw className="size-3.5" />
                        {controller.wrapUpReportRetryMutation.isPending
                          ? "Retrying..."
                          : "Retry report"}
                      </Button>
                    </div>
                    {selectedReport.errorMessage ? (
                      <div className="mt-2 text-xs text-red-200/80">
                        {selectedReport.errorMessage}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <controller.CollapsibleReportSection
                  isOpen={controller.wrapUpMarkdownExpanded}
                  onToggle={() =>
                    controller.setWrapUpMarkdownExpanded((current) => !current)
                  }
                  title="Markdown report"
                >
                  <MarkdownBlock
                    value={
                      (
                        controller.selectedReportQuery.data as
                          | ThreadWrapUpReport
                          | undefined
                      )?.markdown ?? selectedReport.markdown
                    }
                  />
                </controller.CollapsibleReportSection>
                <controller.CollapsibleReportSection
                  isOpen={controller.wrapUpStructuredExpanded}
                  onToggle={() =>
                    controller.setWrapUpStructuredExpanded(
                      (current) => !current
                    )
                  }
                  title="Structured data"
                >
                  <controller.JsonBlock
                    value={
                      (
                        controller.selectedReportQuery.data as
                          | ThreadWrapUpReport
                          | undefined
                      )?.structuredData ?? selectedReport.structuredData
                    }
                  />
                </controller.CollapsibleReportSection>
              </>
            ) : (
              <>
                <controller.InfoGrid
                  items={[
                    ["Type", selectedReport.type],
                    ["Period", selectedReport.period],
                    ["Created", relativeTime(selectedReport.createdAt)],
                    [
                      "Range",
                      `${controller.formatDate(selectedReport.periodStart)} → ${controller.formatDate(selectedReport.periodEnd)}`,
                    ],
                  ]}
                />
                <controller.SectionListHeader title="Snapshot data" />
                <controller.JsonBlock
                  value={
                    (
                      controller.selectedReportQuery.data as
                        | import("@clawchat/contracts").ReportSnapshot
                        | undefined
                    )?.data ?? selectedReport.data
                  }
                />
              </>
            )}
          </>
        ) : (
          <EmptyPanel
            title="Select a report"
            description="Choose a report from the left to inspect the generated snapshot."
          />
        )}
      </div>
    </controller.DetailCard>
  )
}

export function RelayConsoleDetailPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    DetailCard,
    agents,
    applicationClassifications,
    applicationFilter,
    approvals,
    buildThreadAnalyticsCsv,
    buildThreadAnalyticsFilename,
    canAccessMissionControl,
    companies,
    departments,
    effectiveSection,
    effectiveWorkspaceId,
    isWorkspaceAdmin,
    marketplaceCategory,
    marketplaceReturnAppSlug,
    marketplaceRiskFilter,
    marketplaceSearch,
    messages,
    missionControlView,
    openMarketplaceCompatibleAgent,
    openMarketplaceConnectedChat,
    openMarketplaceRuntimePairing,
    queryClient,
    realtime,
    selectedArtifactId,
    selectedThread,
    selectedThreadAnalyticsQuery,
    setApplicationClassifications,
    setMarketplaceCategory,
    setMarketplaceReturnAppSlug,
    setMarketplaceSearch,
    setMissionControlView,
    setSelectedArtifactId,
    setThreadAnalyticsAgentRepeatSessionId,
    setThreadAnalyticsGapMinutes,
    tasks,
    teams,
    threadAnalyticsAgentRepeatSessionId,
    threadAnalyticsGapMinutes,
    threads,
    workspaceLoadErrorMessage,
    workspacesQuery,
  } = controller

  if (!effectiveWorkspaceId && workspacesQuery.isPending) {
    return (
      <DetailCard title="Loading workspaces" subtitle="Relay workspace sync">
        <EmptyPanel
          title="Loading workspaces"
          description="Checking the Relay service for your existing workspaces."
        />
      </DetailCard>
    )
  }

  if (!effectiveWorkspaceId && workspaceLoadErrorMessage) {
    return (
      <DetailCard title="Workspace load failed" subtitle="Relay workspace sync">
        <div className="space-y-4">
          <EmptyPanel
            title="Could not load workspaces"
            description={workspaceLoadErrorMessage}
          />
          <Button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["workspaces"] })
            }
            type="button"
            variant="secondary"
          >
            <RefreshCcw className="size-4" />
            Retry workspace load
          </Button>
        </div>
      </DetailCard>
    )
  }

  switch (effectiveSection) {
    case "agentOpsHq":
      return effectiveWorkspaceId ? (
        <div className="h-full min-h-0 overflow-hidden bg-[var(--claw-bg-page)]">
          <AgentOpsHqScreen
            key={effectiveWorkspaceId}
            workspaceId={effectiveWorkspaceId}
            agents={agents}
            departments={departments}
            tasks={tasks}
            approvals={approvals}
            messages={selectedThread ? messages : []}
            threads={threads}
            runtimeDispatches={Object.values(realtime.runtimeDispatches).flat()}
            runtimeHealth={
              realtime.runtimeParticipantHealth[effectiveWorkspaceId] ?? []
            }
            runtimeContextUsage={Object.values(
              realtime.runtimeContextUsage
            ).flat()}
            agentOpsLiveStates={realtime.agentOpsLiveStates}
            onRequestAgentOpsLiveState={realtime.requestAgentOpsLiveState}
            debugControlsEnabled={appConfig.enableAgentOpsDebugControls}
          />
        </div>
      ) : (
        <DetailCard title="AgentOps HQ" subtitle="Create a workspace first">
          <EmptyPanel
            title="No workspace yet"
            description="Create a workspace before opening the AgentOps estate map."
          />
        </DetailCard>
      )
    case "missionControl":
      return (
        <div className="h-full min-h-0 overflow-auto bg-[var(--claw-bg-page)]">
          <MissionControlSection
            view={missionControlView}
            filter={applicationFilter}
            classifications={applicationClassifications}
            onClassificationsChange={setApplicationClassifications}
            onViewChange={setMissionControlView}
            workspaceId={effectiveWorkspaceId}
            agents={agents}
            companies={companies}
            departments={departments}
            teams={teams}
            marketplaceSearch={marketplaceSearch}
            marketplaceCategory={marketplaceCategory}
            marketplaceRiskFilter={marketplaceRiskFilter}
            initialMarketplaceAppSlug={marketplaceReturnAppSlug}
            onMarketplaceSearchChange={setMarketplaceSearch}
            onMarketplaceCategoryChange={setMarketplaceCategory}
            onMarketplaceAppSlugChange={setMarketplaceReturnAppSlug}
            onMarketplaceConnectionComplete={openMarketplaceConnectedChat}
            onCreateMarketplaceCompatibleAgent={openMarketplaceCompatibleAgent}
            onOpenMarketplaceRuntimePairing={openMarketplaceRuntimePairing}
            canAccessMissionControl={canAccessMissionControl}
            canManageMarketplace={isWorkspaceAdmin}
          />
        </div>
      )
    case "setup":
      return (
        <DetailCard title="Get started" subtitle="First-run workspace setup">
          <div className="space-y-6">
            <CompactNotice>
              Public setup now stops at creating a workspace. Internal
              scaffolding like raw organization, team, agent, and thread record
              creation should not be the first-run experience for customers.
            </CompactNotice>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
                <CardContent className="space-y-2 p-4">
                  <div className="text-sm font-medium text-zinc-100">
                    1. Create workspace
                  </div>
                  <div className="text-xs leading-5 text-muted-foreground">
                    Name the workspace that will hold your team, chats, and
                    integrations.
                  </div>
                </CardContent>
              </Card>
              <Card className="border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
                <CardContent className="space-y-2 p-4">
                  <div className="text-sm font-medium text-zinc-100">
                    2. Enter the app
                  </div>
                  <div className="text-xs leading-5 text-muted-foreground">
                    Once a workspace exists, the app routes into the customer
                    product surfaces instead of keeping you in setup.
                  </div>
                </CardContent>
              </Card>
              <Card className="border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
                <CardContent className="space-y-2 p-4">
                  <div className="text-sm font-medium text-zinc-100">
                    3. Admin-only setup later
                  </div>
                  <div className="text-xs leading-5 text-muted-foreground">
                    Advanced operational tools belong in guided admin flows or
                    protected operations screens, not public setup.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DetailCard>
      )
    case "threads":
      return <DetailThreadsSection controller={controller} />
    case "analytics":
      return (
        <ThreadAnalyticsPane
          selectedThread={selectedThread}
          analytics={selectedThreadAnalyticsQuery.data ?? null}
          isLoading={selectedThreadAnalyticsQuery.isLoading}
          isRefreshing={selectedThreadAnalyticsQuery.isFetching}
          errorMessage={
            selectedThreadAnalyticsQuery.error instanceof Error
              ? selectedThreadAnalyticsQuery.error.message
              : null
          }
          activityGapMinutes={threadAnalyticsGapMinutes}
          agentRepeatSessionId={threadAnalyticsAgentRepeatSessionId}
          onActivityGapMinutesChange={(value) =>
            setThreadAnalyticsGapMinutes(Math.max(1, Math.min(1440, value)))
          }
          onRunAgentRepeatAnalysis={(threadSessionId) => {
            setThreadAnalyticsAgentRepeatSessionId(threadSessionId)
          }}
          onExportJson={() => {
            if (!selectedThread || !selectedThreadAnalyticsQuery.data) return
            downloadTextFile(
              buildThreadAnalyticsFilename(selectedThread.title, "json"),
              JSON.stringify(selectedThreadAnalyticsQuery.data, null, 2),
              "application/json;charset=utf-8"
            )
          }}
          onExportCsv={() => {
            if (!selectedThread || !selectedThreadAnalyticsQuery.data) return
            downloadTextFile(
              buildThreadAnalyticsFilename(selectedThread.title, "csv"),
              buildThreadAnalyticsCsv(selectedThreadAnalyticsQuery.data),
              "text/csv;charset=utf-8"
            )
          }}
        />
      )
    case "agents":
      return <DetailAgentsSection controller={controller} />

    case "artifacts":
      return (
        <ArtifactsScreen
          workspaceId={effectiveWorkspaceId}
          agents={agents}
          canManage={Boolean(isWorkspaceAdmin)}
          mode="detail"
          selectedId={selectedArtifactId}
          onSelectedIdChange={setSelectedArtifactId}
        />
      )

    case "tasks":
      return <DetailTasksSection controller={controller} />
    case "reports":
      return <DetailReportsSection controller={controller} />

    case "settings":
      return <RelayConsoleSettingsDetailPane controller={controller} />
    case "operations":
      return <RelayConsoleOperationsDetailPane controller={controller} />
  }
}
