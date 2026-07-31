import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHash } from "node:crypto";
import {
  AgentEntity,
  RelayExecutionOwnerLeaseEntity,
  RuntimeHostEntity,
} from "../../entities";
import { assertManagedCloudLaunchEnabled } from "../../config/managed-cloud-launch.policy";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";
import { RuntimeDispatchEntity } from "../../entities/runtime-dispatch.entity";
import { RuntimeThreadSessionEntity } from "../../entities/runtime-thread-session.entity";
import { RuntimeAdapterRegistry } from "./runtime-adapter-registry.service";
import { RuntimeBindingService } from "./runtime-binding.service";
import { RuntimeDispatchService } from "./runtime-dispatch.service";
import { RuntimeEventService } from "./runtime-event.service";
import { RuntimeThreadSessionService } from "./runtime-thread-session.service";
import {
  RuntimeContextReference,
  RuntimeDispatchContext,
  RuntimeEvent,
  RuntimeTodoTask,
} from "./runtime.types";

export interface QueueRuntimeDispatchInput {
  workspaceId: string;
  threadId: string;
  threadSessionId: string;
  messageId: string;
  agentId: string;
  runtimeBinding: RuntimeBindingEntity;
  runtimeThreadSession: RuntimeThreadSessionEntity;
  timeoutAt?: Date | null;
  attemptNumber?: number;
  correlationId?: string | null;
}

export interface ExecuteRuntimeDispatchInput {
  runtimeBinding: RuntimeBindingEntity;
  runtimeThreadSession: RuntimeThreadSessionEntity;
  dispatch: RuntimeDispatchEntity;
  agent: AgentEntity;
  inputText: string;
  recentMessages: Array<Record<string, unknown>>;
  dispatchMetadata?: Record<string, unknown>;
  timeoutMs: number;
  persistFinalReply: (
    finalText: string,
    metadata?: Record<string, unknown>,
  ) => Promise<{ id: string }>;
  onSettled?: () => Promise<void> | void;
}

@Injectable()
export class RuntimeDispatchCoordinator {
  private readonly logger = new Logger(RuntimeDispatchCoordinator.name);
  private readonly bridgeDispatchTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly runtimeBindingService: RuntimeBindingService,
    private readonly runtimeDispatchService: RuntimeDispatchService,
    private readonly runtimeEventService: RuntimeEventService,
    private readonly runtimeThreadSessionService: RuntimeThreadSessionService,
    private readonly runtimeAdapterRegistry: RuntimeAdapterRegistry,
    @Optional()
    @InjectRepository(RelayExecutionOwnerLeaseEntity)
    private readonly executionOwnerLeases?: Repository<RelayExecutionOwnerLeaseEntity>,
    @Optional()
    @InjectRepository(AgentEntity)
    private readonly agents?: Repository<AgentEntity>,
    @Optional()
    @InjectRepository(RuntimeHostEntity)
    private readonly runtimeHosts?: Repository<RuntimeHostEntity>,
    @Optional()
    private readonly config?: ConfigService,
  ) {}

  async resolveEligibleBindings(
    agentIds: string[],
  ): Promise<RuntimeBindingEntity[]> {
    return this.runtimeBindingService.findEnabledByAgentIds(agentIds);
  }

  async queueDispatch(
    input: QueueRuntimeDispatchInput,
  ): Promise<RuntimeDispatchEntity> {
    await this.assertExecutionOwner(input);
    const dispatchKey = this.runtimeDispatchService.buildDispatchKey({
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      messageId: input.messageId,
      agentId: input.agentId,
    });

    const dispatch = await this.runtimeDispatchService.createQueuedDispatch({
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      messageId: input.messageId,
      agentId: input.agentId,
      runtimeBindingId: input.runtimeBinding.id,
      runtimeHostId: input.runtimeBinding.runtimeHostId ?? null,
      assignmentEpoch: input.runtimeBinding.assignmentEpoch ?? "1",
      runtimeThreadSessionId: input.runtimeThreadSession.id,
      dispatchKey,
      timeoutAt: input.timeoutAt ?? null,
      attemptNumber: input.attemptNumber,
      correlationId: input.correlationId ?? null,
    });

    await this.runtimeEventService.emitDispatchQueued({
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      dispatchId: dispatch.id,
      messageId: input.messageId,
      agentId: input.agentId,
      runtimeType: input.runtimeBinding.runtimeType,
      runtimeBindingId: input.runtimeBinding.id,
      runtimeHostId: dispatch.runtimeHostId,
      assignmentEpoch: dispatch.assignmentEpoch,
      runtimeThreadSessionId: input.runtimeThreadSession.id,
      timestamp: new Date().toISOString(),
    });

    return dispatch;
  }

  private async assertExecutionOwner(input: QueueRuntimeDispatchInput) {
    const agent = this.agents
      ? await this.agents.findOne({
          where: { id: input.agentId, workspaceId: input.workspaceId },
        })
      : null;
    if (agent?.lifecycleStatus && agent.lifecycleStatus !== "active") {
      throw new ConflictException("AGENT_LIFECYCLE_INELIGIBLE");
    }
    if (
      input.runtimeBinding.ownershipState &&
      input.runtimeBinding.ownershipState !== "unassigned" &&
      input.runtimeBinding.ownershipState !== "active"
    ) {
      throw new ConflictException("RUNTIME_EXECUTION_OWNER_UNAVAILABLE");
    }
    if (input.runtimeBinding.runtimeHostId && this.runtimeHosts) {
      const host = await this.runtimeHosts.findOne({
        where: {
          id: input.runtimeBinding.runtimeHostId,
          workspaceId: input.workspaceId,
        },
      });
      if (
        !host ||
        host.status !== "online" ||
        !host.lastSeenAt ||
        Date.now() - host.lastSeenAt.getTime() > 120_000
      ) {
        throw new ConflictException("RUNTIME_EXECUTION_HOST_OFFLINE");
      }
    }
    const ownerKind = input.runtimeBinding.configMetadata?.runtimeHostKind;
    this.assertManagedCloudBindingEnabled(input.runtimeBinding);
    const configuredDeviceId =
      input.runtimeBinding.configMetadata?.bridgeDeviceId;
    if (!this.executionOwnerLeases) {
      if (ownerKind === "relay_console_swift") {
        throw new ConflictException("RUNTIME_EXECUTION_OWNER_UNAVAILABLE");
      }
      return;
    }
    const lease = await this.executionOwnerLeases.findOne({
      where: { workspaceId: input.workspaceId, agentId: input.agentId },
    });
    if (!lease && ownerKind !== "relay_console_swift") return;
    if (
      !lease ||
      lease.state !== "active" ||
      lease.revokedAt ||
      lease.leaseExpiresAt <= new Date()
    ) {
      throw new ConflictException("RUNTIME_EXECUTION_OWNER_UNAVAILABLE");
    }
    if (configuredDeviceId && lease.bridgeDeviceId !== configuredDeviceId) {
      throw new ConflictException("RUNTIME_EXECUTION_OWNER_MISMATCH");
    }
    if (
      input.runtimeBinding.runtimeHostId &&
      lease.runtimeHostId !== input.runtimeBinding.runtimeHostId
    ) {
      throw new ConflictException("RUNTIME_EXECUTION_OWNER_MISMATCH");
    }
    if (
      String(lease.assignmentEpoch) !==
      String(input.runtimeBinding.assignmentEpoch)
    ) {
      throw new ConflictException("RUNTIME_ASSIGNMENT_EPOCH_STALE");
    }
  }

  async resolveRuntimeThreadSession(input: {
    runtimeBinding: RuntimeBindingEntity;
    threadId: string;
    threadSessionId: string;
    agentId: string;
  }): Promise<RuntimeThreadSessionEntity> {
    const adapter = this.runtimeAdapterRegistry.get(
      input.runtimeBinding.runtimeType as any,
    );
    return adapter.resolveSession({
      binding: input.runtimeBinding,
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      agentId: input.agentId,
    });
  }

  async executeDispatch(input: ExecuteRuntimeDispatchInput): Promise<void> {
    this.assertManagedCloudBindingEnabled(input.runtimeBinding);
    const adapter = this.runtimeAdapterRegistry.get(
      input.runtimeBinding.runtimeType as any,
    );

    const baseEventPayload = {
      workspaceId: input.dispatch.workspaceId,
      threadId: input.dispatch.threadId,
      threadSessionId: input.dispatch.threadSessionId,
      dispatchId: input.dispatch.id,
      messageId: input.dispatch.messageId,
      agentId: input.dispatch.agentId,
      runtimeType: input.runtimeBinding.runtimeType,
      runtimeBindingId: input.runtimeBinding.id,
      runtimeHostId: input.dispatch.runtimeHostId,
      assignmentEpoch: input.dispatch.assignmentEpoch,
      runtimeThreadSessionId: input.runtimeThreadSession.id,
      timestamp: new Date().toISOString(),
    };

    let terminal = false;
    let terminalEventInProgress = false;
    let started = false;
    let observedContextReferences: RuntimeContextReference[] = [];

    const markStarted = async (runtimeRunId?: string | null) => {
      if (started) return;
      started = true;
      await this.runtimeDispatchService.markStarted(
        input.dispatch.id,
        runtimeRunId ?? null,
      );
      await this.runtimeThreadSessionService.touch(
        input.runtimeThreadSession.id,
        {
          lastDispatchedMessageId: input.dispatch.messageId,
          lastRunStartedAt: new Date(),
        },
      );
      await this.runtimeEventService.emitDispatchStarted(baseEventPayload);
    };

    const sink = {
      emit: async (event: RuntimeEvent) => {
        switch (event.type) {
          case "dispatch.accepted":
            await markStarted(event.runtimeRunId ?? null);
            return;
          case "run.started":
            await markStarted(event.runtimeRunId ?? null);
            return;
          case "run.delta": {
            const timestamp = new Date().toISOString();
            await this.runtimeDispatchService.recordRunDelta(
              input.dispatch.id,
              {
                seq: event.seq,
                text: event.text,
                timestamp,
              },
            );
            await this.runtimeEventService.emitRunDelta({
              ...baseEventPayload,
              seq: event.seq,
              text: event.text,
              timestamp,
            });
            return;
          }
          case "run.thinking":
            await this.runtimeDispatchService.recordRunThinking(
              input.dispatch.id,
              {
                kind: event.kind,
                timestamp: baseEventPayload.timestamp,
              },
            );
            await this.runtimeEventService.emitRunThinking({
              ...baseEventPayload,
              seq: event.seq,
              thinking: event.thinking,
              kind: event.kind,
            });
            return;
          case "run.status":
            await this.runtimeDispatchService.recordRunStatus(
              input.dispatch.id,
              {
                code: event.code,
                message: event.message,
                timestamp: baseEventPayload.timestamp,
              },
            );
            await this.runtimeEventService.emitRunStatus({
              ...baseEventPayload,
              code: event.code,
              message: event.message,
            });
            return;
          case "run.tool":
            const tasks = this.normalizeRuntimeTodoTasks(
              event.toolName,
              event.tasks,
            );
            observedContextReferences = this.mergeRuntimeContextReferences(
              observedContextReferences,
              event.references,
            );
            await this.runtimeDispatchService.recordRunTool(input.dispatch.id, {
              toolName: event.toolName,
              phase: event.phase,
              summary: event.summary,
              tasks,
              timestamp: baseEventPayload.timestamp,
            });
            await this.runtimeEventService.emitRunTool({
              ...baseEventPayload,
              toolName: event.toolName,
              phase: event.phase,
              summary: event.summary,
              tasks,
            });
            return;
          case "run.context":
            observedContextReferences = this.mergeRuntimeContextReferences(
              observedContextReferences,
              event.references,
            );
            await this.runtimeDispatchService.recordContextUsage(
              input.dispatch.id,
              {
                ...baseEventPayload,
                totalTokens: event.totalTokens,
                contextTokens: event.contextTokens,
                percentUsed: event.percentUsed,
                level: event.level,
                fresh: event.fresh,
                sessionId: event.sessionId,
                model: event.model,
                modelProvider: event.modelProvider,
                references: observedContextReferences,
              },
            );
            await this.runtimeEventService.emitRunContext({
              ...baseEventPayload,
              totalTokens: event.totalTokens,
              contextTokens: event.contextTokens,
              percentUsed: event.percentUsed,
              level: event.level,
              fresh: event.fresh,
              sessionId: event.sessionId,
              model: event.model,
              modelProvider: event.modelProvider,
              references: observedContextReferences,
            });
            return;
          case "run.completed": {
            if (terminal) return;
            if (terminalEventInProgress) {
              throw new Error("runtime_terminal_event_in_progress");
            }
            terminalEventInProgress = true;
            try {
              this.clearBridgeDispatchTimeout(input.dispatch.id);
              await markStarted(null);
              const finalText =
                typeof event.finalText === "string" && event.finalText.trim()
                  ? event.finalText
                  : "(No response generated)";
              const finalMetadata = this.withDocumentReferences(
                event.metadata ?? {},
                observedContextReferences,
              );
              const posted = await input.persistFinalReply(
                finalText,
                finalMetadata,
              );
              await this.runtimeDispatchService.markCompleted(
                input.dispatch.id,
                {
                  postedMessageId: posted.id,
                  resultSummary: finalText.slice(0, 500),
                  resultMetadata: finalMetadata,
                },
              );
              terminal = true;
              await this.runtimeThreadSessionService.touch(
                input.runtimeThreadSession.id,
                {
                  lastDispatchedMessageId: input.dispatch.messageId,
                  lastRunFinishedAt: new Date(),
                  lastErrorCode: null,
                  lastErrorMessage: null,
                },
              );
              await this.runtimeEventService.emitDispatchCompleted({
                ...baseEventPayload,
                postedMessageId: posted.id,
                metadata: event.metadata ?? {},
              });
            } finally {
              if (!terminal) terminalEventInProgress = false;
            }
            return;
          }
          case "run.failed":
            if (terminal) return;
            if (terminalEventInProgress) {
              throw new Error("runtime_terminal_event_in_progress");
            }
            terminalEventInProgress = true;
            try {
              this.clearBridgeDispatchTimeout(input.dispatch.id);
              await markStarted(null);
              await this.runtimeDispatchService.markFailed(input.dispatch.id, {
                errorCode: event.code,
                errorMessage: event.message,
                resultMetadata: {
                  retryable: event.retryable,
                },
              });
              terminal = true;
              await this.runtimeThreadSessionService.markError(
                input.runtimeThreadSession.id,
                event.code,
                event.message,
              );
              await this.runtimeEventService.emitDispatchFailed({
                ...baseEventPayload,
                code: event.code,
                message: event.message,
                retryable: event.retryable,
              });
            } finally {
              if (!terminal) terminalEventInProgress = false;
            }
            return;
          case "run.cancelled":
            if (terminal) return;
            if (terminalEventInProgress) {
              throw new Error("runtime_terminal_event_in_progress");
            }
            terminalEventInProgress = true;
            try {
              this.clearBridgeDispatchTimeout(input.dispatch.id);
              await markStarted(null);
              await this.runtimeDispatchService.markCancelled(
                input.dispatch.id,
              );
              terminal = true;
              await this.runtimeThreadSessionService.touch(
                input.runtimeThreadSession.id,
                {
                  lastRunFinishedAt: new Date(),
                },
              );
              await this.runtimeEventService.emitDispatchCancelled(
                baseEventPayload,
              );
            } finally {
              if (!terminal) terminalEventInProgress = false;
            }
            return;
        }
      },
    };

    const dispatchContext: RuntimeDispatchContext = {
      dispatchId: input.dispatch.id,
      workspaceId: input.dispatch.workspaceId,
      threadId: input.dispatch.threadId,
      threadSessionId: input.dispatch.threadSessionId,
      messageId: input.dispatch.messageId,
      agentId: input.dispatch.agentId,
      runtimeBindingId: input.runtimeBinding.id,
      runtimeHostId: input.dispatch.runtimeHostId,
      assignmentEpoch: input.dispatch.assignmentEpoch,
      runtimeThreadSessionId: input.runtimeThreadSession.id,
      runtimeSessionId: input.runtimeThreadSession.runtimeSessionId,
      inputText: input.inputText,
      recentMessages: input.recentMessages,
      dispatchMetadata: input.dispatchMetadata,
      timeoutMs: input.timeoutMs,
      correlationId: input.dispatch.correlationId ?? input.dispatch.id,
    };

    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      await Promise.race([
        adapter.dispatchTurn(dispatchContext, sink),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => {
              reject(new Error("runtime_dispatch_timeout"));
            },
            Math.max(input.timeoutMs, 1),
          );
        }),
      ]);

      const completesViaCallback =
        !terminal &&
        started &&
        input.runtimeBinding.capabilities?.bridgeBacked === true;

      if (completesViaCallback) {
        this.scheduleBridgeDispatchTimeout(input.dispatch.id, input.timeoutMs);
      }

      if (!terminal && !completesViaCallback) {
        await sink.emit({
          type: "run.failed",
          dispatchId: input.dispatch.id,
          code: "runtime_no_terminal_event",
          message:
            "Runtime dispatch completed without a terminal event from the adapter",
          retryable: false,
        });
      }
    } catch (error) {
      const isTimeout =
        error instanceof Error && error.message === "runtime_dispatch_timeout";
      if (isTimeout) {
        try {
          await adapter.cancelDispatch({
            dispatchId: input.dispatch.id,
            runtimeSessionId: input.runtimeThreadSession.runtimeSessionId,
          });
        } catch (cancelError) {
          this.logger.warn(
            `Failed to cancel timed out runtime dispatch ${input.dispatch.id}: ${
              cancelError instanceof Error
                ? cancelError.message
                : String(cancelError)
            }`,
          );
        }
      }

      if (!terminal) {
        await sink.emit({
          type: "run.failed",
          dispatchId: input.dispatch.id,
          code: isTimeout ? "timeout" : "runtime_dispatch_error",
          message:
            error instanceof Error ? error.message : "Unknown runtime error",
          retryable: !isTimeout,
        });
      }
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      await input.onSettled?.();
    }
  }

  private assertManagedCloudBindingEnabled(binding: RuntimeBindingEntity) {
    if (binding.configMetadata?.runtimeHostKind === "relay_managed") {
      assertManagedCloudLaunchEnabled(this.config);
    }
  }

  async cancelDispatch(
    dispatchId: string,
  ): Promise<{ cancelled: boolean; dispatchId: string }> {
    const dispatch = await this.runtimeDispatchService.findById(dispatchId);
    if (!dispatch) {
      throw new NotFoundException(`Dispatch ${dispatchId} not found`);
    }

    if (["completed", "failed", "cancelled"].includes(dispatch.status)) {
      return { cancelled: false, dispatchId };
    }

    const binding = await this.runtimeBindingService.findById(
      dispatch.runtimeBindingId,
    );

    // Best-effort adapter signal for in-flight dispatches
    if (dispatch.status === "started" && binding) {
      const threadSession = await this.runtimeThreadSessionService.findById(
        dispatch.runtimeThreadSessionId,
      );
      if (threadSession) {
        try {
          const adapter = this.runtimeAdapterRegistry.get(
            binding.runtimeType as any,
          );
          await adapter.cancelDispatch({
            dispatchId: dispatch.id,
            runtimeSessionId: threadSession.runtimeSessionId,
          });
        } catch (err) {
          this.logger.warn(
            `Best-effort cancel signal failed for dispatch ${dispatchId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

    await this.runtimeDispatchService.markCancelled(dispatchId);
    this.clearBridgeDispatchTimeout(dispatchId);
    await this.runtimeEventService.emitDispatchCancelled({
      workspaceId: dispatch.workspaceId,
      threadId: dispatch.threadId,
      threadSessionId: dispatch.threadSessionId,
      dispatchId: dispatch.id,
      messageId: dispatch.messageId,
      agentId: dispatch.agentId,
      runtimeType: binding?.runtimeType ?? "openclaw",
      runtimeBindingId: dispatch.runtimeBindingId,
      runtimeThreadSessionId: dispatch.runtimeThreadSessionId,
      timestamp: new Date().toISOString(),
    });

    return { cancelled: true, dispatchId };
  }

  async failDispatchById(input: {
    dispatchId: string;
    code: string;
    message: string;
    retryable: boolean;
    failedAt?: Date;
  }): Promise<RuntimeDispatchEntity | null> {
    const dispatch = await this.runtimeDispatchService.findById(
      input.dispatchId,
    );
    if (!dispatch) {
      return null;
    }

    if (["completed", "failed", "cancelled"].includes(dispatch.status)) {
      return dispatch;
    }

    const binding = await this.runtimeBindingService.findById(
      dispatch.runtimeBindingId,
    );
    if (!binding) {
      return null;
    }

    const failedAt = input.failedAt ?? new Date();

    this.clearBridgeDispatchTimeout(dispatch.id);
    await this.runtimeDispatchService.markFailed(dispatch.id, {
      errorCode: input.code,
      errorMessage: input.message,
      resultMetadata: {
        retryable: input.retryable,
      },
      failedAt,
    });
    await this.runtimeThreadSessionService.markError(
      dispatch.runtimeThreadSessionId,
      input.code,
      input.message,
    );
    await this.runtimeThreadSessionService.touch(
      dispatch.runtimeThreadSessionId,
      {
        lastRunFinishedAt: failedAt,
        lastActivityAt: failedAt,
      },
    );
    await this.runtimeEventService.emitDispatchFailed({
      workspaceId: dispatch.workspaceId,
      threadId: dispatch.threadId,
      threadSessionId: dispatch.threadSessionId,
      dispatchId: dispatch.id,
      messageId: dispatch.messageId,
      agentId: dispatch.agentId,
      runtimeType: binding.runtimeType,
      runtimeBindingId: binding.id,
      runtimeThreadSessionId: dispatch.runtimeThreadSessionId,
      code: input.code,
      message: input.message,
      retryable: input.retryable,
      timestamp: failedAt.toISOString(),
    });

    return this.runtimeDispatchService.findById(dispatch.id);
  }

  async completeDispatchFromPostback(input: {
    dispatchId: string;
    postedMessageId: string;
    resultSummary?: string | null;
    resultMetadata?: Record<string, unknown>;
  }): Promise<RuntimeDispatchEntity | null> {
    const dispatch = await this.runtimeDispatchService.findById(
      input.dispatchId,
    );
    if (!dispatch) {
      return null;
    }

    const binding = await this.runtimeBindingService.findById(
      dispatch.runtimeBindingId,
    );
    if (!binding) {
      return null;
    }

    this.clearBridgeDispatchTimeout(dispatch.id);
    await this.runtimeDispatchService.attachPostedMessage(
      dispatch.id,
      input.postedMessageId,
    );

    const finalMetadata = this.withObservedDocumentReferences(
      dispatch.resultMetadata ?? {},
      input.resultMetadata ?? {},
    );

    if (!["completed", "failed", "cancelled"].includes(dispatch.status)) {
      await this.runtimeDispatchService.markCompleted(dispatch.id, {
        postedMessageId: input.postedMessageId,
        resultSummary: input.resultSummary ?? null,
        resultMetadata: finalMetadata,
      });
      await this.runtimeThreadSessionService.touch(
        dispatch.runtimeThreadSessionId,
        {
          lastRunFinishedAt: new Date(),
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      );
      await this.runtimeEventService.emitDispatchCompleted({
        workspaceId: dispatch.workspaceId,
        threadId: dispatch.threadId,
        threadSessionId: dispatch.threadSessionId,
        dispatchId: dispatch.id,
        messageId: dispatch.messageId,
        agentId: dispatch.agentId,
        runtimeType: binding.runtimeType,
        runtimeBindingId: binding.id,
        runtimeThreadSessionId: dispatch.runtimeThreadSessionId,
        postedMessageId: input.postedMessageId,
        metadata: finalMetadata,
        timestamp: new Date().toISOString(),
      });
    }

    return this.runtimeDispatchService.findById(dispatch.id);
  }

  async emitProgressFromPostback(input: {
    dispatchId: string;
    event:
      | { type: "run.delta"; seq: number; text: string }
      | {
          type: "run.thinking";
          seq: number;
          thinking: string;
          kind?: "thinking" | "reasoning";
        }
      | { type: "run.status"; code: string; message: string }
      | {
          type: "run.tool";
          toolName: string;
          phase: "started" | "updated" | "completed";
          summary?: string;
          tasks?: RuntimeTodoTask[];
          references?: Array<{
            uri: string;
            title?: string | null;
            kind?: string | null;
            source?: string | null;
          }>;
        }
      | {
          type: "run.context";
          totalTokens: number | null;
          contextTokens: number | null;
          percentUsed: number | null;
          level: "unknown" | "ok" | "warn" | "critical" | "overflow";
          fresh: boolean;
          sessionId?: string;
          model?: string;
          modelProvider?: string;
          references?: Array<{
            uri: string;
            title?: string | null;
            kind?: string | null;
            source?: string | null;
          }>;
        };
  }): Promise<RuntimeDispatchEntity | null> {
    const dispatch = await this.runtimeDispatchService.findById(
      input.dispatchId,
    );
    if (!dispatch) {
      return null;
    }

    if (["completed", "failed", "cancelled"].includes(dispatch.status)) {
      return dispatch;
    }

    const binding = await this.runtimeBindingService.findById(
      dispatch.runtimeBindingId,
    );
    if (!binding) {
      return null;
    }

    const baseEventPayload = {
      workspaceId: dispatch.workspaceId,
      threadId: dispatch.threadId,
      threadSessionId: dispatch.threadSessionId,
      dispatchId: dispatch.id,
      agentId: dispatch.agentId,
      runtimeType: binding.runtimeType,
      runtimeBindingId: binding.id,
      runtimeThreadSessionId: dispatch.runtimeThreadSessionId,
      timestamp: new Date().toISOString(),
    };

    switch (input.event.type) {
      case "run.delta":
        await this.runtimeDispatchService.recordRunDelta(dispatch.id, {
          seq: input.event.seq,
          text: input.event.text,
          timestamp: baseEventPayload.timestamp,
        });
        await this.runtimeEventService.emitRunDelta({
          ...baseEventPayload,
          seq: input.event.seq,
          text: input.event.text,
        });
        break;
      case "run.thinking":
        await this.runtimeEventService.emitRunThinking({
          ...baseEventPayload,
          seq: input.event.seq,
          thinking: input.event.thinking,
          kind: input.event.kind,
        });
        break;
      case "run.status":
        await this.runtimeEventService.emitRunStatus({
          ...baseEventPayload,
          code: input.event.code,
          message: input.event.message,
        });
        break;
      case "run.tool":
        const tasks = this.normalizeRuntimeTodoTasks(
          input.event.toolName,
          input.event.tasks,
        );
        await this.recordObservedContextReferencesFromPostback({
          dispatch,
          baseEventPayload,
          references: input.event.references,
        });
        await this.runtimeEventService.emitRunTool({
          ...baseEventPayload,
          toolName: input.event.toolName,
          phase: input.event.phase,
          summary: input.event.summary,
          tasks,
        });
        break;
      case "run.context":
        const mergedReferences = this.mergeRuntimeContextReferences(
          this.runtimeContextReferencesFromMetadata(dispatch.resultMetadata),
          input.event.references,
        );
        await this.runtimeDispatchService.recordContextUsage(dispatch.id, {
          ...baseEventPayload,
          totalTokens: input.event.totalTokens,
          contextTokens: input.event.contextTokens,
          percentUsed: input.event.percentUsed,
          level: input.event.level,
          fresh: input.event.fresh,
          sessionId: input.event.sessionId,
          model: input.event.model,
          modelProvider: input.event.modelProvider,
          references: mergedReferences,
        });
        await this.runtimeEventService.emitRunContext({
          ...baseEventPayload,
          totalTokens: input.event.totalTokens,
          contextTokens: input.event.contextTokens,
          percentUsed: input.event.percentUsed,
          level: input.event.level,
          fresh: input.event.fresh,
          sessionId: input.event.sessionId,
          model: input.event.model,
          modelProvider: input.event.modelProvider,
          references: mergedReferences,
        });
        break;
    }

    await this.runtimeThreadSessionService.touch(
      dispatch.runtimeThreadSessionId,
      {
        lastDispatchedMessageId: dispatch.messageId,
      },
    );

    return dispatch;
  }

  async documentMetadataForPostback(
    dispatchId: string,
    metadata?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const dispatch = await this.runtimeDispatchService.findById(dispatchId);
    if (!dispatch) {
      return metadata ?? {};
    }
    return this.withObservedDocumentReferences(
      dispatch.resultMetadata ?? {},
      metadata ?? {},
    );
  }

  private mergeRuntimeContextReferences(
    existing: RuntimeContextReference[],
    incoming?: RuntimeContextReference[] | null,
  ): RuntimeContextReference[] {
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return existing;
    }

    const byUri = new Map<string, RuntimeContextReference>();
    for (const reference of [...existing, ...incoming]) {
      if (!reference || typeof reference.uri !== "string") continue;
      const uri = reference.uri.trim();
      if (!uri) continue;
      byUri.set(uri, {
        uri,
        title:
          typeof reference.title === "string" && reference.title.trim()
            ? reference.title.trim()
            : null,
        kind:
          typeof reference.kind === "string" && reference.kind.trim()
            ? reference.kind.trim()
            : null,
        source:
          typeof reference.source === "string" && reference.source.trim()
            ? reference.source.trim()
            : null,
      });
    }
    return Array.from(byUri.values());
  }

  private normalizeRuntimeTodoTasks(
    toolName: string,
    value: unknown,
  ): RuntimeTodoTask[] | undefined {
    if (toolName.trim().toLowerCase() !== "todo" || !Array.isArray(value)) {
      return undefined;
    }

    const validStatuses = new Set<RuntimeTodoTask["status"]>([
      "pending",
      "in_progress",
      "completed",
      "cancelled",
    ]);
    const tasks: RuntimeTodoTask[] = [];
    for (const [index, candidate] of value.slice(0, 100).entries()) {
      if (!candidate || typeof candidate !== "object") continue;
      const record = candidate as Record<string, unknown>;
      const content =
        typeof record.content === "string"
          ? record.content.trim().slice(0, 2_000)
          : "";
      if (!content) continue;
      const id =
        typeof record.id === "string" && record.id.trim()
          ? record.id.trim().slice(0, 200)
          : `todo-${index + 1}`;
      const rawStatus =
        typeof record.status === "string"
          ? record.status.trim().toLowerCase()
          : "pending";
      const status = validStatuses.has(rawStatus as RuntimeTodoTask["status"])
        ? (rawStatus as RuntimeTodoTask["status"])
        : "pending";
      tasks.push({ id, content, status });
    }
    return tasks;
  }

  private runtimeContextReferencesFromMetadata(
    metadata: Record<string, unknown> | null | undefined,
  ): RuntimeContextReference[] {
    if (!metadata || typeof metadata !== "object") return [];

    const usage = metadata.runtimeContextUsage;
    const usageReferences =
      usage && typeof usage === "object" && !Array.isArray(usage)
        ? this.normalizeRuntimeContextReferences(
            (usage as Record<string, unknown>).references,
          )
        : [];

    return this.mergeRuntimeContextReferences(
      [],
      [
        ...usageReferences,
        ...this.normalizeRuntimeContextReferences(metadata.references),
        ...this.normalizeRuntimeContextReferences(
          metadata.runtimeContextReferences,
        ),
        ...this.runtimeContextReferencesFromDocumentReferences(
          metadata.documentReferences,
        ),
      ],
    );
  }

  private normalizeRuntimeContextReferences(
    value: unknown,
  ): RuntimeContextReference[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): RuntimeContextReference[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const uri = this.referenceString(record.uri);
      if (!uri) return [];
      return [
        {
          uri,
          title: this.referenceString(record.title),
          kind: this.referenceString(record.kind),
          source: this.referenceString(record.source),
        },
      ];
    });
  }

  private runtimeContextReferencesFromDocumentReferences(
    value: unknown,
  ): RuntimeContextReference[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): RuntimeContextReference[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const uri =
        this.referenceString(record.uri) ??
        this.referenceString(record.displayPath) ??
        this.referenceString(record.title);
      if (!uri) return [];
      return [
        {
          uri,
          title:
            this.referenceString(record.title) ??
            this.referenceString(record.displayPath),
          kind: this.referenceString(record.kind),
          source: this.referenceString(record.source),
        },
      ];
    });
  }

  private referenceString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private withObservedDocumentReferences(
    existingMetadata: Record<string, unknown>,
    finalMetadata: Record<string, unknown>,
  ): Record<string, unknown> {
    const references = this.mergeRuntimeContextReferences(
      this.runtimeContextReferencesFromMetadata(existingMetadata),
      this.runtimeContextReferencesFromMetadata(finalMetadata),
    );
    return this.withDocumentReferences(finalMetadata, references);
  }

  private async recordObservedContextReferencesFromPostback(input: {
    dispatch: RuntimeDispatchEntity;
    baseEventPayload: {
      workspaceId: string;
      threadId: string;
      threadSessionId: string;
      dispatchId: string;
      agentId: string;
      runtimeType: string;
      runtimeBindingId: string;
      runtimeThreadSessionId: string;
      timestamp: string;
    };
    references?: RuntimeContextReference[] | null;
  }) {
    const mergedReferences = this.mergeRuntimeContextReferences(
      this.runtimeContextReferencesFromMetadata(input.dispatch.resultMetadata),
      input.references,
    );
    if (!mergedReferences.length) return;

    const existingUsage =
      input.dispatch.resultMetadata?.runtimeContextUsage &&
      typeof input.dispatch.resultMetadata.runtimeContextUsage === "object" &&
      !Array.isArray(input.dispatch.resultMetadata.runtimeContextUsage)
        ? (input.dispatch.resultMetadata.runtimeContextUsage as Record<
            string,
            unknown
          >)
        : {};

    await this.runtimeDispatchService.recordContextUsage(input.dispatch.id, {
      ...input.baseEventPayload,
      totalTokens:
        typeof existingUsage.totalTokens === "number"
          ? existingUsage.totalTokens
          : null,
      contextTokens:
        typeof existingUsage.contextTokens === "number"
          ? existingUsage.contextTokens
          : null,
      percentUsed:
        typeof existingUsage.percentUsed === "number"
          ? existingUsage.percentUsed
          : null,
      level:
        existingUsage.level === "ok" ||
        existingUsage.level === "warn" ||
        existingUsage.level === "critical" ||
        existingUsage.level === "overflow"
          ? existingUsage.level
          : "unknown",
      fresh: existingUsage.fresh === true,
      sessionId: this.referenceString(existingUsage.sessionId) ?? undefined,
      model: this.referenceString(existingUsage.model) ?? undefined,
      modelProvider:
        this.referenceString(existingUsage.modelProvider) ?? undefined,
      references: mergedReferences,
    });
  }

  private withDocumentReferences(
    metadata: Record<string, unknown>,
    references: RuntimeContextReference[],
  ): Record<string, unknown> {
    const documentReferences = this.mergeMessageDocumentReferences(
      metadata.documentReferences,
      references,
    );
    if (!documentReferences.length) {
      return metadata;
    }

    return {
      ...metadata,
      documentReferences,
      referenceSummary: {
        count: documentReferences.length,
        hasSensitive: false,
        redactedCount: 0,
      },
    };
  }

  private mergeMessageDocumentReferences(
    existing: unknown,
    references: RuntimeContextReference[],
  ) {
    const byUri = new Map<string, Record<string, unknown>>();
    if (Array.isArray(existing)) {
      for (const reference of existing) {
        if (!reference || typeof reference !== "object") continue;
        const record = reference as Record<string, unknown>;
        const uri =
          typeof record.uri === "string" && record.uri.trim()
            ? record.uri.trim()
            : null;
        if (!uri) continue;
        byUri.set(uri, record);
      }
    }

    for (const reference of references) {
      if (!reference.uri?.trim()) continue;
      const uri = reference.uri.trim();
      const title =
        reference.title?.trim() ||
        uri.split("/").filter(Boolean).slice(-2).join("/") ||
        uri;
      byUri.set(uri, {
        id: `runtime:${createHash("sha256").update(uri).digest("base64url").slice(0, 32)}`,
        kind: this.documentReferenceKind(reference),
        title,
        displayPath: title,
        uri,
        mimeType: uri.toLowerCase().endsWith(".md")
          ? "text/markdown"
          : undefined,
        role: this.documentReferenceRole(reference),
        action: uri.includes("/SKILL.md") ? "used" : "read",
        source: this.documentReferenceSource(reference),
        confidence: uri.includes("/SKILL.md") ? "injected" : "observed",
        sensitive: false,
        redacted: false,
      });
    }

    return Array.from(byUri.values());
  }

  private documentReferenceKind(reference: RuntimeContextReference) {
    const raw = reference.kind?.trim().toLowerCase();
    if (raw === "skill") return "skill";
    if (raw === "workflow" || raw === "skill_reference") return "workflow";
    if (
      raw === "workspace_file" ||
      raw === "memory_file" ||
      raw === "library_doc" ||
      raw === "system_doc" ||
      raw === "web" ||
      raw === "artifact"
    ) {
      return raw;
    }
    if (
      reference.uri.startsWith("agent:/") ||
      reference.uri.startsWith("shared:/")
    ) {
      return reference.uri.includes("/skills/") ? "workflow" : "workspace_file";
    }
    if (reference.uri.startsWith("hermes-skill:/")) return "skill";
    if (
      reference.uri.includes("/skills/") &&
      reference.uri.endsWith("/SKILL.md")
    ) {
      return "skill";
    }
    if (reference.uri.includes("/references/")) return "workflow";
    if (reference.uri.startsWith("/") || reference.uri.startsWith("~")) {
      return "workspace_file";
    }
    return "unknown";
  }

  private documentReferenceRole(reference: RuntimeContextReference) {
    if (reference.uri.includes("/SKILL.md")) return "routing";
    if (reference.uri.includes("/references/")) return "rule";
    return "knowledge";
  }

  private documentReferenceSource(reference: RuntimeContextReference) {
    const raw = reference.source?.trim().toLowerCase();
    if (raw === "hermes" || raw === "workflow_router") {
      return "workflow_router";
    }
    if (reference.uri.includes("/skills/")) return "workflow_router";
    return "agent_declared";
  }

  private scheduleBridgeDispatchTimeout(dispatchId: string, timeoutMs: number) {
    this.clearBridgeDispatchTimeout(dispatchId);
    const handle = setTimeout(
      () => {
        this.bridgeDispatchTimeouts.delete(dispatchId);
        void this.failDispatchById({
          dispatchId,
          code: "timeout",
          message:
            "Runtime dispatch timed out before the agent posted a reply.",
          retryable: true,
        });
      },
      Math.max(timeoutMs, 1),
    );
    handle.unref?.();

    this.bridgeDispatchTimeouts.set(dispatchId, handle);
  }

  private clearBridgeDispatchTimeout(dispatchId: string) {
    const existing = this.bridgeDispatchTimeouts.get(dispatchId);
    if (existing) {
      clearTimeout(existing);
      this.bridgeDispatchTimeouts.delete(dispatchId);
    }
  }
}
