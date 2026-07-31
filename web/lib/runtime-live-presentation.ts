import type {
  RuntimeRunToolPayload,
  RuntimeTodoTask,
} from "@clawchat/contracts"

export interface RuntimeToolActivityPresentation {
  toolName: string
  phase: RuntimeRunToolPayload["phase"]
  summary?: string
  updatedAt: string
}

export function normalizeRuntimeTodoTasks(
  tasks: RuntimeTodoTask[]
): RuntimeTodoTask[] {
  const validStatuses = new Set<RuntimeTodoTask["status"]>([
    "pending",
    "in_progress",
    "completed",
    "cancelled",
  ])
  return tasks.slice(0, 100).flatMap((task, index) => {
    if (!task || typeof task !== "object") return []
    const content =
      typeof task.content === "string"
        ? task.content.trim().slice(0, 2_000)
        : ""
    if (!content) return []
    const id =
      typeof task.id === "string" && task.id.trim()
        ? task.id.trim().slice(0, 200)
        : `todo-${index + 1}`
    const status = validStatuses.has(task.status) ? task.status : "pending"
    return [{ id, content, status }]
  })
}

export function upsertRuntimeToolActivity(
  activity: RuntimeToolActivityPresentation[],
  payload: RuntimeRunToolPayload
): RuntimeToolActivityPresentation[] {
  const next = activity.filter((entry) => entry.toolName !== payload.toolName)
  next.push({
    toolName: payload.toolName,
    phase: payload.phase,
    summary: payload.summary,
    updatedAt: payload.timestamp,
  })
  return next.slice(-20)
}
