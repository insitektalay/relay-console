"use client"

import type { Dispatch, SetStateAction } from "react"
import { useMutation, type QueryClient } from "@tanstack/react-query"
import type {
  Department,
  Paginated,
  Task,
  TaskRecurrenceRule,
  TaskTargetType,
  Team,
} from "@clawchat/contracts"
import { toast } from "sonner"
import type { AppSection } from "@/components/app-shell/app-sidebar"
import { sdk } from "@/lib/sdk"
import {
  defaultTaskScheduleValue,
  defaultTaskTimezone,
  sameInstant,
  toIsoFromDatetimeLocal,
} from "@/features/tasks/task-schedule"

type RelayTaskCreateActionInput = {
  departments: Department[]
  effectiveWorkspaceId?: string | null
  ensureTaskThread: (task: Task) => Promise<string | null>
  queryClient: QueryClient
  setAgentsManagementTab: (value: "tasks") => void
  setIsCreatingTask: Dispatch<SetStateAction<boolean>>
  setSection: Dispatch<SetStateAction<AppSection>>
  setSelectedRunId: Dispatch<SetStateAction<string | null>>
  setSelectedTaskId: Dispatch<SetStateAction<string | null>>
  setTaskMessageDraft: Dispatch<SetStateAction<string>>
  setTaskRecurrenceDraft: Dispatch<SetStateAction<TaskRecurrenceRule>>
  setTaskRequiresApprovalDraft: Dispatch<SetStateAction<boolean>>
  setTaskScheduleDraft: Dispatch<SetStateAction<string>>
  setTaskTargetAgentIdDraft: Dispatch<SetStateAction<string>>
  setTaskTargetAgentTwoIdDraft: Dispatch<SetStateAction<string>>
  setTaskTargetDepartmentIdDraft: Dispatch<SetStateAction<string>>
  setTaskTargetTeamIdDraft: Dispatch<SetStateAction<string>>
  setTaskTargetTypeDraft: Dispatch<SetStateAction<TaskTargetType>>
  setTaskTimezoneDraft: Dispatch<SetStateAction<string>>
  setTaskTitleDraft: Dispatch<SetStateAction<string>>
  syncTaskPatchOverride: (task: Task, intended: Partial<Task>) => void
  taskMessageDraft: string
  taskPriorityDraft: string
  taskRecurrenceDraft: TaskRecurrenceRule
  taskRequiresApprovalDraft: boolean
  taskScheduleDraft: string
  taskTargetAgentIdDraft: string
  taskTargetAgentTwoIdDraft: string
  taskTargetDepartmentIdDraft: string
  taskTargetTeamIdDraft: string
  taskTargetTypeDraft: TaskTargetType
  taskTimezoneDraft: string
  taskTitleDraft: string
  teams: Team[]
}

export function useRelayTaskCreateAction({
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
}: RelayTaskCreateActionInput) {
  const taskCreateMutation = useMutation({
    mutationFn: async () => {
      const title = taskTitleDraft.trim()
      const messageBody = taskMessageDraft.trim()
      const timezone = taskTimezoneDraft.trim() || defaultTaskTimezone()
      const scheduledFor = toIsoFromDatetimeLocal(taskScheduleDraft, timezone)
      const recurrenceRule = taskRecurrenceDraft
      const intendedTaskFields: Partial<Task> = {
        messageBody,
        scheduledFor,
        timezone,
        recurrenceRule,
      }

      const createdTask = await sdk.tasks.create({
        title,
        messageBody,
        priority: taskPriorityDraft,
        workspaceId: effectiveWorkspaceId!,
        targetType: taskTargetTypeDraft,
        targetAgentId:
          taskTargetTypeDraft === "direct" ||
          taskTargetTypeDraft === "agent_to_agent"
            ? taskTargetAgentIdDraft || undefined
            : undefined,
        targetAgentTwoId:
          taskTargetTypeDraft === "agent_to_agent"
            ? taskTargetAgentTwoIdDraft || undefined
            : undefined,
        teamId:
          taskTargetTypeDraft === "team"
            ? taskTargetTeamIdDraft || teams[0]?.id || undefined
            : undefined,
        departmentId:
          taskTargetTypeDraft === "department"
            ? taskTargetDepartmentIdDraft || departments[0]?.id || undefined
            : undefined,
        assignedAgentId:
          taskTargetTypeDraft === "direct"
            ? taskTargetAgentIdDraft || undefined
            : undefined,
        scheduledFor,
        timezone,
        recurrenceRule,
        requiresApproval: taskRequiresApprovalDraft,
      })

      const effectiveScheduledFor =
        createdTask.nextRunAt ?? createdTask.scheduledFor
      const shouldRepairSchedule = !sameInstant(
        effectiveScheduledFor,
        scheduledFor
      )
      const shouldRepairTimezone =
        (createdTask.timezone || defaultTaskTimezone()) !== timezone
      const shouldRepairRecurrence =
        (createdTask.recurrenceRule ?? "none") !== recurrenceRule

      if (
        !shouldRepairSchedule &&
        !shouldRepairTimezone &&
        !shouldRepairRecurrence
      ) {
        await ensureTaskThread(createdTask)
        syncTaskPatchOverride(createdTask, intendedTaskFields)
        return createdTask
      }

      try {
        const updatedTask = await sdk.tasks.update(createdTask.id, {
          title,
          messageBody,
          scheduledFor,
          timezone,
          recurrenceRule,
        })
        await ensureTaskThread(updatedTask)
        syncTaskPatchOverride(updatedTask, intendedTaskFields)
        return updatedTask
      } catch {
        await ensureTaskThread(createdTask)
        syncTaskPatchOverride(createdTask, intendedTaskFields)
        return createdTask
      }
    },
    onSuccess: async (task) => {
      queryClient.setQueryData<Paginated<Task>>(
        ["tasks", effectiveWorkspaceId],
        (current) => {
          if (!current) return current
          const existing = current.data.some((entry) => entry.id === task.id)
          return {
            ...current,
            data: existing
              ? current.data.map((entry) =>
                  entry.id === task.id ? { ...entry, ...task } : entry
                )
              : [task, ...current.data],
            total: existing ? current.total : current.total + 1,
          }
        }
      )
      setTaskTitleDraft("")
      setTaskMessageDraft("")
      setTaskTargetTypeDraft("direct")
      setTaskTargetAgentIdDraft("")
      setTaskTargetAgentTwoIdDraft("")
      setTaskTargetTeamIdDraft("")
      setTaskTargetDepartmentIdDraft("")
      setTaskScheduleDraft(defaultTaskScheduleValue())
      setTaskTimezoneDraft(defaultTaskTimezone())
      setTaskRecurrenceDraft("none")
      setTaskRequiresApprovalDraft(false)
      setSelectedRunId(null)
      setIsCreatingTask(false)
      await queryClient.invalidateQueries({
        queryKey: ["tasks", effectiveWorkspaceId],
      })
      setSelectedTaskId(task.id)
      setSection("agents")
      setAgentsManagementTab("tasks")
      toast.success("Task created")
      if (!task.nextRunAt && !task.scheduledFor) {
        toast.error(
          "Task saved, but its send time was not persisted. Open it and save the schedule again."
        )
      }
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return { taskCreateMutation }
}
