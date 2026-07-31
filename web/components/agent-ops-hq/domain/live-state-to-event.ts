import type { Agent, AgentOpsLiveAgentState } from "@clawchat/contracts"
import type { AgentOpsEvent, AgentOpsEventType } from "./estate-types"

export function agentOpsEventFromLiveState(
  workspaceId: string,
  agent: Agent,
  liveState: AgentOpsLiveAgentState,
  options?: { initialPlacement?: boolean }
): AgentOpsEvent {
  return {
    id: [
      "live-state",
      liveState.agentId,
      liveState.realState,
      liveState.source,
      liveState.dispatchId ?? "",
      liveState.taskId ?? "",
      liveState.approvalId ?? "",
      liveState.messageId ?? "",
      liveState.updatedAt,
    ].join(":"),
    workspaceId,
    type: eventTypeForLiveState(liveState),
    source:
      liveState.runtimeType === "hermes"
        ? "hermes"
        : liveState.runtimeType === "openclaw"
          ? "openclaw"
          : "clawchat",
    severity:
      liveState.realState === "error"
        ? "error"
        : liveState.realState === "waiting_for_approval"
          ? "warning"
          : liveState.realState === "completed"
            ? "success"
            : "info",
    timestamp: liveState.updatedAt,
    title: titleForLiveState(liveState),
    summary: liveState.reason,
    agentId: liveState.agentId,
    roomId: liveState.roomId ?? null,
    departmentId: liveState.departmentId ?? agent.departmentId ?? null,
    appId: liveState.appId ?? null,
    workflowId: liveState.workflowId ?? null,
    threadId: liveState.threadId ?? null,
    taskId: liveState.taskId ?? null,
    dispatchId: liveState.dispatchId ?? null,
    approvalId: liveState.approvalId ?? null,
    messageId: liveState.messageId ?? null,
    payload: {
      confidence: liveState.confidence,
      source: liveState.source,
      expiresAt: liveState.expiresAt ?? null,
      healthStatus: liveState.healthStatus ?? null,
      toolName: liveState.toolName ?? null,
      toolPhase: liveState.toolPhase ?? null,
      contextText: liveState.contextText ?? null,
      initialPlacement: options?.initialPlacement ?? false,
    },
  }
}

function eventTypeForLiveState(
  liveState: AgentOpsLiveAgentState
): AgentOpsEventType {
  switch (liveState.realState) {
    case "offline":
      return "agent.offline"
    case "idle":
      return "agent.idle"
    case "queued":
      return "agent.task.queued"
    case "working":
      return "agent.task.started"
    case "thinking":
      return "agent.thinking"
    case "tooling":
      return "agent.tool.called"
    case "waiting_for_approval":
      return "agent.waiting_for_approval"
    case "error":
      return "agent.error"
    case "cancelled":
      return "agent.dispatch.cancelled"
    case "completed":
      return "agent.task.completed"
  }
}

function titleForLiveState(liveState: AgentOpsLiveAgentState) {
  switch (liveState.realState) {
    case "offline":
      return "Agent offline"
    case "idle":
      return "Agent idle"
    case "queued":
      return "Task queued"
    case "working":
      return "Working"
    case "thinking":
      return "Thinking"
    case "tooling":
      return "Tool activity"
    case "waiting_for_approval":
      return "Waiting for approval"
    case "error":
      return "Agent error"
    case "cancelled":
      return "Work cancelled"
    case "completed":
      return "Work completed"
  }
}
