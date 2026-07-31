"use client"
import type {
  TaskRecurrenceRule,
  TaskStatus,
  TaskTargetType,
} from "@clawchat/contracts"
import { Archive, SquarePen, X } from "lucide-react"
import {
  CompactNotice,
  LabeledField,
} from "@/components/shared/relay-compact-fields"
import {
  initials,
  relativeTime,
  selectClassName,
} from "@/lib/relay-presentation-utils"
import { EmptyState } from "@/components/shared/empty-state"
import { DepartmentAvatarBadge } from "@/components/shared/department-avatar-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import type {
  RelayConsoleController,
  ThreadFilterGroup,
} from "@/components/clawchat-web-app"

function taskStatusMeta(status: TaskStatus | string) {
  switch (status) {
    case "dispatched":
      return "border-blue-400/20 bg-blue-400/12 text-blue-100"
    case "running":
      return "border-cyan-400/20 bg-cyan-400/12 text-cyan-100"
    case "blocked":
      return "border-amber-400/20 bg-amber-400/12 text-amber-100"
    case "completed":
      return "border-emerald-400/20 bg-emerald-400/12 text-emerald-100"
    case "failed":
      return "border-rose-400/20 bg-rose-400/12 text-rose-100"
    case "cancelled":
      return "border-zinc-400/15 bg-zinc-400/8 text-zinc-200"
    case "queued":
    default:
      return "border-slate-300/15 bg-slate-300/8 text-slate-200"
  }
}
function TasksListHeader({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    approvals,
    isCreatingTask,
    setIsCreatingTask,
    setTaskFilterGroup,
    setTaskPanelMode,
    setTaskSearch,
    taskFilterGroup,
    taskPanelMode,
    taskSearch,
  } = controller
  return (
    <div className="border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-3 py-2.5">
      <div className="claw-title-pane mb-2.5 font-semibold tracking-[-0.02em]">
        Tasks
      </div>
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search tasks"
          value={taskSearch}
          onChange={(event) => setTaskSearch(event.target.value)}
        />
        <div className="shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            title={isCreatingTask ? "Close scheduler" : "Schedule a task"}
            onClick={() => {
              setTaskPanelMode("tasks")
              setIsCreatingTask((current) => !current)
            }}
          >
            {isCreatingTask ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <SquarePen className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <div className="mt-2.5 space-y-2">
        <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
          Options
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["business", "Business"],
                ["family", "Family"],
                ["personal", "Personal"],
              ] as Array<[ThreadFilterGroup, string]>
            ).map(([value, label]) => (
              <Button
                key={value}
                size="xs"
                type="button"
                variant={taskFilterGroup === value ? "secondary" : "ghost"}
                onClick={() => setTaskFilterGroup(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button
            size="xs"
            type="button"
            variant={taskPanelMode === "approvals" ? "secondary" : "ghost"}
            onClick={() => {
              setIsCreatingTask(false)
              setTaskPanelMode((current) =>
                current === "approvals" ? "tasks" : "approvals"
              )
            }}
          >
            {`Approvals (${approvals.length})`}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function RelayConsoleTasksListPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    AgentPicker,
    QuickCreateCard,
    TASK_RECURRENCE_OPTIONS,
    TASK_TARGET_TYPE_OPTIONS,
    agentName,
    agents,
    agentsById,
    approvalsQuery,
    archiveTaskFromList,
    defaultTaskTimezone,
    departments,
    departmentsById,
    describeTaskSchedule,
    effectiveApprovalId,
    effectiveWorkspaceId,
    filteredApprovals,
    filteredTaskItems,
    formatTaskDisplayStatusLabel,
    formatTaskScheduleLabel,
    formatTaskTarget,
    isCreatingTask,
    resolveAgentDisplayName,
    selectedTask,
    setSelectedApprovalId,
    setSelectedRunId,
    setSelectedTaskId,
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
    taskCreateMutation,
    taskMessageDraft,
    taskPanelMode,
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
    tasksQuery,
    teams,
    toIsoFromDatetimeLocal,
  } = controller

  const canCreateTask =
    Boolean(taskTitleDraft.trim()) &&
    Boolean(taskMessageDraft.trim()) &&
    Boolean(effectiveWorkspaceId) &&
    Boolean(taskScheduleDraft) &&
    (taskTargetTypeDraft === "direct"
      ? Boolean(taskTargetAgentIdDraft)
      : taskTargetTypeDraft === "team"
        ? Boolean(taskTargetTeamIdDraft || teams[0]?.id)
        : taskTargetTypeDraft === "department"
          ? Boolean(taskTargetDepartmentIdDraft || departments[0]?.id)
          : Boolean(taskTargetAgentIdDraft && taskTargetAgentTwoIdDraft)) &&
    !taskCreateMutation.isPending

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TasksListHeader controller={controller} />
      <ScrollArea className="mission-scrollbar min-h-0 flex-1">
        <div className="space-y-1 p-2.5">
          {isCreatingTask ? (
            <QuickCreateCard
              title="Schedule task"
              description="Choose the chat, write the message, and decide when it should be sent."
              onSubmit={() => taskCreateMutation.mutate()}
              disabled={!canCreateTask}
              submitLabel={
                taskCreateMutation.isPending ? "Scheduling..." : "Schedule task"
              }
            >
              <LabeledField label="Title">
                <Input
                  value={taskTitleDraft}
                  onChange={(event) => setTaskTitleDraft(event.target.value)}
                />
              </LabeledField>
              <LabeledField label="Priority">
                <select
                  className={selectClassName}
                  value={taskPriorityDraft}
                  onChange={(event) => setTaskPriorityDraft(event.target.value)}
                >
                  {["low", "normal", "high", "critical"].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <LabeledField label="Send to">
                <select
                  className={selectClassName}
                  value={taskTargetTypeDraft}
                  onChange={(event) =>
                    setTaskTargetTypeDraft(event.target.value as TaskTargetType)
                  }
                >
                  {TASK_TARGET_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </LabeledField>

              {taskTargetTypeDraft === "direct" ? (
                <LabeledField label="Agent">
                  <AgentPicker
                    agents={agents}
                    placeholder="Choose an agent"
                    resolveAgentDisplayName={resolveAgentDisplayName}
                    value={taskTargetAgentIdDraft}
                    onChange={setTaskTargetAgentIdDraft}
                  />
                </LabeledField>
              ) : null}

              {taskTargetTypeDraft === "team" ? (
                <LabeledField label="Team">
                  <select
                    className={selectClassName}
                    value={taskTargetTeamIdDraft || teams[0]?.id || ""}
                    onChange={(event) =>
                      setTaskTargetTeamIdDraft(event.target.value)
                    }
                  >
                    {teams.length ? null : (
                      <option value="">No teams available</option>
                    )}
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </LabeledField>
              ) : null}

              {taskTargetTypeDraft === "department" ? (
                <LabeledField label="Department">
                  <select
                    className={selectClassName}
                    value={
                      taskTargetDepartmentIdDraft || departments[0]?.id || ""
                    }
                    onChange={(event) =>
                      setTaskTargetDepartmentIdDraft(event.target.value)
                    }
                  >
                    {departments.length ? null : (
                      <option value="">No departments available</option>
                    )}
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </LabeledField>
              ) : null}

              {taskTargetTypeDraft === "agent_to_agent" ? (
                <>
                  <LabeledField label="Agent one">
                    <AgentPicker
                      agents={agents}
                      placeholder="Choose an agent"
                      resolveAgentDisplayName={resolveAgentDisplayName}
                      value={taskTargetAgentIdDraft}
                      onChange={setTaskTargetAgentIdDraft}
                    />
                  </LabeledField>
                  <LabeledField label="Agent two">
                    <AgentPicker
                      agents={agents}
                      disabledAgentIds={
                        taskTargetAgentIdDraft
                          ? [taskTargetAgentIdDraft]
                          : undefined
                      }
                      placeholder="Choose another agent"
                      resolveAgentDisplayName={resolveAgentDisplayName}
                      value={taskTargetAgentTwoIdDraft}
                      onChange={setTaskTargetAgentTwoIdDraft}
                    />
                  </LabeledField>
                </>
              ) : null}

              <LabeledField label="Message">
                <Textarea
                  rows={4}
                  value={taskMessageDraft}
                  onChange={(event) => setTaskMessageDraft(event.target.value)}
                />
              </LabeledField>
              <LabeledField label="Send at">
                <Input
                  type="datetime-local"
                  value={taskScheduleDraft}
                  onChange={(event) => setTaskScheduleDraft(event.target.value)}
                />
              </LabeledField>
              <LabeledField label="Time zone">
                <Input
                  value={taskTimezoneDraft}
                  onChange={(event) => setTaskTimezoneDraft(event.target.value)}
                  placeholder={defaultTaskTimezone()}
                />
              </LabeledField>
              <LabeledField label="Repeat">
                <select
                  className={selectClassName}
                  value={taskRecurrenceDraft}
                  onChange={(event) =>
                    setTaskRecurrenceDraft(
                      event.target.value as TaskRecurrenceRule
                    )
                  }
                >
                  {TASK_RECURRENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  checked={taskRequiresApprovalDraft}
                  onChange={(event) =>
                    setTaskRequiresApprovalDraft(event.target.checked)
                  }
                  type="checkbox"
                />
                Hold for approval before sending
              </label>
              <CompactNotice>
                {describeTaskSchedule({
                  scheduledFor: taskScheduleDraft
                    ? toIsoFromDatetimeLocal(
                        taskScheduleDraft,
                        taskTimezoneDraft.trim() || defaultTaskTimezone()
                      )
                    : null,
                  timezone: taskTimezoneDraft.trim() || defaultTaskTimezone(),
                  recurrenceRule: taskRecurrenceDraft,
                })}
              </CompactNotice>
            </QuickCreateCard>
          ) : taskPanelMode === "approvals" ? (
            approvalsQuery.isLoading ? (
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
                Loading…
              </div>
            ) : filteredApprovals.length ? (
              filteredApprovals.map((approval) => (
                <button
                  key={approval.id}
                  className={`w-full rounded-[4px] border px-3 py-2.5 text-left transition ${
                    approval.id === effectiveApprovalId
                      ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-surface))] text-[var(--claw-text-primary)]"
                      : "border-transparent bg-transparent hover:bg-[var(--claw-bg-surface)]"
                  }`}
                  onClick={() => setSelectedApprovalId(approval.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold tracking-[-0.01em]">
                        {approval.title}
                      </div>
                      <div className="claw-caption mt-1 line-clamp-2 leading-5 text-zinc-400">
                        {approval.description}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        approval.risk === "high"
                          ? "border-rose-400/20 bg-rose-400/12 text-rose-100"
                          : approval.risk === "medium"
                            ? "border-amber-400/20 bg-amber-400/12 text-amber-100"
                            : "border-emerald-400/20 bg-emerald-400/12 text-emerald-100"
                      }
                    >
                      {approval.risk}
                    </Badge>
                  </div>
                  <div className="claw-badge-text mt-2 tracking-[0.12em] text-zinc-500 uppercase">
                    {relativeTime(approval.createdAt)}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                title="No pending approvals"
                description="Approval requests will appear here when a task is held for approval."
              />
            )
          ) : tasksQuery.isLoading ? (
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
              Loading…
            </div>
          ) : filteredTaskItems.length ? (
            filteredTaskItems.map((task) => {
              const assignedAgent = task.assignedAgentId
                ? (agentsById.get(task.assignedAgentId) ?? null)
                : null
              const assignedLabel = assignedAgent
                ? resolveAgentDisplayName(assignedAgent)
                : task.targetAgentId
                  ? agentName(task.targetAgentId)
                  : task.title
              const avatarLabel = assignedLabel || task.title
              const preview =
                task.messageBody?.trim() ||
                task.description?.trim() ||
                "No message"
              const statusClassName = taskStatusMeta(task.status)
              const targetLabel = formatTaskTarget(task)
              const scheduleLabel = formatTaskScheduleLabel(task)

              return (
                <div
                  key={task.id}
                  className={`w-full rounded-[4px] border px-3 py-2.5 text-left transition ${
                    task.id === selectedTask?.id
                      ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-surface))] text-[var(--claw-text-primary)]"
                      : "border-transparent bg-transparent hover:bg-[var(--claw-bg-surface)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setSelectedTaskId(task.id)
                        setSelectedRunId(null)
                      }}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar
                          size="lg"
                          className="mt-0.5 !size-[3.3rem] shrink-0"
                        >
                          <AvatarImage
                            src={assignedAgent?.avatarUrl ?? undefined}
                          />
                          <AvatarFallback className="text-sm font-semibold">
                            {initials(avatarLabel)}
                          </AvatarFallback>
                          <DepartmentAvatarBadge
                            color={
                              assignedAgent?.departmentId
                                ? departmentsById.get(
                                    assignedAgent.departmentId
                                  )?.color
                                : null
                            }
                          />
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="truncate text-sm font-semibold tracking-[-0.01em]">
                            {task.title}
                          </div>
                          <div className="claw-caption line-clamp-2 leading-5 text-zinc-400">
                            {preview}
                          </div>
                          <div className="claw-meta truncate text-zinc-500">
                            {targetLabel}
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="mt-0.5 flex shrink-0 flex-col items-end gap-2 text-right">
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="text-zinc-500 hover:text-zinc-100"
                          onClick={(event) => {
                            event.stopPropagation()
                            archiveTaskFromList(task.id)
                          }}
                          aria-label={`Archive ${task.title}`}
                        >
                          <Archive />
                        </Button>
                        <Badge variant="secondary" className={statusClassName}>
                          {formatTaskDisplayStatusLabel(task)}
                        </Badge>
                      </div>
                      <div className="claw-badge-text tracking-[0.12em] text-zinc-500 uppercase">
                        {scheduleLabel}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <EmptyState
              title="No tasks in this workspace"
              description="Schedule a task to send a message into one of your chats."
            />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
