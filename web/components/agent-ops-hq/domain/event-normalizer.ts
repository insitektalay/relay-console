import type {
  Agent,
  Approval,
  Department,
  Message,
  Task,
} from "@clawchat/contracts"
import type {
  RuntimeContextUsageUiState,
  RuntimeDispatchUiState,
  RuntimeParticipantHealthUiState,
} from "@/hooks/use-clawchat-realtime"
import type {
  AgentOpsEstateLayout,
  AgentOpsEvent,
  AgentOpsSourceState,
} from "./estate-types"
import {
  findApplication,
  resolveApplicationRoom,
  resolveDepartmentRoom,
} from "./location-resolver"

type SeenMap = Record<string, true>

export function normalizeAgentOpsEvents(
  layout: AgentOpsEstateLayout,
  source: AgentOpsSourceState,
  seen: SeenMap = {}
): AgentOpsEvent[] {
  const events: AgentOpsEvent[] = [
    ...normalizeRuntimeHealth(
      source.workspaceId,
      source.runtimeHealth ?? [],
      seen
    ),
    ...normalizeRuntimeDispatches(
      layout,
      source.workspaceId,
      source.runtimeDispatches ?? [],
      source.tasks,
      source.agents,
      seen
    ),
    ...normalizeRuntimeContext(
      source.workspaceId,
      source.runtimeContextUsage ?? [],
      seen
    ),
    ...normalizeApprovals(
      layout,
      source.workspaceId,
      source.approvals,
      source.agents,
      seen
    ),
    ...normalizeTasks(
      layout,
      source.workspaceId,
      source.tasks,
      source.agents,
      source.departments,
      seen
    ),
    ...normalizeMessages(
      layout,
      source.workspaceId,
      source.messages ?? [],
      source.agents,
      seen
    ),
  ].filter(isAgentOpsEvent)
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export function inferBusinessContext(
  layout: AgentOpsEstateLayout,
  input: {
    appId?: string | null
    departmentId?: string | null
    text?: string | null
  }
) {
  const explicitApp = findApplication(layout, input.appId)
  const text = `${input.text ?? ""} ${input.appId ?? ""}`.toLowerCase()
  const app =
    explicitApp ??
    layout.applications.find((entry) => {
      const tokens = [entry.appId, entry.label, entry.visualTheme].map(
        (value) => value.toLowerCase()
      )
      return tokens.some((token) => token && text.includes(token))
    }) ??
    null
  const departmentRoom =
    resolveApplicationRoom(layout, app?.appId) ??
    resolveDepartmentRoom(layout, input.departmentId)
  const departmentId =
    departmentRoom?.departmentId ??
    input.departmentId ??
    app?.defaultDepartmentId ??
    null
  const outputType =
    app?.outputTypes
      .map((id) => layout.outputTypes.find((entry) => entry.id === id))
      .find(Boolean) ?? null
  return {
    appId: app?.appId ?? null,
    businessUnitId:
      app?.businessUnitId ??
      outputType?.businessUnitId ??
      departmentRoom?.businessUnitId ??
      null,
    departmentId,
    roomId: departmentRoom?.id ?? null,
    outputTypeId: outputType?.id ?? null,
    workflowId: app?.workflowIds?.[0] ?? null,
    websiteId: app?.publicProperties?.[0] ?? null,
  }
}

function normalizeRuntimeDispatches(
  layout: AgentOpsEstateLayout,
  workspaceId: string,
  dispatches: RuntimeDispatchUiState[],
  tasks: Task[],
  agents: Agent[],
  seen: SeenMap
): AgentOpsEvent[] {
  return dispatches.flatMap((dispatch) => {
    const agent = agents.find((entry) => entry.id === dispatch.agentId)
    const task = tasks.find(
      (entry) =>
        entry.threadId === dispatch.threadId ||
        entry.assignedAgentId === dispatch.agentId
    )
    const context = inferBusinessContext(layout, {
      departmentId: task?.departmentId ?? agent?.departmentId ?? null,
      text: `${task?.title ?? ""} ${task?.description ?? ""} ${dispatch.statusMessage ?? ""} ${dispatch.toolSummary ?? ""}`,
    })
    const base = {
      workspaceId,
      agentId: dispatch.agentId,
      threadId: dispatch.threadId,
      dispatchId: dispatch.dispatchId,
      timestamp: dispatch.updatedAt,
      source: dispatch.runtimeType === "hermes" ? "hermes" : "openclaw",
      ...context,
    } as const
    const events: AgentOpsEvent[] = []
    if (dispatch.status === "queued") {
      pushEvent(events, seen, {
        ...base,
        id: `dispatch-queued:${dispatch.dispatchId}`,
        type: "agent.task.queued",
        severity: "info",
        title: "Task queued",
        summary: agent
          ? `${agent.name} is queued for runtime work.`
          : "Runtime work queued.",
      })
    }
    if (["started", "streaming"].includes(dispatch.status)) {
      pushEvent(events, seen, {
        ...base,
        id: `dispatch-started:${dispatch.dispatchId}`,
        type: "agent.task.started",
        severity: "info",
        title: "Task started",
        summary:
          dispatch.statusMessage ??
          dispatch.toolSummary ??
          "Agent started runtime work.",
      })
    }
    if (dispatch.toolSummary) {
      pushEvent(events, seen, {
        ...base,
        id: `tool:${dispatch.dispatchId}:${dispatch.toolSummary}`,
        type: "agent.tool.called",
        severity: "info",
        title: "Tool activity",
        summary: dispatch.toolSummary,
      })
    }
    if (dispatch.status === "completed") {
      pushEvent(events, seen, {
        ...base,
        id: `dispatch-completed:${dispatch.dispatchId}`,
        type: "agent.task.completed",
        severity: "success",
        title: "Task completed",
        summary: "Runtime dispatch completed.",
        messageId: dispatch.postedMessageId,
      })
    }
    if (dispatch.status === "failed") {
      pushEvent(events, seen, {
        ...base,
        id: `dispatch-failed:${dispatch.dispatchId}:${dispatch.errorCode ?? ""}`,
        type: "agent.error",
        severity: "error",
        title: "Runtime error",
        summary: dispatch.errorMessage ?? "Runtime dispatch failed.",
      })
    }
    if (dispatch.status === "cancelled") {
      pushEvent(events, seen, {
        ...base,
        id: `dispatch-cancelled:${dispatch.dispatchId}`,
        type: "agent.dispatch.cancelled",
        severity: "warning",
        title: "Dispatch cancelled",
        summary: "Runtime dispatch was cancelled.",
      })
    }
    return events
  })
}

function normalizeRuntimeHealth(
  workspaceId: string,
  health: RuntimeParticipantHealthUiState[],
  seen: SeenMap
) {
  return health
    .map((entry) =>
      eventOnce(seen, {
        id: `health:${entry.agentId}:${entry.status}:${entry.updatedAt}`,
        workspaceId,
        agentId: entry.agentId,
        timestamp: entry.updatedAt,
        source: entry.runtimeType === "hermes" ? "hermes" : "openclaw",
        type: entry.status === "ready" ? "agent.online" : "agent.offline",
        severity: entry.status === "ready" ? "success" : "warning",
        title: entry.status === "ready" ? "Agent online" : "Agent offline",
        summary: entry.message ?? entry.status,
      })
    )
    .filter(isAgentOpsEvent)
}

function normalizeRuntimeContext(
  workspaceId: string,
  usage: RuntimeContextUsageUiState[],
  seen: SeenMap
) {
  return usage.flatMap((entry) => {
    const base = {
      id: `context:${entry.dispatchId}:${entry.updatedAt}`,
      workspaceId,
      agentId: entry.agentId,
      threadId: entry.threadId,
      dispatchId: entry.dispatchId,
      timestamp: entry.updatedAt,
      source: entry.runtimeType === "hermes" ? "hermes" : "openclaw",
      severity:
        entry.level === "critical" || entry.level === "overflow"
          ? "warning"
          : "info",
      title: "Context updated",
      summary:
        entry.percentUsed == null
          ? "Context usage reported."
          : `${Math.round(entry.percentUsed)}% context used.`,
      payload: {
        level: entry.level,
        percentUsed: entry.percentUsed,
        references: entry.references,
      },
    } satisfies Omit<AgentOpsEvent, "type">
    const events: AgentOpsEvent[] = []
    pushEvent(events, seen, { ...base, type: "agent.context.updated" })
    if (
      entry.level === "warn" ||
      entry.level === "critical" ||
      entry.level === "overflow"
    ) {
      pushEvent(events, seen, {
        ...base,
        id: `context-warning:${entry.dispatchId}:${entry.updatedAt}`,
        type: "agent.context.warning",
        title: "Context warning",
        severity: "warning",
      })
    }
    return events
  })
}

function normalizeApprovals(
  layout: AgentOpsEstateLayout,
  workspaceId: string,
  approvals: Approval[],
  agents: Agent[],
  seen: SeenMap
) {
  return approvals
    .map((approval) => {
      const agent = agents.find(
        (entry) => entry.id === approval.requestedByAgentId
      )
      const context = inferBusinessContext(layout, {
        departmentId: agent?.departmentId,
        text: `${approval.title} ${approval.description}`,
      })
      return eventOnce(seen, {
        id: `approval:${approval.id}:${approval.status}`,
        workspaceId,
        agentId: approval.requestedByAgentId,
        approvalId: approval.id,
        taskId: approval.taskId,
        timestamp: approval.updatedAt ?? approval.createdAt,
        source: "clawchat",
        type:
          approval.status === "approved"
            ? "agent.approval.approved"
            : approval.status === "rejected"
              ? "agent.approval.rejected"
              : "agent.waiting_for_approval",
        severity:
          approval.status === "pending"
            ? "warning"
            : approval.status === "approved"
              ? "success"
              : "error",
        title:
          approval.status === "pending"
            ? "Waiting for approval"
            : `Approval ${approval.status}`,
        summary: approval.title,
        ...context,
        roomId: "human_approval_room",
        departmentId: "human_approval_room",
      })
    })
    .filter(isAgentOpsEvent)
}

function normalizeTasks(
  layout: AgentOpsEstateLayout,
  workspaceId: string,
  tasks: Task[],
  agents: Agent[],
  departments: Department[],
  seen: SeenMap
) {
  return tasks
    .slice(0, 80)
    .flatMap((task) => {
      const agent = agents.find((entry) => entry.id === task.assignedAgentId)
      const department = departments.find(
        (entry) => entry.id === task.departmentId
      )
      const context = inferBusinessContext(layout, {
        departmentId: task.departmentId ?? agent?.departmentId ?? null,
        text: `${task.title} ${task.description ?? ""} ${department?.name ?? ""}`,
      })
      const type =
        task.status === "running" || task.status === "dispatched"
          ? "agent.task.started"
          : task.status === "completed"
            ? "agent.task.completed"
            : task.status === "failed"
              ? "agent.error"
              : task.status === "blocked"
                ? "agent.waiting_for_approval"
                : task.status === "cancelled"
                  ? "agent.dispatch.cancelled"
                  : "agent.task.queued"
      return eventOnce(seen, {
        id: `task:${task.id}:${task.status}:${task.updatedAt}`,
        workspaceId,
        agentId: task.assignedAgentId,
        taskId: task.id,
        threadId: task.threadId,
        approvalId: task.approvalId,
        timestamp: task.updatedAt,
        source: "clawchat",
        type,
        severity:
          task.status === "failed"
            ? "error"
            : task.status === "completed"
              ? "success"
              : task.status === "blocked"
                ? "warning"
                : "info",
        title: `Task ${task.status}`,
        summary: task.title,
        ...context,
      })
    })
    .filter(isAgentOpsEvent)
}

function normalizeMessages(
  layout: AgentOpsEstateLayout,
  workspaceId: string,
  messages: Message[],
  agents: Agent[],
  seen: SeenMap
) {
  return messages
    .filter((message) => !message.isFromUser)
    .slice(-20)
    .map((message) => {
      const agent = agents.find((entry) => entry.id === message.senderId)
      const context = inferBusinessContext(layout, {
        departmentId: agent?.departmentId,
        text: message.content,
      })
      return eventOnce(seen, {
        id: `message:${message.id}`,
        workspaceId,
        agentId: agent?.id ?? message.senderId,
        messageId: message.id,
        threadId: message.threadId,
        timestamp: message.createdAt,
        source: "clawchat",
        type: "message.created",
        severity: "info",
        title: "Agent message",
        summary: message.content.slice(0, 120),
        ...context,
      })
    })
    .filter(isAgentOpsEvent)
}

function eventOnce<T extends AgentOpsEvent>(seen: SeenMap, event: T): T | null {
  if (seen[event.id]) return null
  seen[event.id] = true
  return event
}

function pushEvent(
  events: AgentOpsEvent[],
  seen: SeenMap,
  event: AgentOpsEvent
) {
  const next = eventOnce(seen, event)
  if (next) events.push(next)
}

function isAgentOpsEvent(event: AgentOpsEvent | null): event is AgentOpsEvent {
  return Boolean(event)
}
