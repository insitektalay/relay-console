export interface AgentOpsRuntimeOverviewBindingDto {
  id: string;
  workspaceId: string;
  agentId: string;
  agentName: string | null;
  runtimeType: string;
  adapterKind: string;
  routingMode: string;
  workspaceRoot: string | null;
  repoKey: string | null;
  isEnabled: boolean;
  healthStatus: string;
  lastHealthCheckAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  capabilities: Record<string, unknown>;
  capabilityKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentOpsRuntimeOverviewSessionDto {
  id: string;
  workspaceId: string;
  threadId: string;
  threadTitle: string | null;
  threadSessionId: string;
  agentId: string;
  agentName: string | null;
  runtimeBindingId: string;
  runtimeType: string | null;
  runtimeSessionId: string;
  status: string;
  lastDispatchedMessageId: string | null;
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastActivityAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentOpsRuntimeOverviewDispatchDto {
  id: string;
  workspaceId: string;
  threadId: string;
  threadTitle: string | null;
  threadSessionId: string;
  messageId: string;
  agentId: string;
  agentName: string | null;
  runtimeBindingId: string;
  runtimeThreadSessionId: string;
  runtimeType: string | null;
  status: string;
  attemptNumber: number;
  startedAt: string | null;
  completedAt: string | null;
  timeoutAt: string | null;
  postedMessageId: string | null;
  runtimeRunId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  failureBucket: string | null;
  resultSummary: string | null;
  latestStatusCode: string | null;
  latestToolName: string | null;
  latestToolPhase: string | null;
  contextUsageLevel: string | null;
  contextPercentUsed: number | null;
  correlationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentOpsRuntimeTypeSummaryDto {
  runtimeType: string;
  bindingCount: number;
  enabledBindingCount: number;
  healthyBindingCount: number;
  unhealthyBindingCount: number;
  activeSessionCount: number;
  activeDispatchCount: number;
  terminalDispatchCount: number;
  failedDispatchCount: number;
}

export interface AgentOpsRuntimeHealthSummaryDto {
  status: string;
  count: number;
}

export interface AgentOpsRuntimeTerminalStateSummaryDto {
  runtimeType: string;
  status: string;
  count: number;
}

export interface AgentOpsRuntimeFailureBucketDto {
  runtimeType: string;
  errorCode: string;
  count: number;
  latestAt: string;
  sampleDispatchId: string;
  sampleAgentId: string;
  sampleThreadId: string;
  sampleMessage: string | null;
}

export interface AgentOpsRuntimeOverviewSnapshotDto {
  workspaceId: string;
  generatedAt: string;
  windowHours: number;
  limits: {
    dispatches: number;
    sessions: number;
    summaryDispatches: number;
  };
  bindings: AgentOpsRuntimeOverviewBindingDto[];
  activeSessions: AgentOpsRuntimeOverviewSessionDto[];
  recentDispatches: AgentOpsRuntimeOverviewDispatchDto[];
  summaries: {
    runtimeTypes: AgentOpsRuntimeTypeSummaryDto[];
    health: AgentOpsRuntimeHealthSummaryDto[];
    terminalStates: AgentOpsRuntimeTerminalStateSummaryDto[];
    failureBuckets: AgentOpsRuntimeFailureBucketDto[];
  };
}
