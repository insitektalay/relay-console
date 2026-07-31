"use client"
import type {
  TaskRecurrenceRule,
  TaskStatus,
  TaskTargetType,
} from "@clawchat/contracts"
import {
  Archive,
  CalendarClock,
  Pause,
  Play,
  Search,
  SquarePen,
  X,
} from "lucide-react"
import {
  CompactNotice,
  LabeledField,
} from "@/components/shared/relay-compact-fields"
import { selectClassName } from "@/lib/relay-presentation-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import type { RelayConsoleController } from "@/components/clawchat-web-app"

function AgentTaskListPanel({
  controller,
  startNewAgentTask,
  statusMeta,
  taskEmptyCard,
}: {
  controller: RelayConsoleController
  startNewAgentTask: () => void
  statusMeta: (status: TaskStatus | string) => string
  taskEmptyCard: (title: string, description: string) => React.ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <div
        className="shrink-0 rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_44%,transparent)] bg-[var(--claw-bg-surface)] p-3"
        data-testid="task-list-toolbar"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[5px] border border-violet-400/30 bg-violet-400/10 text-violet-300">
            <CalendarClock className="size-4" />
          </div>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              className="h-8 w-full bg-[var(--claw-bg-inset)] pl-8"
              placeholder="Search tasks"
              value={controller.taskSearch}
              onChange={(event) => controller.setTaskSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 pl-[42px]">
          <Button
            className="h-8 min-w-0 flex-1 gap-1.5 px-2.5 text-xs"
            size="sm"
            title={
              controller.isCreatingTask ? "Close scheduler" : "Schedule a task"
            }
            type="button"
            variant="secondary"
            onClick={() =>
              controller.isCreatingTask
                ? controller.setIsCreatingTask(false)
                : startNewAgentTask()
            }
          >
            {controller.isCreatingTask ? (
              <X className="size-3.5" />
            ) : (
              <SquarePen className="size-3.5" />
            )}
            <span className="truncate">
              {controller.isCreatingTask
                ? "Close scheduler"
                : "Schedule a task"}
            </span>
          </Button>
          <Badge
            aria-label={`${controller.currentTaskItems.length} current tasks`}
            className="h-6 min-w-6 justify-center border-white/10 bg-white/[0.04] px-1.5 text-zinc-300"
            variant="secondary"
          >
            {controller.currentTaskItems.length}
          </Badge>
        </div>
      </div>

      <ScrollArea className="mission-scrollbar min-h-0 flex-1">
        <div className="space-y-2">
          {controller.tasksQuery.isLoading ? (
            <div className="rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-4 py-10 text-center text-sm text-zinc-400">
              Loading…
            </div>
          ) : controller.currentTaskItems.length ? (
            controller.currentTaskItems.map((entry) => (
              <button
                key={entry.id}
                className={`w-full rounded-[5px] border px-3 py-2.5 text-left transition ${
                  entry.id === controller.selectedTask?.id
                    ? "border-[color-mix(in_srgb,var(--claw-accent-blue)_76%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_8%,var(--claw-bg-page))]"
                    : "border-[color-mix(in_srgb,var(--claw-border)_44%,transparent)] bg-[color-mix(in_srgb,var(--claw-bg-surface)_38%,var(--claw-bg-page))] hover:bg-[color-mix(in_srgb,var(--claw-bg-surface)_54%,var(--claw-bg-page))]"
                }`}
                data-testid="task-list-item"
                type="button"
                onClick={() => {
                  controller.setSelectedTaskId(entry.id)
                  controller.setSelectedRunId(null)
                  controller.setIsCreatingTask(false)
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[5px] border border-violet-400/30 bg-violet-400/10 text-violet-300">
                    <CalendarClock className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {entry.title}
                    </div>
                    <div className="claw-meta mt-1 truncate text-zinc-500">
                      {controller.formatTaskScheduleLabel(entry)}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge
                      variant="secondary"
                      className={statusMeta(entry.status)}
                    >
                      {controller.formatTaskDisplayStatusLabel(entry)}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="border-white/10 bg-white/[0.04] text-zinc-300"
                    >
                      {entry.priority || "normal"}
                    </Badge>
                  </div>
                </div>
              </button>
            ))
          ) : (
            taskEmptyCard(
              "No current tasks",
              "Active and upcoming tasks for all agents and teams will appear here."
            )
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function AgentTaskEditorPanel({
  controller,
  canCreateTask,
  statusMeta,
  task,
  taskEmptyCard,
}: {
  controller: RelayConsoleController
  canCreateTask: boolean
  statusMeta: (status: TaskStatus | string) => string
  task: RelayConsoleController["selectedTask"]
  taskEmptyCard: (title: string, description: string) => React.ReactNode
}) {
  const { AgentPicker, QuickCreateCard } = controller

  return (
    <ScrollArea className="mission-scrollbar min-h-0 min-w-0">
      <div className="min-w-0 pb-4">
        {controller.isCreatingTask ? (
          <QuickCreateCard
            title="Schedule task"
            description="Choose the target, write the message, and decide when it should be sent."
            disabled={!canCreateTask}
            submitLabel={
              controller.taskCreateMutation.isPending
                ? "Scheduling..."
                : "Schedule task"
            }
            onSubmit={() => controller.taskCreateMutation.mutate()}
          >
            <LabeledField label="Title">
              <Input
                value={controller.taskTitleDraft}
                onChange={(event) =>
                  controller.setTaskTitleDraft(event.target.value)
                }
              />
            </LabeledField>
            <div className="grid gap-4 md:grid-cols-2">
              <LabeledField label="Priority">
                <select
                  className={selectClassName}
                  value={controller.taskPriorityDraft}
                  onChange={(event) =>
                    controller.setTaskPriorityDraft(event.target.value)
                  }
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
                  value={controller.taskTargetTypeDraft}
                  onChange={(event) =>
                    controller.setTaskTargetTypeDraft(
                      event.target.value as TaskTargetType
                    )
                  }
                >
                  {controller.TASK_TARGET_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </LabeledField>
            </div>
            {controller.taskTargetTypeDraft === "direct" ? (
              <LabeledField label="Agent">
                <AgentPicker
                  agents={controller.agents}
                  placeholder="Choose an agent"
                  resolveAgentDisplayName={controller.resolveAgentDisplayName}
                  value={controller.taskTargetAgentIdDraft}
                  onChange={controller.setTaskTargetAgentIdDraft}
                />
              </LabeledField>
            ) : null}
            {controller.taskTargetTypeDraft === "team" ? (
              <LabeledField label="Team">
                <select
                  className={selectClassName}
                  value={
                    controller.taskTargetTeamIdDraft ||
                    controller.teams[0]?.id ||
                    ""
                  }
                  onChange={(event) =>
                    controller.setTaskTargetTeamIdDraft(event.target.value)
                  }
                >
                  {controller.teams.length ? null : (
                    <option value="">No teams available</option>
                  )}
                  {controller.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </LabeledField>
            ) : null}
            {controller.taskTargetTypeDraft === "department" ? (
              <LabeledField label="Department">
                <select
                  className={selectClassName}
                  value={
                    controller.taskTargetDepartmentIdDraft ||
                    controller.departments[0]?.id ||
                    ""
                  }
                  onChange={(event) =>
                    controller.setTaskTargetDepartmentIdDraft(
                      event.target.value
                    )
                  }
                >
                  {controller.departments.length ? null : (
                    <option value="">No departments available</option>
                  )}
                  {controller.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </LabeledField>
            ) : null}
            {controller.taskTargetTypeDraft === "agent_to_agent" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <LabeledField label="Agent one">
                  <AgentPicker
                    agents={controller.agents}
                    placeholder="Choose an agent"
                    resolveAgentDisplayName={controller.resolveAgentDisplayName}
                    value={controller.taskTargetAgentIdDraft}
                    onChange={controller.setTaskTargetAgentIdDraft}
                  />
                </LabeledField>
                <LabeledField label="Agent two">
                  <AgentPicker
                    agents={controller.agents}
                    disabledAgentIds={
                      controller.taskTargetAgentIdDraft
                        ? [controller.taskTargetAgentIdDraft]
                        : undefined
                    }
                    placeholder="Choose another agent"
                    resolveAgentDisplayName={controller.resolveAgentDisplayName}
                    value={controller.taskTargetAgentTwoIdDraft}
                    onChange={controller.setTaskTargetAgentTwoIdDraft}
                  />
                </LabeledField>
              </div>
            ) : null}
            <LabeledField label="Message">
              <Textarea
                rows={4}
                value={controller.taskMessageDraft}
                onChange={(event) =>
                  controller.setTaskMessageDraft(event.target.value)
                }
              />
            </LabeledField>
            <div className="grid gap-4 md:grid-cols-3">
              <LabeledField label="Send at">
                <Input
                  type="datetime-local"
                  value={controller.taskScheduleDraft}
                  onChange={(event) =>
                    controller.setTaskScheduleDraft(event.target.value)
                  }
                />
              </LabeledField>
              <LabeledField label="Time zone">
                <Input
                  value={controller.taskTimezoneDraft}
                  onChange={(event) =>
                    controller.setTaskTimezoneDraft(event.target.value)
                  }
                  placeholder={controller.defaultTaskTimezone()}
                />
              </LabeledField>
              <LabeledField label="Repeat">
                <select
                  className={selectClassName}
                  value={controller.taskRecurrenceDraft}
                  onChange={(event) =>
                    controller.setTaskRecurrenceDraft(
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
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                checked={controller.taskRequiresApprovalDraft}
                onChange={(event) =>
                  controller.setTaskRequiresApprovalDraft(event.target.checked)
                }
                type="checkbox"
              />
              Hold for approval before sending
            </label>
            <CompactNotice>
              {controller.describeTaskSchedule({
                scheduledFor: controller.taskScheduleDraft
                  ? controller.toIsoFromDatetimeLocal(
                      controller.taskScheduleDraft,
                      controller.taskTimezoneDraft.trim() ||
                        controller.defaultTaskTimezone()
                    )
                  : null,
                timezone:
                  controller.taskTimezoneDraft.trim() ||
                  controller.defaultTaskTimezone(),
                recurrenceRule: controller.taskRecurrenceDraft,
              })}
            </CompactNotice>
          </QuickCreateCard>
        ) : task ? (
          <div className="space-y-3">
            <div className="rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_44%,transparent)] bg-[color-mix(in_srgb,var(--claw-bg-surface)_38%,var(--claw-bg-page))] px-3 py-2.5">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-[5px] border border-violet-400/30 bg-violet-400/10 text-violet-300">
                  <CalendarClock className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-100">
                    {task.title}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge
                    variant="secondary"
                    className={statusMeta(task.status)}
                  >
                    {controller.formatTaskDisplayStatusLabel(task)}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="border-white/10 bg-white/[0.04] text-zinc-300"
                  >
                    {task.priority || "normal"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                disabled={
                  controller.taskDispatchMutation.isPending ||
                  task.status === "cancelled"
                }
                size="xs"
                type="button"
                onClick={() => controller.taskDispatchMutation.mutate()}
              >
                {controller.taskDispatchMutation.isPending
                  ? "Sending..."
                  : "Send now"}
              </Button>
              <Button
                disabled={!task.threadId}
                size="xs"
                type="button"
                variant="secondary"
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
                  disabled={controller.taskStatusMutation.isPending}
                  size="xs"
                  type="button"
                  variant="secondary"
                  onClick={() => controller.taskStatusMutation.mutate("queued")}
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Resume schedule
                </Button>
              ) : (
                <Button
                  disabled={
                    controller.taskStatusMutation.isPending ||
                    !controller.canPauseTaskSchedule(task)
                  }
                  size="xs"
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    controller.taskStatusMutation.mutate("blocked")
                  }
                >
                  <Pause className="mr-1.5 h-3.5 w-3.5" />
                  Pause schedule
                </Button>
              )}
              <Button
                disabled={controller.taskCancelMutation.isPending}
                size="xs"
                type="button"
                variant="secondary"
                onClick={() => controller.taskCancelMutation.mutate()}
              >
                {controller.taskCancelMutation.isPending
                  ? "Cancelling..."
                  : "Cancel schedule"}
              </Button>
              <Button
                size="xs"
                type="button"
                variant="secondary"
                onClick={() => controller.archiveTaskFromList(task.id)}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Archive
              </Button>
            </div>

            <div className="pt-0.5 text-sm font-semibold text-zinc-200">
              Task metadata
            </div>
            <div className="grid gap-1.5 text-xs sm:grid-cols-2">
              {[
                ["Priority", task.priority],
                ["Target", controller.formatTaskTarget(task)],
                ["Assigned agent", controller.agentName(task.assignedAgentId)],
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
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2 py-1.5 leading-4"
                >
                  <div className="text-zinc-500">{label}:</div>
                  <div className="truncate text-zinc-200">{value}</div>
                </div>
              ))}
            </div>
            {task.lastError ? (
              <CompactNotice>Last error: {task.lastError}</CompactNotice>
            ) : null}
            <div className="space-y-2 border-t border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-200">
                  Message schedule
                </div>
                <Badge
                  className="border-amber-400/20 bg-amber-400/10 text-amber-200"
                  variant="secondary"
                >
                  Read-only
                </Badge>
              </div>
              <div className="claw-caption text-zinc-400">
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
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <LabeledField label="Title">
                  <Input className="h-8" disabled readOnly value={task.title} />
                </LabeledField>
                <LabeledField label="Send at">
                  <Input
                    className="h-8"
                    disabled
                    readOnly
                    value={task.nextRunAt ?? task.scheduledFor ?? "n/a"}
                  />
                </LabeledField>
                <LabeledField label="Time zone">
                  <Input
                    className="h-8"
                    disabled
                    readOnly
                    value={task.timezone || controller.defaultTaskTimezone()}
                  />
                </LabeledField>
                <LabeledField label="Repeats">
                  <Input
                    className="h-8"
                    disabled
                    readOnly
                    value={
                      task.recurrenceRule
                        ? controller.formatTaskRecurrence(task.recurrenceRule)
                        : "One-off"
                    }
                  />
                </LabeledField>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[26rem] items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
            {taskEmptyCard(
              "No task selected",
              "Select a current task, or schedule a new task."
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

export function RelayConsoleAgentTasksDetail({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    DetailCard,
    departments,
    effectiveWorkspaceId,
    selectedAgent,
    selectedTask,
    selectedTaskDetail,
    setIsCreatingTask,
    setTaskPanelMode,
    setTaskTargetAgentIdDraft,
    setTaskTargetAgentTwoIdDraft,
    setTaskTargetTypeDraft,
    taskCreateMutation,
    taskMessageDraft,
    taskScheduleDraft,
    taskTargetAgentIdDraft,
    taskTargetAgentTwoIdDraft,
    taskTargetDepartmentIdDraft,
    taskTargetTeamIdDraft,
    taskTargetTypeDraft,
    taskTitleDraft,
    teams,
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

  const statusMeta = (status: TaskStatus | string) => {
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

  const startNewAgentTask = () => {
    setTaskPanelMode("tasks")
    setIsCreatingTask(true)
    if (selectedAgent?.id) {
      setTaskTargetTypeDraft("direct")
      setTaskTargetAgentIdDraft(selectedAgent.id)
      setTaskTargetAgentTwoIdDraft("")
    }
  }

  const task = selectedTaskDetail ?? selectedTask
  const taskEmptyCard = (title: string, description: string) => (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-5 py-8 text-center">
      <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
        Standby
      </div>
      <div className="mt-2 text-base font-medium tracking-[-0.02em] text-zinc-100">
        {title}
      </div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
        {description}
      </div>
    </div>
  )

  return (
    <DetailCard
      title="Tasks"
      subtitle="Scheduled messages, dispatches, and task run history"
      hideHeader
      frameless
      contentClassName="h-full"
    >
      <div
        className="grid h-full min-h-0 gap-2.5 xl:grid-cols-[minmax(330px,0.47fr)_minmax(0,1fr)]"
        data-testid="agent-task-schedule"
      >
        <AgentTaskListPanel
          controller={controller}
          startNewAgentTask={startNewAgentTask}
          statusMeta={statusMeta}
          taskEmptyCard={taskEmptyCard}
        />

        <AgentTaskEditorPanel
          controller={controller}
          canCreateTask={canCreateTask}
          statusMeta={statusMeta}
          task={task}
          taskEmptyCard={taskEmptyCard}
        />
      </div>
    </DetailCard>
  )
}
