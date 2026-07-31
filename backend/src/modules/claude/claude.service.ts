import { randomUUID } from "node:crypto";
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, LessThan, Repository } from "typeorm";
import {
  AgentEntity,
  BridgeDeviceEntity,
  ClaudeAgentBindingEntity,
  ClaudeDispatchEntity,
  ClaudeThreadSessionEntity,
  ThreadEntity,
} from "../../entities";
import { EventsGateway } from "../../gateways/events.gateway";
import { MessageService } from "../message/message.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { RuntimeDispatchCoordinator } from "../runtime/runtime-dispatch-coordinator.service";
import { RuntimeDispatchService } from "../runtime/runtime-dispatch.service";
import { RuntimeEventService } from "../runtime/runtime-event.service";
import { RuntimeThreadSessionService } from "../runtime/runtime-thread-session.service";

const HEARTBEAT_GRACE_MS = 2 * 60 * 1000;
const CLAUDE_RUNTIME_TYPE = "claude_code";
const CLAUDE_ADAPTER_KIND = "bridge_ws";

@Injectable()
export class ClaudeService implements OnModuleInit {
  private readonly logger = new Logger(ClaudeService.name);

  constructor(
    @InjectRepository(ClaudeAgentBindingEntity)
    private readonly bindingRepo: Repository<ClaudeAgentBindingEntity>,

    @InjectRepository(ClaudeThreadSessionEntity)
    private readonly threadSessionRepo: Repository<ClaudeThreadSessionEntity>,

    @InjectRepository(ClaudeDispatchEntity)
    private readonly dispatchRepo: Repository<ClaudeDispatchEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,

    @InjectRepository(BridgeDeviceEntity)
    private readonly bridgeDeviceRepo: Repository<BridgeDeviceEntity>,

    private readonly eventsGateway: EventsGateway,
    private readonly runtimeBindingService: RuntimeBindingService,
    private readonly runtimeThreadSessionService: RuntimeThreadSessionService,
    private readonly runtimeDispatchService: RuntimeDispatchService,
    private readonly runtimeDispatchCoordinator: RuntimeDispatchCoordinator,
    private readonly runtimeEventService: RuntimeEventService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.backfillLegacyClaudeStateToRuntimeDomain();
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Claude runtime backfill skipped or failed during startup: ${err.message}`,
      );
    }
  }

  isClaudeAgent(agent?: Pick<AgentEntity, "source"> | null) {
    return agent?.source === CLAUDE_RUNTIME_TYPE;
  }

  async getBindingByAgentId(agentId: string) {
    const existing = await this.bindingRepo.findOne({ where: { agentId } });
    if (existing) return existing;

    const runtimeBinding =
      await this.runtimeBindingService.findByAgentId(agentId);
    if (!runtimeBinding || runtimeBinding.runtimeType !== CLAUDE_RUNTIME_TYPE) {
      return null;
    }

    const mirrored = this.bindingRepo.create({
      id: runtimeBinding.id,
      workspaceId: runtimeBinding.workspaceId,
      agentId: runtimeBinding.agentId,
      repoKey: runtimeBinding.repoKey ?? "",
      routingMode: runtimeBinding.routingMode,
      model: this.getClaudeModelFromRuntimeBinding(
        runtimeBinding.configMetadata,
      ),
      isEnabled: runtimeBinding.isEnabled,
    });
    return this.bindingRepo.save(mirrored);
  }

  async getBindingByExternalId(workspaceId: string, externalId: string) {
    if (!externalId) return null;
    return this.bindingRepo
      .createQueryBuilder("binding")
      .innerJoinAndSelect("binding.agent", "agent")
      .where('binding."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('agent."externalId" = :externalId', { externalId })
      .getOne();
  }

  async upsertAgentBinding(input: {
    workspaceId: string;
    agentId: string;
    repoKey: string;
    routingMode?: string | null;
    model?: string | null;
    isEnabled?: boolean;
  }) {
    const normalizedRepoKey = input.repoKey.trim();
    const normalizedModel = input.model?.trim() || null;
    const normalizedRoutingMode = input.routingMode?.trim() || "explicit_only";
    const isEnabled = input.isEnabled ?? true;

    const runtimeBinding = await this.runtimeBindingService.upsertByAgentId(
      input.agentId,
      {
        workspaceId: input.workspaceId,
        runtimeType: CLAUDE_RUNTIME_TYPE,
        adapterKind: CLAUDE_ADAPTER_KIND,
        routingMode: normalizedRoutingMode,
        repoKey: normalizedRepoKey,
        isEnabled,
        healthStatus: isEnabled ? "ready" : "unconfigured",
        capabilities: this.getClaudeRuntimeCapabilities(),
        configMetadata: {
          model: normalizedModel,
          compatibilitySource: "claude_agent_bindings",
        },
      },
    );

    const existing = await this.bindingRepo.findOne({
      where: { agentId: input.agentId },
    });

    const binding =
      existing ??
      this.bindingRepo.create({
        id: runtimeBinding.id,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
      });

    binding.workspaceId = input.workspaceId;
    binding.agentId = input.agentId;
    binding.repoKey = normalizedRepoKey;
    binding.routingMode = normalizedRoutingMode;
    binding.model = normalizedModel;
    binding.isEnabled = isEnabled;

    return this.bindingRepo.save(binding);
  }

  async deleteBindingForAgent(agentId: string) {
    await this.runtimeBindingService.deleteByAgentId(agentId);
    await this.bindingRepo.delete({ agentId });
  }

  buildDispatchKey(input: {
    threadId: string;
    threadSessionId: string;
    messageId: string;
    agentId: string;
  }) {
    return this.runtimeDispatchService.buildDispatchKey(input);
  }

  async getOrCreateClaudeThreadSession(input: {
    workspaceId: string;
    threadId: string;
    threadSessionId: string;
    agentId: string;
    messageId?: string | null;
  }) {
    const runtimeBinding = await this.ensureClaudeRuntimeBinding(input.agentId);
    const existingLegacy = await this.findClaudeThreadSession(
      input.threadSessionId,
      input.agentId,
    );

    if (existingLegacy) {
      const runtimeThreadSession =
        await this.runtimeThreadSessionService.ensure({
          id: existingLegacy.id,
          workspaceId: existingLegacy.workspaceId,
          threadId: existingLegacy.threadId,
          threadSessionId: existingLegacy.threadSessionId,
          agentId: existingLegacy.agentId,
          runtimeBindingId: runtimeBinding.id,
          runtimeSessionId: existingLegacy.claudeSessionId,
          metadata: { legacySource: "claude_thread_sessions" },
        });

      if (input.messageId) {
        existingLegacy.lastDispatchedMessageId = input.messageId;
      }
      existingLegacy.lastActivityAt = new Date();
      const savedLegacy = await this.threadSessionRepo.save(existingLegacy);

      await this.runtimeThreadSessionService.touch(runtimeThreadSession.id, {
        status: savedLegacy.status,
        lastDispatchedMessageId:
          input.messageId ?? savedLegacy.lastDispatchedMessageId,
        lastRunStartedAt: savedLegacy.lastRunStartedAt,
        lastRunFinishedAt: savedLegacy.lastRunFinishedAt,
        lastErrorCode: savedLegacy.lastErrorCode,
        lastErrorMessage: savedLegacy.lastErrorMessage,
        closedAt: savedLegacy.closedAt,
        metadata: {
          ...(runtimeThreadSession.metadata ?? {}),
          legacySource: "claude_thread_sessions",
        },
        lastActivityAt: savedLegacy.lastActivityAt,
      });

      return savedLegacy;
    }

    const claudeThreadSession = this.threadSessionRepo.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      agentId: input.agentId,
      claudeSessionId: randomUUID(),
      status: "active",
      lastDispatchedMessageId: input.messageId ?? null,
      lastActivityAt: new Date(),
    });
    const saved = await this.threadSessionRepo.save(claudeThreadSession);

    await this.runtimeThreadSessionService.ensure({
      id: saved.id,
      workspaceId: saved.workspaceId,
      threadId: saved.threadId,
      threadSessionId: saved.threadSessionId,
      agentId: saved.agentId,
      runtimeBindingId: runtimeBinding.id,
      runtimeSessionId: saved.claudeSessionId,
      metadata: { legacySource: "claude_thread_sessions" },
    });

    return saved;
  }

  async findClaudeThreadSession(threadSessionId: string, agentId: string) {
    return this.threadSessionRepo.findOne({
      where: {
        threadSessionId,
        agentId,
      },
    });
  }

  async createDispatch(input: {
    workspaceId: string;
    threadId: string;
    threadSessionId: string;
    messageId: string;
    agentId: string;
    timeoutSeconds: number;
    claudeThreadSessionId?: string | null;
  }) {
    const dispatchKey = this.buildDispatchKey(input);
    const existing = await this.dispatchRepo.findOne({
      where: { dispatchKey },
    });
    if (existing) {
      await this.ensureRuntimeDispatchMirror(existing);
      return { dispatch: existing, created: false };
    }

    const runtimeBinding = await this.ensureClaudeRuntimeBinding(input.agentId);
    const claudeThreadSession = input.claudeThreadSessionId
      ? await this.threadSessionRepo.findOne({
          where: { id: input.claudeThreadSessionId },
        })
      : await this.findClaudeThreadSession(
          input.threadSessionId,
          input.agentId,
        );

    if (!claudeThreadSession) {
      throw new NotFoundException(
        `Claude thread session not found for threadSession ${input.threadSessionId} and agent ${input.agentId}`,
      );
    }

    const runtimeThreadSession = await this.runtimeThreadSessionService.ensure({
      id: claudeThreadSession.id,
      workspaceId: claudeThreadSession.workspaceId,
      threadId: claudeThreadSession.threadId,
      threadSessionId: claudeThreadSession.threadSessionId,
      agentId: claudeThreadSession.agentId,
      runtimeBindingId: runtimeBinding.id,
      runtimeSessionId: claudeThreadSession.claudeSessionId,
      metadata: { legacySource: "claude_thread_sessions" },
    });

    const runtimeDispatch = await this.runtimeDispatchCoordinator.queueDispatch(
      {
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        threadSessionId: input.threadSessionId,
        messageId: input.messageId,
        agentId: input.agentId,
        runtimeBinding,
        runtimeThreadSession,
        timeoutAt: new Date(Date.now() + input.timeoutSeconds * 1000),
      },
    );

    const created = await this.dispatchRepo.save(
      this.dispatchRepo.create({
        id: runtimeDispatch.id,
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        threadSessionId: input.threadSessionId,
        messageId: input.messageId,
        agentId: input.agentId,
        dispatchKey,
        status: runtimeDispatch.status,
        timeoutAt: runtimeDispatch.timeoutAt,
      }),
    );

    return { dispatch: created, created: true };
  }

  async getDispatchOrThrow(dispatchId: string) {
    const dispatch = await this.dispatchRepo.findOne({
      where: { id: dispatchId },
    });
    if (!dispatch) {
      throw new NotFoundException(`Claude dispatch ${dispatchId} not found`);
    }
    return dispatch;
  }

  async markDispatchStarted(input: {
    dispatchId: string;
    bridgeDeviceId: string;
    startedAt?: Date;
  }) {
    let dispatch = await this.getDispatchOrThrow(input.dispatchId);
    if (dispatch.status === "completed" || dispatch.status === "failed") {
      return dispatch;
    }
    if (
      dispatch.bridgeDeviceId &&
      dispatch.bridgeDeviceId !== input.bridgeDeviceId
    ) {
      throw new ForbiddenException(
        "Claude dispatch belongs to another bridge device",
      );
    }

    const startedAt = input.startedAt ?? new Date();
    if (!dispatch.bridgeDeviceId) {
      const claim = await this.dispatchRepo.update(
        {
          id: dispatch.id,
          bridgeDeviceId: IsNull(),
          status: In(["queued", "started"]),
        },
        {
          bridgeDeviceId: input.bridgeDeviceId,
          status: "started",
          startedAt,
        },
      );
      if (claim.affected !== 1) {
        dispatch = await this.getDispatchOrThrow(input.dispatchId);
        if (dispatch.status === "completed" || dispatch.status === "failed") {
          return dispatch;
        }
        if (dispatch.bridgeDeviceId !== input.bridgeDeviceId) {
          throw new ForbiddenException(
            "Claude dispatch belongs to another bridge device",
          );
        }
      } else {
        dispatch.bridgeDeviceId = input.bridgeDeviceId;
        dispatch.status = "started";
        dispatch.startedAt = startedAt;
      }
    }

    await this.runtimeDispatchService.markStarted(
      dispatch.id,
      input.bridgeDeviceId,
      startedAt,
    );
    const runtimeDispatch = await this.getRuntimeDispatchOrThrow(dispatch.id);
    await this.runtimeThreadSessionService.touch(
      runtimeDispatch.runtimeThreadSessionId,
      {
        lastRunStartedAt: startedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    );
    await this.runtimeEventService.emitDispatchStarted(
      this.toRuntimeDispatchPayload(runtimeDispatch),
    );

    dispatch.status = "started";
    dispatch.bridgeDeviceId = input.bridgeDeviceId;
    dispatch.startedAt = startedAt;
    await this.dispatchRepo.save(dispatch);

    await this.threadSessionRepo.update(
      {
        threadSessionId: dispatch.threadSessionId,
        agentId: dispatch.agentId,
      },
      {
        lastRunStartedAt: startedAt,
        lastActivityAt: startedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    );

    return dispatch;
  }

  async attachPostedMessage(dispatchId: string, postedMessageId: string) {
    const dispatch = await this.getDispatchOrThrow(dispatchId);
    if (!dispatch.postedMessageId) {
      await this.runtimeDispatchService.attachPostedMessage(
        dispatch.id,
        postedMessageId,
      );
      dispatch.postedMessageId = postedMessageId;
      await this.dispatchRepo.save(dispatch);
    }
    return dispatch;
  }

  async markDispatchCompleted(input: {
    dispatchId: string;
    completedAt?: Date;
    resultSummary?: string | null;
    resultMetadata?: Record<string, unknown>;
  }) {
    const dispatch = await this.getDispatchOrThrow(input.dispatchId);
    if (dispatch.status === "completed") {
      return dispatch;
    }
    if (dispatch.status === "failed") {
      return dispatch;
    }

    const completedAt = input.completedAt ?? new Date();
    await this.runtimeDispatchService.markCompleted(dispatch.id, {
      postedMessageId: dispatch.postedMessageId,
      resultSummary: input.resultSummary ?? dispatch.resultSummary,
      resultMetadata: input.resultMetadata ?? {},
      completedAt,
    });
    const runtimeDispatch = await this.getRuntimeDispatchOrThrow(dispatch.id);
    await this.runtimeThreadSessionService.touch(
      runtimeDispatch.runtimeThreadSessionId,
      {
        lastRunFinishedAt: completedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    );
    await this.runtimeEventService.emitDispatchCompleted({
      ...this.toRuntimeDispatchPayload(runtimeDispatch),
      postedMessageId: dispatch.postedMessageId,
      metadata: input.resultMetadata ?? {},
    });

    dispatch.status = "completed";
    dispatch.completedAt = completedAt;
    dispatch.resultSummary = input.resultSummary ?? dispatch.resultSummary;
    dispatch.resultMetadata = {
      ...(dispatch.resultMetadata ?? {}),
      ...(input.resultMetadata ?? {}),
    };
    await this.dispatchRepo.save(dispatch);

    await this.threadSessionRepo.update(
      {
        threadSessionId: dispatch.threadSessionId,
        agentId: dispatch.agentId,
      },
      {
        lastRunFinishedAt: completedAt,
        lastActivityAt: completedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    );

    this.eventsGateway.emitAgentTyping(
      dispatch.threadId,
      [dispatch.agentId],
      false,
    );
    return dispatch;
  }

  async markDispatchFailed(input: {
    dispatchId: string;
    errorCode: string;
    errorMessage: string;
    failedAt?: Date;
  }) {
    const dispatch = await this.getDispatchOrThrow(input.dispatchId);
    if (dispatch.status === "completed" || dispatch.status === "failed") {
      return dispatch;
    }

    const failedAt = input.failedAt ?? new Date();
    await this.runtimeDispatchService.markFailed(dispatch.id, {
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      failedAt,
    });
    const runtimeDispatch = await this.getRuntimeDispatchOrThrow(dispatch.id);
    await this.runtimeThreadSessionService.touch(
      runtimeDispatch.runtimeThreadSessionId,
      {
        lastRunFinishedAt: failedAt,
        lastErrorCode: input.errorCode,
        lastErrorMessage: input.errorMessage,
      },
    );
    await this.runtimeEventService.emitDispatchFailed({
      ...this.toRuntimeDispatchPayload(runtimeDispatch),
      code: input.errorCode,
      message: input.errorMessage,
      retryable: false,
    });

    dispatch.status = "failed";
    dispatch.completedAt = failedAt;
    dispatch.errorCode = input.errorCode;
    dispatch.errorMessage = input.errorMessage;
    await this.dispatchRepo.save(dispatch);

    await this.threadSessionRepo.update(
      {
        threadSessionId: dispatch.threadSessionId,
        agentId: dispatch.agentId,
      },
      {
        lastRunFinishedAt: failedAt,
        lastActivityAt: failedAt,
        lastErrorCode: input.errorCode,
        lastErrorMessage: input.errorMessage,
      },
    );

    this.eventsGateway.emitAgentTyping(
      dispatch.threadId,
      [dispatch.agentId],
      false,
    );
    return dispatch;
  }

  async closeThreadSessionsForThread(
    threadId: string,
    input?: {
      threadSessionId?: string | null;
      agentIds?: string[];
      reason?: string | null;
    },
  ) {
    await this.runtimeThreadSessionService.closeForThread({
      threadId,
      threadSessionId: input?.threadSessionId,
      agentIds: input?.agentIds,
      reason: input?.reason ?? null,
    });

    await this.closeLegacyThreadSessionsForThread(threadId, input);
  }

  async closeLegacyThreadSessionsForThread(
    threadId: string,
    input?: {
      threadSessionId?: string | null;
      agentIds?: string[];
      reason?: string | null;
    },
  ) {
    const qb = this.threadSessionRepo
      .createQueryBuilder()
      .update(ClaudeThreadSessionEntity)
      .set({
        status: "closed",
        closedAt: new Date(),
        lastErrorCode: input?.reason ? "closed" : undefined,
        lastErrorMessage: input?.reason ?? undefined,
      })
      .where('"threadId" = :threadId', { threadId })
      .andWhere("status = :status", { status: "active" });

    if (input?.threadSessionId) {
      qb.andWhere('"threadSessionId" = :threadSessionId', {
        threadSessionId: input.threadSessionId,
      });
    }

    if (input?.agentIds?.length) {
      qb.andWhere('"agentId" IN (:...agentIds)', { agentIds: input.agentIds });
    }

    await qb.execute();
  }

  async validateActiveThreadSession(threadId: string, threadSessionId: string) {
    const thread = await this.threadRepo.findOne({
      where: { id: threadId },
      select: ["id", "activeSessionId", "status"],
    });
    if (!thread) {
      throw new NotFoundException("Thread not found");
    }
    return (
      thread.status !== "archived" && thread.activeSessionId === threadSessionId
    );
  }

  async isClaudeAgentLive(workspaceId: string, externalId?: string | null) {
    if (!externalId) return false;
    const runtime = this.eventsGateway.getWorkspaceBridgeRuntime(
      workspaceId,
      "claude_code",
    );
    return runtime.liveRegisteredExternalAgentIds.includes(externalId);
  }

  async recordHeartbeat(deviceId: string) {
    await this.bridgeDeviceRepo.update(deviceId, { lastSeenAt: new Date() });
  }

  async getAgentWithBinding(agentId: string) {
    return this.agentRepo.findOne({
      where: { id: agentId },
      relations: { claudeBinding: true },
    });
  }

  @Cron("0 * * * * *")
  async reconcileStaleStartedDispatches() {
    const now = new Date();
    const staleDispatches = await this.dispatchRepo.find({
      where: {
        status: "started",
        updatedAt: LessThan(new Date(Date.now() - HEARTBEAT_GRACE_MS)),
      },
      take: 100,
    });

    for (const dispatch of staleDispatches) {
      if (!dispatch.bridgeDeviceId) {
        const failed = await this.markDispatchFailed({
          dispatchId: dispatch.id,
          errorCode: "runtime_offline",
          errorMessage: "Claude runtime disappeared before completing the run.",
          failedAt: now,
        });
        const isStillActive = await this.validateActiveThreadSession(
          failed.threadId,
          failed.threadSessionId,
        );
        if (isStillActive) {
          const agent = await this.getAgentWithBinding(failed.agentId);
          await this.messageService.sendSystemMessage(
            failed.threadId,
            `${agent?.name ?? "Claude agent"} failed: Claude runtime disappeared before completing the run.`,
          );
        }
        continue;
      }

      const device = await this.bridgeDeviceRepo.findOne({
        where: { id: dispatch.bridgeDeviceId },
        select: ["id", "lastSeenAt", "status", "revokedAt"],
      });

      const isOffline =
        !device ||
        device.status !== "active" ||
        Boolean(device.revokedAt) ||
        !device.lastSeenAt ||
        now.getTime() - device.lastSeenAt.getTime() > HEARTBEAT_GRACE_MS;

      if (!isOffline) continue;

      const failed = await this.markDispatchFailed({
        dispatchId: dispatch.id,
        errorCode: "runtime_offline",
        errorMessage:
          "Claude runtime went offline while the dispatch was running.",
        failedAt: now,
      });
      const isStillActive = await this.validateActiveThreadSession(
        failed.threadId,
        failed.threadSessionId,
      );
      if (isStillActive) {
        const agent = await this.getAgentWithBinding(failed.agentId);
        await this.messageService.sendSystemMessage(
          failed.threadId,
          `${agent?.name ?? "Claude agent"} failed: Claude runtime went offline while the dispatch was running.`,
        );
      }
    }
  }

  private getClaudeRuntimeCapabilities() {
    return {
      streamText: false,
      cancelRun: false,
      resumeSession: true,
      toolActivity: "none",
      workspaceExecution: true,
      bridgeBacked: true,
      requiresExternalRuntimePresence: true,
    };
  }

  private getClaudeModelFromRuntimeBinding(
    configMetadata: Record<string, unknown> | null | undefined,
  ): string | null {
    const model = configMetadata?.model;
    return typeof model === "string" && model.trim() ? model.trim() : null;
  }

  private async ensureClaudeRuntimeBinding(agentId: string) {
    const existing = await this.runtimeBindingService.findByAgentId(agentId);
    if (existing) {
      return existing;
    }

    const legacy = await this.bindingRepo.findOne({ where: { agentId } });
    if (!legacy) {
      const agent = await this.agentRepo.findOne({
        where: { id: agentId },
        select: ["id", "workspaceId", "source", "name"],
      });
      if (
        !agent ||
        agent.source !== CLAUDE_RUNTIME_TYPE ||
        !agent.workspaceId
      ) {
        throw new NotFoundException(
          `Claude binding not found for agent ${agentId}`,
        );
      }

      return this.runtimeBindingService.upsertByAgentId(agentId, {
        workspaceId: agent.workspaceId,
        runtimeType: CLAUDE_RUNTIME_TYPE,
        adapterKind: CLAUDE_ADAPTER_KIND,
        routingMode: "explicit_only",
        repoKey: null,
        isEnabled: false,
        healthStatus: "error",
        lastErrorCode: "binding_missing",
        lastErrorMessage: `${agent.name} is missing a Claude binding.`,
        capabilities: this.getClaudeRuntimeCapabilities(),
        configMetadata: {
          compatibilitySource: "generated_placeholder",
        },
      });
    }

    return this.runtimeBindingService.upsertByAgentId(agentId, {
      id: legacy.id,
      workspaceId: legacy.workspaceId,
      runtimeType: CLAUDE_RUNTIME_TYPE,
      adapterKind: CLAUDE_ADAPTER_KIND,
      routingMode: legacy.routingMode,
      repoKey: legacy.repoKey,
      isEnabled: legacy.isEnabled,
      healthStatus: legacy.isEnabled ? "ready" : "unconfigured",
      capabilities: this.getClaudeRuntimeCapabilities(),
      configMetadata: {
        model: legacy.model ?? null,
        compatibilitySource: "claude_agent_bindings",
      },
    });
  }

  private async ensureRuntimeDispatchMirror(
    legacyDispatch: ClaudeDispatchEntity,
  ) {
    const runtimeBinding = await this.ensureClaudeRuntimeBinding(
      legacyDispatch.agentId,
    );
    const legacyThreadSession = await this.threadSessionRepo.findOne({
      where: {
        threadSessionId: legacyDispatch.threadSessionId,
        agentId: legacyDispatch.agentId,
      },
    });
    if (!legacyThreadSession) {
      throw new NotFoundException(
        `Claude thread session missing for dispatch ${legacyDispatch.id}`,
      );
    }

    const runtimeThreadSession = await this.runtimeThreadSessionService.ensure({
      id: legacyThreadSession.id,
      workspaceId: legacyThreadSession.workspaceId,
      threadId: legacyThreadSession.threadId,
      threadSessionId: legacyThreadSession.threadSessionId,
      agentId: legacyThreadSession.agentId,
      runtimeBindingId: runtimeBinding.id,
      runtimeSessionId: legacyThreadSession.claudeSessionId,
      metadata: { legacySource: "claude_thread_sessions" },
    });

    const runtimeDispatch =
      await this.runtimeDispatchService.createQueuedDispatch({
        id: legacyDispatch.id,
        workspaceId: legacyDispatch.workspaceId,
        threadId: legacyDispatch.threadId,
        threadSessionId: legacyDispatch.threadSessionId,
        messageId: legacyDispatch.messageId,
        agentId: legacyDispatch.agentId,
        runtimeBindingId: runtimeBinding.id,
        runtimeThreadSessionId: runtimeThreadSession.id,
        dispatchKey: legacyDispatch.dispatchKey,
        timeoutAt: legacyDispatch.timeoutAt,
      });

    if (legacyDispatch.status === "started") {
      await this.runtimeDispatchService.markStarted(
        runtimeDispatch.id,
        legacyDispatch.bridgeDeviceId,
        legacyDispatch.startedAt ?? undefined,
      );
    } else if (legacyDispatch.status === "completed") {
      await this.runtimeDispatchService.markCompleted(runtimeDispatch.id, {
        postedMessageId: legacyDispatch.postedMessageId,
        resultSummary: legacyDispatch.resultSummary,
        resultMetadata: legacyDispatch.resultMetadata ?? {},
        completedAt: legacyDispatch.completedAt ?? undefined,
      });
    } else if (legacyDispatch.status === "failed") {
      await this.runtimeDispatchService.markFailed(runtimeDispatch.id, {
        errorCode: legacyDispatch.errorCode ?? "runtime_error",
        errorMessage:
          legacyDispatch.errorMessage ?? "Legacy Claude dispatch failed",
        resultMetadata: legacyDispatch.resultMetadata ?? {},
        failedAt: legacyDispatch.completedAt ?? undefined,
      });
    }

    if (legacyDispatch.postedMessageId) {
      await this.runtimeDispatchService.attachPostedMessage(
        runtimeDispatch.id,
        legacyDispatch.postedMessageId,
      );
    }

    return runtimeDispatch;
  }

  private async getRuntimeDispatchOrThrow(dispatchId: string) {
    const runtimeDispatch =
      await this.runtimeDispatchService.findById(dispatchId);
    if (!runtimeDispatch) {
      throw new NotFoundException(`Runtime dispatch ${dispatchId} not found`);
    }
    return runtimeDispatch;
  }

  private toRuntimeDispatchPayload(runtimeDispatch: {
    workspaceId: string;
    threadId: string;
    threadSessionId: string;
    id: string;
    agentId: string;
    runtimeBindingId: string;
    runtimeThreadSessionId: string;
  }) {
    return {
      workspaceId: runtimeDispatch.workspaceId,
      threadId: runtimeDispatch.threadId,
      threadSessionId: runtimeDispatch.threadSessionId,
      dispatchId: runtimeDispatch.id,
      agentId: runtimeDispatch.agentId,
      runtimeType: CLAUDE_RUNTIME_TYPE,
      runtimeBindingId: runtimeDispatch.runtimeBindingId,
      runtimeThreadSessionId: runtimeDispatch.runtimeThreadSessionId,
      timestamp: new Date().toISOString(),
    };
  }

  // Temporary compatibility shim: while Claude still has legacy tables and
  // callback endpoints, mirror existing legacy Claude runtime state into the
  // generic runtime domain on startup so the new domain is authoritative.
  private async backfillLegacyClaudeStateToRuntimeDomain(): Promise<void> {
    const legacyBindings = await this.bindingRepo.find();
    for (const binding of legacyBindings) {
      await this.runtimeBindingService.upsertByAgentId(binding.agentId, {
        id: binding.id,
        workspaceId: binding.workspaceId,
        runtimeType: CLAUDE_RUNTIME_TYPE,
        adapterKind: CLAUDE_ADAPTER_KIND,
        routingMode: binding.routingMode,
        repoKey: binding.repoKey,
        isEnabled: binding.isEnabled,
        healthStatus: binding.isEnabled ? "ready" : "unconfigured",
        capabilities: this.getClaudeRuntimeCapabilities(),
        configMetadata: {
          model: binding.model ?? null,
          compatibilitySource: "claude_agent_bindings",
        },
      });
    }

    const legacyThreadSessions = await this.threadSessionRepo.find();
    for (const legacyThreadSession of legacyThreadSessions) {
      const runtimeBinding = await this.ensureClaudeRuntimeBinding(
        legacyThreadSession.agentId,
      );
      const runtimeThreadSession =
        await this.runtimeThreadSessionService.ensure({
          id: legacyThreadSession.id,
          workspaceId: legacyThreadSession.workspaceId,
          threadId: legacyThreadSession.threadId,
          threadSessionId: legacyThreadSession.threadSessionId,
          agentId: legacyThreadSession.agentId,
          runtimeBindingId: runtimeBinding.id,
          runtimeSessionId: legacyThreadSession.claudeSessionId,
          metadata: { legacySource: "claude_thread_sessions" },
        });
      await this.runtimeThreadSessionService.touch(runtimeThreadSession.id, {
        status: legacyThreadSession.status,
        lastDispatchedMessageId: legacyThreadSession.lastDispatchedMessageId,
        lastRunStartedAt: legacyThreadSession.lastRunStartedAt,
        lastRunFinishedAt: legacyThreadSession.lastRunFinishedAt,
        lastErrorCode: legacyThreadSession.lastErrorCode,
        lastErrorMessage: legacyThreadSession.lastErrorMessage,
        closedAt: legacyThreadSession.closedAt,
        metadata: {
          ...(runtimeThreadSession.metadata ?? {}),
          legacySource: "claude_thread_sessions",
        },
        lastActivityAt: legacyThreadSession.lastActivityAt,
      });
    }

    const legacyDispatches = await this.dispatchRepo.find();
    for (const legacyDispatch of legacyDispatches) {
      await this.ensureRuntimeDispatchMirror(legacyDispatch);
    }
  }
}
