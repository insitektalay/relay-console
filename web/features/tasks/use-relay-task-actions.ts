"use client"

import { useMutation, type QueryClient } from "@tanstack/react-query"
import type { Task, TaskStatus, UpdateTaskInput } from "@clawchat/contracts"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"

type RelayTaskActionsInput = {
  effectiveWorkspaceId?: string | null
  queryClient: QueryClient
  selectedTask?: Task | null
  syncTaskPatchOverride: (task: Task, intended: Partial<Task>) => void
}

export function useRelayTaskActions({
  effectiveWorkspaceId,
  queryClient,
  selectedTask,
  syncTaskPatchOverride,
}: RelayTaskActionsInput) {
  const taskStatusMutation = useMutation({
    mutationFn: (status: TaskStatus) =>
      sdk.tasks.updateStatus(selectedTask!.id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tasks", effectiveWorkspaceId],
      })
      await queryClient.invalidateQueries({
        queryKey: ["task", selectedTask?.id],
      })
      toast.success("Task updated")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const taskUpdateMutation = useMutation({
    mutationFn: (input: UpdateTaskInput) =>
      sdk.tasks.update(selectedTask!.id, input),
    onSuccess: async (task, input) => {
      syncTaskPatchOverride(task, {
        messageBody: input.messageBody,
        scheduledFor: input.scheduledFor,
        timezone: input.timezone,
        recurrenceRule: input.recurrenceRule,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["tasks", effectiveWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["task", selectedTask?.id],
        }),
      ])
      toast.success("Task saved")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const taskDispatchMutation = useMutation({
    mutationFn: () => sdk.tasks.dispatch(selectedTask!.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["tasks", effectiveWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["task", selectedTask?.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["threads", effectiveWorkspaceId],
        }),
      ])
      toast.success("Task sent")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const taskCancelMutation = useMutation({
    mutationFn: () => sdk.tasks.cancel(selectedTask!.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["tasks", effectiveWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["task", selectedTask?.id],
        }),
      ])
      toast.success("Task cancelled")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return {
    taskCancelMutation,
    taskDispatchMutation,
    taskStatusMutation,
    taskUpdateMutation,
  }
}
