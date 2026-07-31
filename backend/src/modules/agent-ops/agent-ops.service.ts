import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThanOrEqual, Repository } from "typeorm";
import {
  AgentEntity,
  ApprovalEntity,
  MessageEntity,
  RuntimeBindingEntity,
  RuntimeDispatchEntity,
  RuntimeThreadSessionEntity,
  TaskEntity,
  ThreadEntity,
} from "../../entities";
import { RuntimeDispatchService } from "../runtime/runtime-dispatch.service";
import {
  AgentOpsLiveAgentStateDto,
  AgentOpsLiveStateSnapshotDto,
} from "./dto/agent-ops-live-state.dto";
import {
  AgentOpsRuntimeFailureBucketDto,
  AgentOpsRuntimeOverviewBindingDto,
  AgentOpsRuntimeOverviewDispatchDto,
  AgentOpsRuntimeOverviewSessionDto,
  AgentOpsRuntimeOverviewSnapshotDto,
} from "./dto/agent-ops-runtime-overview.dto";

const TERMINAL_GRACE_MS = 15 * 60 * 1000;
const MESSAGE_GRACE_MS = 24 * 60 * 60 * 1000;
const TOOL_GRACE_MS = 30 * 1000;
const THINKING_GRACE_MS = 30 * 1000;
const DEFAULT_RUNTIME_OVERVIEW_DISPATCH_LIMIT = 50;
const DEFAULT_RUNTIME_OVERVIEW_SESSION_LIMIT = 50;
const DEFAULT_RUNTIME_OVERVIEW_WINDOW_HOURS = 24;
const MAX_RUNTIME_OVERVIEW_DISPATCH_LIMIT = 200;
const MAX_RUNTIME_OVERVIEW_SESSION_LIMIT = 200;
const MAX_RUNTIME_OVERVIEW_WINDOW_HOURS = 168;
const SUMMARY_DISPATCH_LIMIT = 1000;
const ACTIVE_DISPATCH_STATUSES = new Set(["queued", "started"]);
const TERMINAL_DISPATCH_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
]);
const HEALTHY_BINDING_STATUSES = new Set([
  "ready",
  "healthy",
  "online",
  "available",
  "ok",
]);

type RuntimeMetadata = Record<string, unknown>;

@Injectable()
export class AgentOpsService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(RuntimeBindingEntity)
    private readonly runtimeBindingRepo: Repository<RuntimeBindingEntity>,
    @InjectRepository(RuntimeThreadSessionEntity)
    private readonly runtimeThreadSessionRepo: Repository<RuntimeThreadSessionEntity>,
    @InjectRepository(RuntimeDispatchEntity)
    private readonly runtimeDispatchRepo: Repository<RuntimeDispatchEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(ApprovalEntity)
    private readonly approvalRepo: Repository<ApprovalEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,
    private readonly runtimeDispatchService: RuntimeDispatchService,
  ) {}

  async resolveRuntimeOverview(input: {
    workspaceId: string;
    dispatchLimit?: number;
    sessionLimit?: number;
    windowHours?: number;
  }): Promise<AgentOpsRuntimeOverviewSnapshotDto> {
    const generatedAt = new Date().toISOString();
    const dispatchLimit = clampPositiveInteger(
      input.dispatchLimit,
      DEFAULT_RUNTIME_OVERVIEW_DISPATCH_LIMIT,
      MAX_RUNTIME_OVERVIEW_DISPATCH_LIMIT,
    );
    const sessionLimit = clampPositiveInteger(
      input.sessionLimit,
      DEFAULT_RUNTIME_OVERVIEW_SESSION_LIMIT,
      MAX_RUNTIME_OVERVIEW_SESSION_LIMIT,
    );
    const windowHours = clampPositiveInteger(
      input.windowHours,
      DEFAULT_RUNTIME_OVERVIEW_WINDOW_HOURS,
      MAX_RUNTIME_OVERVIEW_WINDOW_HOURS,
    );
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const [
      agents,
      bindings,
      activeSessions,
      recentDispatches,
      summaryDispatches,
    ] = await Promise.all([
      this.agentRepo.find({
        where: { workspaceId: input.workspaceId } as any,
        order: { name: "ASC" },
      }),
      this.runtimeBindingRepo.find({
        where: { workspaceId: input.workspaceId },
        order: { runtimeType: "ASC", updatedAt: "DESC" },
      }),
      this.runtimeThreadSessionRepo.find({
        where: { workspaceId: input.workspaceId, status: "active" },
        order: { lastActivityAt: "DESC" },
        take: sessionLimit,
      }),
      this.runtimeDispatchRepo.find({
        where: { workspaceId: input.workspaceId },
        order: { updatedAt: "DESC", createdAt: "DESC" },
        take: dispatchLimit,
      }),
      this.runtimeDispatchRepo.find({
        where: {
          workspaceId: input.workspaceId,
          updatedAt: MoreThanOrEqual(cutoff),
        },
        order: { updatedAt: "DESC", createdAt: "DESC" },
        take: SUMMARY_DISPATCH_LIMIT,
      }),
    ]);

    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const bindingById = new Map(bindings.map((binding) => [binding.id, binding]));
    const threadIds = Array.from(
      new Set(
        [
          ...activeSessions.map((session) => session.threadId),
          ...recentDispatches.map((dispatch) => dispatch.threadId),
          ...summaryDispatches.map((dispatch) => dispatch.threadId),
        ].filter(Boolean),
      ),
    );
    const threads = threadIds.length
      ? await this.threadRepo.find({
          where: { workspaceId: input.workspaceId, id: In(threadIds) } as any,
        })
      : [];
    const threadById = new Map(threads.map((thread) => [thread.id, thread]));

    const bindingDtos = bindings.map((binding) =>
      this.toRuntimeBindingDto(binding, agentById),
    );
    const sessionDtos = activeSessions.map((session) =>
      this.toRuntimeSessionDto(session, {
        bindingById,
        agentById,
        threadById,
      }),
    );
    const dispatchDtos = recentDispatches.map((dispatch) =>
      this.toRuntimeDispatchDto(dispatch, {
        bindingById,
        agentById,
        threadById,
      }),
    );

    return {
      workspaceId: input.workspaceId,
      generatedAt,
      windowHours,
      limits: {
        dispatches: dispatchLimit,
        sessions: sessionLimit,
        summaryDispatches: SUMMARY_DISPATCH_LIMIT,
      },
      bindings: bindingDtos,
      activeSessions: sessionDtos,
      recentDispatches: dispatchDtos,
      summaries: {
        runtimeTypes: buildRuntimeTypeSummaries({
          bindings,
          activeSessions,
          summaryDispatches,
          bindingById,
        }),
        health: buildHealthSummaries(bindings),
        terminalStates: buildTerminalStateSummaries({
          summaryDispatches,
          bindingById,
        }),
        failureBuckets: buildFailureBuckets({
          summaryDispatches,
          bindingById,
        }),
      },
    };
  }

  async resolveLiveStateSnapshot(input: {
    workspaceId: string;
    agentIds: string[];
  }): Promise<AgentOpsLiveStateSnapshotDto> {
    const agentIds = Array.from(new Set(input.agentIds.filter(Boolean)));
    const generatedAt = new Date().toISOString();
    if (!agentIds.length) {
      return { workspaceId: input.workspaceId, generatedAt, agents: [] };
    }

    const [agents, bindings, dispatches, tasks, approvals, messages, threads] =
      await Promise.all([
        this.agentRepo.find({
          where: { workspaceId: input.workspaceId, id: In(agentIds) } as any,
        }),
        this.runtimeBindingRepo.find({
          where: { workspaceId: input.workspaceId, agentId: In(agentIds) },
        }),
        this.runtimeDispatchService.findAgentOpsLiveDispatches({
          workspaceId: input.workspaceId,
          agentIds,
          recentTerminalWindowMs: TERMINAL_GRACE_MS,
        }),
        this.taskRepo.find({
          where: {
            workspaceId: input.workspaceId,
            assignedAgentId: In(agentIds),
          },
          order: { updatedAt: "DESC" },
          take: 200,
        }),
        this.approvalRepo.find({
          where: {
            workspaceId: input.workspaceId,
            requestedByAgentId: In(agentIds),
            status: "pending",
          },
          order: { updatedAt: "DESC" },
          take: 100,
        }),
        this.messageRepo.find({
          where: { senderId: In(agentIds) },
          order: { createdAt: "DESC" },
          take: 100,
        }),
        this.threadRepo.find({
          where: { workspaceId: input.workspaceId },
          order: { updatedAt: "DESC" },
          take: 300,
        }),
      ]);

    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const bindingByAgentId = new Map(
      bindings.map((binding) => [binding.agentId, binding]),
    );
    const dispatchesByAgentId = groupBy(
      dispatches,
      (dispatch) => dispatch.agentId,
    );
    const tasksByAgentId = groupBy(tasks, (task) => task.assignedAgentId ?? "");
    const approvalsByAgentId = groupBy(
      approvals,
      (approval) => approval.requestedByAgentId,
    );
    const messagesByAgentId = groupBy(messages, (message) => message.senderId);
    const threadById = new Map(threads.map((thread) => [thread.id, thread]));

    return {
      workspaceId: input.workspaceId,
      generatedAt,
      agents: agentIds.flatMap((agentId) => {
        const agent = agentById.get(agentId);
        if (!agent) return [];
        return [
          this.resolveAgentState({
            agent,
            binding: bindingByAgentId.get(agentId) ?? null,
            dispatches: dispatchesByAgentId.get(agentId) ?? [],
            tasks: tasksByAgentId.get(agentId) ?? [],
            approvals: approvalsByAgentId.get(agentId) ?? [],
            messages: messagesByAgentId.get(agentId) ?? [],
            threadById,
            now: new Date(generatedAt),
          }),
        ];
      }),
    };
  }

  private resolveAgentState(input: {
    agent: AgentEntity;
    binding: RuntimeBindingEntity | null;
    dispatches: RuntimeDispatchEntity[];
    tasks: TaskEntity[];
    approvals: ApprovalEntity[];
    messages: MessageEntity[];
    threadById: Map<string, ThreadEntity>;
    now: Date;
  }): AgentOpsLiveAgentStateDto {
    const offline = this.offlineState(input);
    const dispatchState = this.dispatchState(input);
    if (dispatchState && dispatchState.realState !== "completed") {
      return dispatchState;
    }

    const approval = input.approvals[0];
    if (approval) {
      return {
        agentId: input.agent.id,
        realState: "waiting_for_approval",
        confidence: "strong",
        source: "approval",
        reason: approval.title || "Pending approval",
        updatedAt: approval.updatedAt.toISOString(),
        approvalId: approval.id,
        taskId: approval.taskId ?? null,
        departmentId: input.agent.departmentId ?? null,
      };
    }

    const taskState = this.taskState(input);
    if (taskState) return taskState;
    if (dispatchState) return dispatchState;

    if (offline) return offline;

    const messageState = this.messageState(input);
    if (messageState) return messageState;

    return {
      agentId: input.agent.id,
      realState: "idle",
      confidence: "strong",
      source: "none",
      reason: "No active dispatch, task, approval, or agent-authored message.",
      updatedAt: input.now.toISOString(),
      runtimeType: input.binding?.runtimeType ?? null,
      healthStatus: input.binding?.healthStatus ?? null,
      departmentId: input.agent.departmentId ?? null,
    };
  }

  private offlineState(input: {
    agent: AgentEntity;
    binding: RuntimeBindingEntity | null;
    now: Date;
  }): AgentOpsLiveAgentStateDto | null {
    if (input.agent.status === "off_duty") {
      return {
        agentId: input.agent.id,
        realState: "offline",
        confidence: "strong",
        source: "agent_status",
        reason: "Agent is off duty.",
        updatedAt: input.agent.updatedAt.toISOString(),
        runtimeType: input.binding?.runtimeType ?? null,
        healthStatus: input.binding?.healthStatus ?? null,
        departmentId: input.agent.departmentId ?? null,
      };
    }
    if (input.binding && !input.binding.isEnabled) {
      return {
        agentId: input.agent.id,
        realState: "offline",
        confidence: "strong",
        source: "health",
        reason: "Runtime binding is disabled.",
        updatedAt: input.binding.updatedAt.toISOString(),
        runtimeType: input.binding.runtimeType,
        healthStatus: input.binding.healthStatus,
        departmentId: input.agent.departmentId ?? null,
      };
    }
    const health = input.binding?.healthStatus?.toLowerCase();
    if (health && ["offline", "unavailable", "error"].includes(health)) {
      return {
        agentId: input.agent.id,
        realState: health === "error" ? "error" : "offline",
        confidence: "medium",
        source: "health",
        reason: `Runtime health is ${input.binding?.healthStatus}.`,
        updatedAt:
          input.binding?.lastHealthCheckAt?.toISOString() ??
          input.binding?.updatedAt.toISOString() ??
          input.now.toISOString(),
        runtimeType: input.binding?.runtimeType ?? null,
        healthStatus: input.binding?.healthStatus ?? null,
        departmentId: input.agent.departmentId ?? null,
      };
    }
    return null;
  }

  private dispatchState(input: {
    agent: AgentEntity;
    binding: RuntimeBindingEntity | null;
    dispatches: RuntimeDispatchEntity[];
    threadById: Map<string, ThreadEntity>;
    now: Date;
  }): AgentOpsLiveAgentStateDto | null {
    const dispatch =
      input.dispatches.find((entry) =>
        ["queued", "started"].includes(entry.status),
      ) ?? input.dispatches[0];
    if (!dispatch) return null;
    const metadata = dispatch.resultMetadata ?? {};
    const thread = input.threadById.get(dispatch.threadId);
    const base = {
      agentId: input.agent.id,
      updatedAt: (
        dispatch.completedAt ??
        dispatch.startedAt ??
        dispatch.updatedAt
      ).toISOString(),
      threadId: dispatch.threadId,
      threadSessionId: dispatch.threadSessionId,
      dispatchId: dispatch.id,
      runtimeType: input.binding?.runtimeType ?? null,
      healthStatus: input.binding?.healthStatus ?? null,
      departmentId: thread?.departmentId ?? input.agent.departmentId ?? null,
      contextText: [dispatch.resultSummary, dispatch.errorMessage]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500),
    };

    if (dispatch.status === "queued") {
      return {
        ...base,
        realState: "queued",
        confidence: "strong",
        source: "runtime_dispatch",
        reason: "Runtime dispatch is queued.",
      };
    }

    if (dispatch.status === "started") {
      const tool = readLatestTool(metadata);
      if (
        tool &&
        tool.phase !== "completed" &&
        isFresh(tool.timestamp, input.now, TOOL_GRACE_MS)
      ) {
        return {
          ...base,
          realState: "tooling",
          confidence: "strong",
          source: "runtime_tool",
          reason: tool.summary || `Using ${tool.toolName}.`,
          updatedAt: tool.timestamp,
          toolName: tool.toolName,
          toolPhase: tool.phase,
        };
      }
      const thinking = readLatestThinking(metadata);
      if (
        thinking &&
        isFresh(thinking.timestamp, input.now, THINKING_GRACE_MS)
      ) {
        return {
          ...base,
          realState: "thinking",
          confidence: "strong",
          source: "runtime_thinking",
          reason: "Runtime reported active thinking.",
          updatedAt: thinking.timestamp,
        };
      }
      return {
        ...base,
        realState: "working",
        confidence: "strong",
        source: "runtime_dispatch",
        reason: "Runtime dispatch is running.",
      };
    }

    if (dispatch.status === "failed") {
      return {
        ...base,
        realState: "error",
        confidence: "strong",
        source: "runtime_dispatch",
        reason: dispatch.errorMessage ?? "Runtime dispatch failed.",
      };
    }

    if (dispatch.status === "cancelled") {
      return {
        ...base,
        realState: "cancelled",
        confidence: "medium",
        source: "runtime_dispatch",
        reason: "Runtime dispatch was cancelled.",
        expiresAt: new Date(input.now.getTime() + 4200).toISOString(),
      };
    }

    if (dispatch.status === "completed") {
      return {
        ...base,
        realState: "completed",
        confidence: "medium",
        source: "runtime_dispatch",
        reason: "Runtime dispatch completed.",
        messageId: dispatch.postedMessageId ?? null,
        expiresAt: new Date(input.now.getTime() + 4200).toISOString(),
      };
    }

    return null;
  }

  private taskState(input: {
    agent: AgentEntity;
    tasks: TaskEntity[];
    now: Date;
  }): AgentOpsLiveAgentStateDto | null {
    const task = input.tasks.find((entry) =>
      ["running", "dispatched", "blocked", "failed", "cancelled"].includes(
        entry.status,
      ),
    );
    if (!task) return null;
    const base = {
      agentId: input.agent.id,
      taskId: task.id,
      threadId: task.threadId ?? null,
      approvalId: task.approvalId ?? null,
      updatedAt: task.updatedAt.toISOString(),
      departmentId: task.departmentId ?? input.agent.departmentId ?? null,
      contextText: [task.title, task.description].filter(Boolean).join(" "),
    };
    if (task.status === "blocked") {
      return {
        ...base,
        realState: "waiting_for_approval",
        confidence: "strong",
        source: "task",
        reason: task.title || "Task is blocked.",
      };
    }
    if (task.status === "failed") {
      return {
        ...base,
        realState: "error",
        confidence: "medium",
        source: "task",
        reason: task.lastError || task.title || "Task failed.",
      };
    }
    if (task.status === "cancelled") {
      return {
        ...base,
        realState: "cancelled",
        confidence: "medium",
        source: "task",
        reason: task.title || "Task cancelled.",
        expiresAt: new Date(input.now.getTime() + 4200).toISOString(),
      };
    }
    return {
      ...base,
      realState: "working",
      confidence: task.status === "running" ? "strong" : "medium",
      source: "task",
      reason: task.title || `Task ${task.status}.`,
    };
  }

  private messageState(input: {
    agent: AgentEntity;
    messages: MessageEntity[];
    now: Date;
  }): AgentOpsLiveAgentStateDto | null {
    const message = input.messages.find((entry) =>
      isFresh(entry.createdAt.toISOString(), input.now, MESSAGE_GRACE_MS),
    );
    if (!message) return null;
    return {
      agentId: input.agent.id,
      realState: "completed",
      confidence: "weak",
      source: "message",
      reason: "Agent posted a recent message.",
      updatedAt: message.createdAt.toISOString(),
      expiresAt: new Date(input.now.getTime() + 4200).toISOString(),
      threadId: message.threadId,
      threadSessionId: message.threadSessionId,
      messageId: message.id,
      departmentId: input.agent.departmentId ?? null,
      contextText: message.content.slice(0, 500),
    };
  }

  private toRuntimeBindingDto(
    binding: RuntimeBindingEntity,
    agentById: Map<string, AgentEntity>,
  ): AgentOpsRuntimeOverviewBindingDto {
    const capabilities = binding.capabilities ?? {};
    return {
      id: binding.id,
      workspaceId: binding.workspaceId,
      agentId: binding.agentId,
      agentName: agentById.get(binding.agentId)?.name ?? null,
      runtimeType: binding.runtimeType,
      adapterKind: binding.adapterKind,
      routingMode: binding.routingMode,
      workspaceRoot: binding.workspaceRoot ?? null,
      repoKey: binding.repoKey ?? null,
      isEnabled: binding.isEnabled,
      healthStatus: binding.healthStatus,
      lastHealthCheckAt: toIsoOrNull(binding.lastHealthCheckAt),
      lastErrorCode: binding.lastErrorCode ?? null,
      lastErrorMessage: sanitizeOperatorText(binding.lastErrorMessage),
      capabilities,
      capabilityKeys: Object.keys(capabilities).sort(),
      createdAt: toIso(binding.createdAt),
      updatedAt: toIso(binding.updatedAt),
    };
  }

  private toRuntimeSessionDto(
    session: RuntimeThreadSessionEntity,
    context: {
      bindingById: Map<string, RuntimeBindingEntity>;
      agentById: Map<string, AgentEntity>;
      threadById: Map<string, ThreadEntity>;
    },
  ): AgentOpsRuntimeOverviewSessionDto {
    const binding = context.bindingById.get(session.runtimeBindingId);
    return {
      id: session.id,
      workspaceId: session.workspaceId,
      threadId: session.threadId,
      threadTitle: context.threadById.get(session.threadId)?.title ?? null,
      threadSessionId: session.threadSessionId,
      agentId: session.agentId,
      agentName: context.agentById.get(session.agentId)?.name ?? null,
      runtimeBindingId: session.runtimeBindingId,
      runtimeType: binding?.runtimeType ?? null,
      runtimeSessionId: session.runtimeSessionId,
      status: session.status,
      lastDispatchedMessageId: session.lastDispatchedMessageId ?? null,
      lastRunStartedAt: toIsoOrNull(session.lastRunStartedAt),
      lastRunFinishedAt: toIsoOrNull(session.lastRunFinishedAt),
      lastErrorCode: session.lastErrorCode ?? null,
      lastErrorMessage: sanitizeOperatorText(session.lastErrorMessage),
      lastActivityAt: toIso(session.lastActivityAt),
      closedAt: toIsoOrNull(session.closedAt),
      createdAt: toIso(session.createdAt),
      updatedAt: toIso(session.updatedAt),
    };
  }

  private toRuntimeDispatchDto(
    dispatch: RuntimeDispatchEntity,
    context: {
      bindingById: Map<string, RuntimeBindingEntity>;
      agentById: Map<string, AgentEntity>;
      threadById: Map<string, ThreadEntity>;
    },
  ): AgentOpsRuntimeOverviewDispatchDto {
    const binding = context.bindingById.get(dispatch.runtimeBindingId);
    const runtimeType = binding?.runtimeType ?? null;
    const metadata = dispatch.resultMetadata ?? {};
    const latestStatus = readLatestStatus(metadata);
    const latestTool = readLatestTool(metadata);
    const contextUsage = readContextUsage(metadata);
    const errorCode = normalizeErrorCode(dispatch.errorCode);
    return {
      id: dispatch.id,
      workspaceId: dispatch.workspaceId,
      threadId: dispatch.threadId,
      threadTitle: context.threadById.get(dispatch.threadId)?.title ?? null,
      threadSessionId: dispatch.threadSessionId,
      messageId: dispatch.messageId,
      agentId: dispatch.agentId,
      agentName: context.agentById.get(dispatch.agentId)?.name ?? null,
      runtimeBindingId: dispatch.runtimeBindingId,
      runtimeThreadSessionId: dispatch.runtimeThreadSessionId,
      runtimeType,
      status: dispatch.status,
      attemptNumber: dispatch.attemptNumber,
      startedAt: toIsoOrNull(dispatch.startedAt),
      completedAt: toIsoOrNull(dispatch.completedAt),
      timeoutAt: toIsoOrNull(dispatch.timeoutAt),
      postedMessageId: dispatch.postedMessageId ?? null,
      runtimeRunId: dispatch.runtimeRunId ?? null,
      errorCode: dispatch.errorCode ?? null,
      errorMessage: sanitizeOperatorText(dispatch.errorMessage),
      failureBucket:
        dispatch.status === "failed"
          ? `${runtimeType ?? "unknown"}:${errorCode}`
          : null,
      resultSummary: sanitizeOperatorText(dispatch.resultSummary, 300),
      latestStatusCode: latestStatus?.code ?? null,
      latestToolName: latestTool?.toolName ?? null,
      latestToolPhase: latestTool?.phase ?? null,
      contextUsageLevel: contextUsage?.level ?? null,
      contextPercentUsed: contextUsage?.percentUsed ?? null,
      correlationId: dispatch.correlationId ?? null,
      createdAt: toIso(dispatch.createdAt),
      updatedAt: toIso(dispatch.updatedAt),
    };
  }
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Map<string, T[]>>((map, item) => {
    const value = key(item);
    if (!value) return map;
    map.set(value, [...(map.get(value) ?? []), item]);
    return map;
  }, new Map());
}

function isFresh(timestamp: string, now: Date, windowMs: number) {
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) && now.getTime() - value <= windowMs;
}

function readLatestTool(metadata: RuntimeMetadata) {
  const tool = metadata.latestTool;
  if (!tool || typeof tool !== "object") return null;
  const record = tool as Record<string, unknown>;
  if (
    typeof record.toolName !== "string" ||
    typeof record.timestamp !== "string" ||
    !["started", "updated", "completed"].includes(String(record.phase))
  ) {
    return null;
  }
  return {
    toolName: record.toolName,
    phase: record.phase as "started" | "updated" | "completed",
    summary: typeof record.summary === "string" ? record.summary : undefined,
    timestamp: record.timestamp,
  };
}

function readLatestThinking(metadata: RuntimeMetadata) {
  const thinking = metadata.latestThinking;
  if (!thinking || typeof thinking !== "object") return null;
  const record = thinking as Record<string, unknown>;
  if (typeof record.timestamp !== "string") return null;
  return { timestamp: record.timestamp };
}

function readLatestStatus(metadata: RuntimeMetadata) {
  const status = metadata.latestStatus;
  if (!status || typeof status !== "object") return null;
  const record = status as Record<string, unknown>;
  if (typeof record.code !== "string") return null;
  return { code: record.code };
}

function readContextUsage(metadata: RuntimeMetadata) {
  const usage = metadata.runtimeContextUsage;
  if (!usage || typeof usage !== "object") return null;
  const record = usage as Record<string, unknown>;
  return {
    level: typeof record.level === "string" ? record.level : null,
    percentUsed:
      typeof record.percentUsed === "number" ? record.percentUsed : null,
  };
}

function buildRuntimeTypeSummaries(input: {
  bindings: RuntimeBindingEntity[];
  activeSessions: RuntimeThreadSessionEntity[];
  summaryDispatches: RuntimeDispatchEntity[];
  bindingById: Map<string, RuntimeBindingEntity>;
}) {
  const runtimeTypes = new Set<string>();
  input.bindings.forEach((binding) => runtimeTypes.add(binding.runtimeType));
  input.activeSessions.forEach((session) =>
    runtimeTypes.add(runtimeTypeForBinding(input.bindingById, session.runtimeBindingId)),
  );
  input.summaryDispatches.forEach((dispatch) =>
    runtimeTypes.add(runtimeTypeForBinding(input.bindingById, dispatch.runtimeBindingId)),
  );

  return Array.from(runtimeTypes)
    .filter(Boolean)
    .sort()
    .map((runtimeType) => {
      const bindings = input.bindings.filter(
        (binding) => binding.runtimeType === runtimeType,
      );
      const enabledBindings = bindings.filter((binding) => binding.isEnabled);
      const healthyBindings = enabledBindings.filter((binding) =>
        HEALTHY_BINDING_STATUSES.has(
          normalizeStatus(binding.healthStatus),
        ),
      );
      const sessions = input.activeSessions.filter(
        (session) =>
          runtimeTypeForBinding(input.bindingById, session.runtimeBindingId) ===
          runtimeType,
      );
      const dispatches = input.summaryDispatches.filter(
        (dispatch) =>
          runtimeTypeForBinding(input.bindingById, dispatch.runtimeBindingId) ===
          runtimeType,
      );

      return {
        runtimeType,
        bindingCount: bindings.length,
        enabledBindingCount: enabledBindings.length,
        healthyBindingCount: healthyBindings.length,
        unhealthyBindingCount: Math.max(
          enabledBindings.length - healthyBindings.length,
          0,
        ),
        activeSessionCount: sessions.length,
        activeDispatchCount: dispatches.filter((dispatch) =>
          ACTIVE_DISPATCH_STATUSES.has(dispatch.status),
        ).length,
        terminalDispatchCount: dispatches.filter((dispatch) =>
          TERMINAL_DISPATCH_STATUSES.has(dispatch.status),
        ).length,
        failedDispatchCount: dispatches.filter(
          (dispatch) => dispatch.status === "failed",
        ).length,
      };
    });
}

function buildHealthSummaries(bindings: RuntimeBindingEntity[]) {
  return countBy(
    bindings,
    (binding) => normalizeStatus(binding.healthStatus) || "unknown",
  ).map(([status, count]) => ({ status, count }));
}

function buildTerminalStateSummaries(input: {
  summaryDispatches: RuntimeDispatchEntity[];
  bindingById: Map<string, RuntimeBindingEntity>;
}) {
  return countBy(
    input.summaryDispatches.filter((dispatch) =>
      TERMINAL_DISPATCH_STATUSES.has(dispatch.status),
    ),
    (dispatch) =>
      `${runtimeTypeForBinding(input.bindingById, dispatch.runtimeBindingId)}:${dispatch.status}`,
  ).map(([key, count]) => {
    const [runtimeType, status] = key.split(":");
    return { runtimeType, status, count };
  });
}

function buildFailureBuckets(input: {
  summaryDispatches: RuntimeDispatchEntity[];
  bindingById: Map<string, RuntimeBindingEntity>;
}): AgentOpsRuntimeFailureBucketDto[] {
  const buckets = new Map<string, RuntimeDispatchEntity[]>();
  for (const dispatch of input.summaryDispatches) {
    if (dispatch.status !== "failed") continue;
    const runtimeType = runtimeTypeForBinding(
      input.bindingById,
      dispatch.runtimeBindingId,
    );
    const errorCode = normalizeErrorCode(dispatch.errorCode);
    const key = `${runtimeType}:${errorCode}`;
    buckets.set(key, [...(buckets.get(key) ?? []), dispatch]);
  }

  return Array.from(buckets.entries())
    .map(([key, dispatches]) => {
      const [runtimeType, errorCode] = key.split(":");
      const latest = [...dispatches].sort(
        (left, right) =>
          dateMs(right.updatedAt) - dateMs(left.updatedAt) ||
          dateMs(right.createdAt) - dateMs(left.createdAt),
      )[0];
      return {
        runtimeType,
        errorCode,
        count: dispatches.length,
        latestAt: toIso(latest.updatedAt),
        sampleDispatchId: latest.id,
        sampleAgentId: latest.agentId,
        sampleThreadId: latest.threadId,
        sampleMessage: sanitizeOperatorText(latest.errorMessage),
      };
    })
    .sort(
      (left, right) =>
        right.count - left.count || right.latestAt.localeCompare(left.latestAt),
    );
}

function countBy<T>(items: T[], key: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((left, right) =>
    left[0].localeCompare(right[0]),
  );
}

function runtimeTypeForBinding(
  bindingById: Map<string, RuntimeBindingEntity>,
  runtimeBindingId: string,
) {
  return bindingById.get(runtimeBindingId)?.runtimeType ?? "unknown";
}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeErrorCode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || "unknown_error";
}

function clampPositiveInteger(
  value: number | null | undefined,
  fallback: number,
  max: number,
) {
  if (!Number.isFinite(value) || !value || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

function toIso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function dateMs(value: Date | string | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function sanitizeOperatorText(
  value: string | null | undefined,
  maxLength = 240,
) {
  if (!value) return null;
  const redacted = value
    .replace(/bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "bearer [redacted]")
    .replace(
      /(authorization\s*[:=]\s*)(?:bearer\s*)?[^\s,;]+/gi,
      "$1[redacted]",
    )
    .replace(
      /((?:api[_-]?key|token|password|secret|authorization)\s*[:=]\s*)[^\s,;&]+/gi,
      "$1[redacted]",
    )
    .replace(/(https?:\/\/)([^/@\s]+)@/gi, "$1[redacted]@")
    .replace(
      /([?&](?:api[_-]?key|token|password|secret|authorization)=)[^&\s]+/gi,
      "$1[redacted]",
    )
    .trim();
  return redacted.length > maxLength
    ? `${redacted.slice(0, Math.max(maxLength - 3, 0))}...`
    : redacted;
}
