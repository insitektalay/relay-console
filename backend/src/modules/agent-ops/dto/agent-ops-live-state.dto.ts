export type AgentOpsLiveRealState =
  | "offline"
  | "idle"
  | "queued"
  | "working"
  | "thinking"
  | "tooling"
  | "waiting_for_approval"
  | "error"
  | "completed"
  | "cancelled";

export type AgentOpsLiveConfidence = "strong" | "medium" | "weak";

export type AgentOpsLiveSource =
  | "runtime_dispatch"
  | "runtime_tool"
  | "runtime_thinking"
  | "task"
  | "approval"
  | "health"
  | "message"
  | "agent_status"
  | "none";

export interface AgentOpsLiveAgentStateDto {
  agentId: string;
  realState: AgentOpsLiveRealState;
  confidence: AgentOpsLiveConfidence;
  source: AgentOpsLiveSource;
  reason: string;
  updatedAt: string;
  expiresAt?: string | null;
  threadId?: string | null;
  threadSessionId?: string | null;
  dispatchId?: string | null;
  taskId?: string | null;
  approvalId?: string | null;
  messageId?: string | null;
  runtimeType?: string | null;
  healthStatus?: string | null;
  toolName?: string | null;
  toolPhase?: "started" | "updated" | "completed" | null;
  appId?: string | null;
  workflowId?: string | null;
  departmentId?: string | null;
  roomId?: string | null;
  contextText?: string | null;
}

export interface AgentOpsLiveStateSnapshotDto {
  workspaceId: string;
  generatedAt: string;
  agents: AgentOpsLiveAgentStateDto[];
}
