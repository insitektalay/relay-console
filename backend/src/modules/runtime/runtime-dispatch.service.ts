import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { RuntimeDispatchEntity } from "../../entities/runtime-dispatch.entity";
import { RuntimeTodoTask } from "./runtime.types";

const TERMINAL_RUNTIME_DISPATCH_STATUSES = ["completed", "failed", "cancelled"];
const ACTIVE_RUNTIME_DISPATCH_STATUSES = ["queued", "started"];
const MAX_RUNTIME_STREAM_DRAFT_CHARS = 64_000;
const SENSITIVE_BRIDGE_BACKFILL_KEY_PATTERN =
  /(^|[_-])(secret|password|token|authorization|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|bearer)([_-]|$)/i;

export interface RuntimeContextUsageRecord {
  workspaceId: string;
  threadId: string;
  threadSessionId: string;
  dispatchId: string;
  agentId: string;
  runtimeType: string;
  runtimeBindingId: string;
  runtimeThreadSessionId: string;
  timestamp: string;
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
}

export interface CreateRuntimeDispatchInput {
  id?: string;
  workspaceId: string;
  threadId: string;
  threadSessionId: string;
  messageId: string;
  agentId: string;
  runtimeBindingId: string;
  runtimeHostId?: string | null;
  assignmentEpoch?: string | number;
  runtimeThreadSessionId: string;
  dispatchKey: string;
  timeoutAt?: Date | null;
  attemptNumber?: number;
  correlationId?: string | null;
}

export interface RuntimeBridgeBackfillRecord {
  runtimeType: string;
  externalAgentId: string;
  registeredAt: string;
  payload: Record<string, unknown>;
}

export interface RuntimeBridgeBackfillDispatch {
  dispatch: RuntimeDispatchEntity;
  backfill: RuntimeBridgeBackfillRecord;
}

export interface RuntimeStreamDraftRecord {
  version: 1;
  text: string;
  latestSeq: number;
  updatedAt: string;
  truncated: boolean;
}

@Injectable()
export class RuntimeDispatchService {
  constructor(
    @InjectRepository(RuntimeDispatchEntity)
    private readonly runtimeDispatchRepo: Repository<RuntimeDispatchEntity>,
  ) {}

  buildDispatchKey(input: {
    threadId: string;
    threadSessionId: string;
    messageId: string;
    agentId: string;
  }): string {
    return [
      input.threadId,
      input.threadSessionId,
      input.messageId,
      input.agentId,
    ].join(":");
  }

  async findById(id: string): Promise<RuntimeDispatchEntity | null> {
    return this.runtimeDispatchRepo.findOne({ where: { id } });
  }

  async findByDispatchKey(
    dispatchKey: string,
  ): Promise<RuntimeDispatchEntity | null> {
    return this.runtimeDispatchRepo.findOne({ where: { dispatchKey } });
  }

  async findReplayableByThread(input: {
    threadId: string;
    threadSessionId?: string | null;
    recentTerminalWindowMs?: number;
    limit?: number;
  }): Promise<RuntimeDispatchEntity[]> {
    const recentTerminalCutoff = new Date(
      Date.now() - (input.recentTerminalWindowMs ?? 15 * 60 * 1000),
    );
    const qb = this.runtimeDispatchRepo
      .createQueryBuilder("dispatch")
      .where('dispatch."threadId" = :threadId', { threadId: input.threadId })
      .andWhere(
        new Brackets((query) => {
          query
            .where("dispatch.status IN (:...activeStatuses)", {
              activeStatuses: ["queued", "started"],
            })
            .orWhere(
              new Brackets((terminal) => {
                terminal
                  .where("dispatch.status IN (:...terminalStatuses)", {
                    terminalStatuses: ["failed", "cancelled"],
                  })
                  .andWhere('dispatch."postedMessageId" IS NULL')
                  .andWhere('dispatch."updatedAt" >= :recentTerminalCutoff', {
                    recentTerminalCutoff,
                  });
              }),
            );
        }),
      )
      .orderBy(
        'COALESCE(dispatch."completedAt", dispatch."startedAt", dispatch."createdAt")',
        "ASC",
      )
      .addOrderBy('dispatch."createdAt"', "ASC")
      .take(input.limit ?? 50);

    if (input.threadSessionId) {
      qb.andWhere('dispatch."threadSessionId" = :threadSessionId', {
        threadSessionId: input.threadSessionId,
      });
    }

    return qb.getMany();
  }

  async findAgentOpsLiveDispatches(input: {
    workspaceId: string;
    agentIds: string[];
    recentTerminalWindowMs?: number;
    limit?: number;
  }): Promise<RuntimeDispatchEntity[]> {
    if (!input.agentIds.length) return [];
    const recentTerminalCutoff = new Date(
      Date.now() - (input.recentTerminalWindowMs ?? 15 * 60 * 1000),
    );
    return this.runtimeDispatchRepo
      .createQueryBuilder("dispatch")
      .where('dispatch."workspaceId" = :workspaceId', {
        workspaceId: input.workspaceId,
      })
      .andWhere('dispatch."agentId" IN (:...agentIds)', {
        agentIds: input.agentIds,
      })
      .andWhere(
        new Brackets((query) => {
          query
            .where("dispatch.status IN (:...activeStatuses)", {
              activeStatuses: ["queued", "started"],
            })
            .orWhere(
              new Brackets((terminal) => {
                terminal
                  .where("dispatch.status IN (:...terminalStatuses)", {
                    terminalStatuses: TERMINAL_RUNTIME_DISPATCH_STATUSES,
                  })
                  .andWhere('dispatch."updatedAt" >= :recentTerminalCutoff', {
                    recentTerminalCutoff,
                  });
              }),
            );
        }),
      )
      .orderBy(
        'COALESCE(dispatch."completedAt", dispatch."startedAt", dispatch."updatedAt", dispatch."createdAt")',
        "DESC",
      )
      .addOrderBy('dispatch."createdAt"', "DESC")
      .take(input.limit ?? 200)
      .getMany();
  }

  async findLatestContextUsageByThread(
    threadId: string,
  ): Promise<RuntimeContextUsageRecord[]> {
    const dispatches = await this.runtimeDispatchRepo.find({
      where: { threadId },
      order: { updatedAt: "DESC" },
      take: 300,
    });

    const latestByAgent = new Map<string, RuntimeContextUsageRecord>();
    for (const dispatch of dispatches) {
      const usage = this.readContextUsage(dispatch.resultMetadata);
      if (!usage) continue;

      const existing = latestByAgent.get(usage.agentId);
      if (existing && existing.timestamp.localeCompare(usage.timestamp) >= 0) {
        continue;
      }
      latestByAgent.set(usage.agentId, usage);
    }

    return Array.from(latestByAgent.values()).sort(
      (a, b) =>
        (b.percentUsed ?? -1) - (a.percentUsed ?? -1) ||
        b.timestamp.localeCompare(a.timestamp),
    );
  }

  async findExpiredPendingDispatches(
    now: Date,
    limit: number = 100,
  ): Promise<RuntimeDispatchEntity[]> {
    return this.runtimeDispatchRepo
      .createQueryBuilder("dispatch")
      .where("dispatch.status IN (:...statuses)", {
        statuses: ["queued", "started"],
      })
      .andWhere('dispatch."timeoutAt" IS NOT NULL')
      .andWhere('dispatch."timeoutAt" <= :now', { now })
      .orderBy('dispatch."timeoutAt"', "ASC")
      .addOrderBy('dispatch."createdAt"', "ASC")
      .take(limit)
      .getMany();
  }

  async findActiveBridgeBackfillDispatches(input: {
    workspaceId: string;
    runtimeType?: string;
    externalAgentIds?: string[];
    now?: Date;
    limit?: number;
  }): Promise<RuntimeBridgeBackfillDispatch[]> {
    const now = input.now ?? new Date();
    const allowedExternalIds = new Set(
      (input.externalAgentIds ?? []).map((id) => id.trim()).filter(Boolean),
    );
    const dispatches = await this.runtimeDispatchRepo
      .createQueryBuilder("dispatch")
      .where('dispatch."workspaceId" = :workspaceId', {
        workspaceId: input.workspaceId,
      })
      .andWhere("dispatch.status IN (:...statuses)", {
        statuses: ACTIVE_RUNTIME_DISPATCH_STATUSES,
      })
      .andWhere(
        new Brackets((query) => {
          query
            .where('dispatch."timeoutAt" IS NULL')
            .orWhere('dispatch."timeoutAt" > :now', { now });
        }),
      )
      .andWhere(`dispatch."resultMetadata" ? 'bridgeBackfill'`)
      .orderBy('dispatch."createdAt"', "ASC")
      .addOrderBy('dispatch."updatedAt"', "ASC")
      .take(input.limit ?? 100)
      .getMany();

    return dispatches
      .map((dispatch) => ({
        dispatch,
        backfill: this.readBridgeBackfill(dispatch.resultMetadata),
      }))
      .filter(
        (
          entry,
        ): entry is {
          dispatch: RuntimeDispatchEntity;
          backfill: RuntimeBridgeBackfillRecord;
        } => {
          if (!entry.backfill) return false;
          if (
            input.runtimeType &&
            entry.backfill.runtimeType !== input.runtimeType
          ) {
            return false;
          }
          if (
            allowedExternalIds.size &&
            !allowedExternalIds.has(entry.backfill.externalAgentId)
          ) {
            return false;
          }
          if (entry.backfill.payload.dispatchId !== entry.dispatch.id) {
            return false;
          }
          return true;
        },
      );
  }

  async createQueuedDispatch(
    input: CreateRuntimeDispatchInput,
  ): Promise<RuntimeDispatchEntity> {
    if (input.id) {
      const existingById = await this.findById(input.id);
      if (existingById) {
        return existingById;
      }
    }

    const dispatch = this.runtimeDispatchRepo.create({
      id: input.id,
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      messageId: input.messageId,
      agentId: input.agentId,
      runtimeBindingId: input.runtimeBindingId,
      runtimeHostId: input.runtimeHostId ?? null,
      assignmentEpoch: String(input.assignmentEpoch ?? 1),
      runtimeThreadSessionId: input.runtimeThreadSessionId,
      dispatchKey: input.dispatchKey,
      status: "queued",
      timeoutAt: input.timeoutAt ?? null,
      attemptNumber: input.attemptNumber ?? 1,
      correlationId: input.correlationId ?? null,
    });

    try {
      const insertResult = await this.runtimeDispatchRepo.insert(dispatch);
      const insertedId =
        (insertResult.identifiers[0]?.id as string | undefined) ?? input.id;
      if (insertedId) {
        const inserted = await this.findById(insertedId);
        if (inserted) return inserted;
      }
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error;
      }

      const existing = await this.findByDispatchKey(input.dispatchKey);
      if (existing) return existing;
      if (input.id) {
        const existingById = await this.findById(input.id);
        if (existingById) return existingById;
      }
      throw error;
    }

    const existing = await this.findByDispatchKey(input.dispatchKey);
    if (existing) return existing;
    throw new Error("runtime_dispatch_insert_missing");
  }

  async markStarted(
    id: string,
    runtimeRunId?: string | null,
    startedAt?: Date,
  ): Promise<void> {
    await this.runtimeDispatchRepo.update(id, {
      status: "started",
      startedAt: startedAt ?? new Date(),
      runtimeRunId: runtimeRunId ?? null,
    });
  }

  async attachPostedMessage(
    id: string,
    postedMessageId: string,
  ): Promise<void> {
    await this.runtimeDispatchRepo.update(
      { id, postedMessageId: null },
      { postedMessageId },
    );
  }

  async markCompleted(
    id: string,
    input: {
      postedMessageId?: string | null;
      resultSummary?: string | null;
      resultMetadata?: Record<string, unknown>;
      completedAt?: Date;
    } = {},
  ): Promise<void> {
    const existing = await this.findById(id);
    await this.runtimeDispatchRepo.update(id, {
      status: "completed",
      completedAt: input.completedAt ?? new Date(),
      postedMessageId: input.postedMessageId ?? null,
      errorCode: null,
      errorMessage: null,
      resultSummary: input.resultSummary ?? null,
      resultMetadata: {
        ...this.withoutRuntimeEphemeralMetadata(existing?.resultMetadata ?? {}),
        ...(input.resultMetadata ?? {}),
      },
    });
  }

  async markFailed(
    id: string,
    input: {
      errorCode: string;
      errorMessage: string;
      resultMetadata?: Record<string, unknown>;
      failedAt?: Date;
    },
  ): Promise<void> {
    const existing = await this.findById(id);
    await this.runtimeDispatchRepo.update(id, {
      status: "failed",
      completedAt: input.failedAt ?? new Date(),
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      resultMetadata: {
        ...this.withoutRuntimeEphemeralMetadata(existing?.resultMetadata ?? {}),
        ...(input.resultMetadata ?? {}),
      },
    });
  }

  async recordContextUsage(
    id: string,
    usage: RuntimeContextUsageRecord,
  ): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) return;

    await this.runtimeDispatchRepo.update(id, {
      resultMetadata: {
        ...(existing.resultMetadata ?? {}),
        runtimeContextUsage: usage,
      },
    });
  }

  async recordRunTool(
    id: string,
    tool: {
      toolName: string;
      phase: "started" | "updated" | "completed";
      summary?: string;
      tasks?: RuntimeTodoTask[];
      timestamp: string;
    },
  ): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) return;
    await this.runtimeDispatchRepo.update(id, {
      resultMetadata: {
        ...(existing.resultMetadata ?? {}),
        latestTool: tool,
      },
    });
  }

  async recordRunThinking(
    id: string,
    thinking: {
      kind?: "thinking" | "reasoning";
      timestamp: string;
    },
  ): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) return;
    await this.runtimeDispatchRepo.update(id, {
      resultMetadata: {
        ...(existing.resultMetadata ?? {}),
        latestThinking: thinking,
      },
    });
  }

  async recordRunStatus(
    id: string,
    status: {
      code: string;
      message: string;
      timestamp: string;
    },
  ): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) return;
    await this.runtimeDispatchRepo.update(id, {
      resultMetadata: {
        ...(existing.resultMetadata ?? {}),
        latestStatus: status,
      },
    });
  }

  async recordRunDelta(
    id: string,
    delta: {
      seq: number;
      text: string;
      timestamp: string;
    },
  ): Promise<void> {
    const existing = await this.findById(id);
    if (
      !existing ||
      TERMINAL_RUNTIME_DISPATCH_STATUSES.includes(existing.status)
    ) {
      return;
    }

    const current = this.readRuntimeStreamDraft(existing.resultMetadata);
    if (current && delta.seq <= current.latestSeq) {
      return;
    }

    const draftText = `${current?.text ?? ""}${delta.text}`;
    const truncated =
      (current?.truncated ?? false) ||
      draftText.length > MAX_RUNTIME_STREAM_DRAFT_CHARS;
    const boundedText =
      draftText.length > MAX_RUNTIME_STREAM_DRAFT_CHARS
        ? draftText.slice(-MAX_RUNTIME_STREAM_DRAFT_CHARS)
        : draftText;

    await this.runtimeDispatchRepo.update(id, {
      resultMetadata: {
        ...(existing.resultMetadata ?? {}),
        runtimeStreamDraft: {
          version: 1,
          text: boundedText,
          latestSeq: delta.seq,
          updatedAt: delta.timestamp,
          truncated,
        } satisfies RuntimeStreamDraftRecord,
      },
    });
  }

  async markCancelled(id: string, cancelledAt?: Date): Promise<void> {
    const existing = await this.findById(id);
    await this.runtimeDispatchRepo.update(id, {
      status: "cancelled",
      completedAt: cancelledAt ?? new Date(),
      resultMetadata: this.withoutRuntimeEphemeralMetadata(
        existing?.resultMetadata ?? {},
      ),
    });
  }

  async recordBridgeBackfillPayload(
    id: string,
    input: RuntimeBridgeBackfillRecord,
  ): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) return;

    await this.runtimeDispatchRepo.update(id, {
      resultMetadata: {
        ...(existing.resultMetadata ?? {}),
        bridgeBackfill: {
          runtimeType: input.runtimeType,
          externalAgentId: input.externalAgentId,
          registeredAt: input.registeredAt,
          payload: this.sanitizeBridgeBackfillPayload(input.payload),
        },
      },
    });
  }

  private readContextUsage(
    metadata: Record<string, unknown> | null | undefined,
  ): RuntimeContextUsageRecord | null {
    const usage = metadata?.runtimeContextUsage;
    if (!usage || typeof usage !== "object") return null;

    const candidate = usage as Partial<RuntimeContextUsageRecord>;
    if (
      typeof candidate.workspaceId !== "string" ||
      typeof candidate.threadId !== "string" ||
      typeof candidate.threadSessionId !== "string" ||
      typeof candidate.dispatchId !== "string" ||
      typeof candidate.agentId !== "string" ||
      typeof candidate.runtimeType !== "string" ||
      typeof candidate.runtimeBindingId !== "string" ||
      typeof candidate.runtimeThreadSessionId !== "string" ||
      typeof candidate.timestamp !== "string"
    ) {
      return null;
    }

    return {
      workspaceId: candidate.workspaceId,
      threadId: candidate.threadId,
      threadSessionId: candidate.threadSessionId,
      dispatchId: candidate.dispatchId,
      agentId: candidate.agentId,
      runtimeType: candidate.runtimeType,
      runtimeBindingId: candidate.runtimeBindingId,
      runtimeThreadSessionId: candidate.runtimeThreadSessionId,
      timestamp: candidate.timestamp,
      totalTokens:
        typeof candidate.totalTokens === "number"
          ? candidate.totalTokens
          : null,
      contextTokens:
        typeof candidate.contextTokens === "number"
          ? candidate.contextTokens
          : null,
      percentUsed:
        typeof candidate.percentUsed === "number"
          ? candidate.percentUsed
          : null,
      level: candidate.level ?? "unknown",
      fresh: candidate.fresh === true,
      sessionId: candidate.sessionId,
      model: candidate.model,
      modelProvider: candidate.modelProvider,
      references: Array.isArray(candidate.references)
        ? candidate.references
            .filter(
              (
                reference,
              ): reference is {
                uri: string;
                title?: string | null;
                kind?: string | null;
                source?: string | null;
              } =>
                Boolean(
                  reference &&
                  typeof reference === "object" &&
                  typeof (reference as { uri?: unknown }).uri === "string",
                ),
            )
            .map((reference) => ({
              uri: reference.uri,
              title:
                typeof reference.title === "string" ? reference.title : null,
              kind: typeof reference.kind === "string" ? reference.kind : null,
              source:
                typeof reference.source === "string" ? reference.source : null,
            }))
        : [],
    };
  }

  private readBridgeBackfill(
    metadata: Record<string, unknown> | null | undefined,
  ): RuntimeBridgeBackfillRecord | null {
    const raw = metadata?.bridgeBackfill;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const candidate = raw as Partial<RuntimeBridgeBackfillRecord>;
    if (
      typeof candidate.runtimeType !== "string" ||
      typeof candidate.externalAgentId !== "string" ||
      typeof candidate.registeredAt !== "string" ||
      !candidate.payload ||
      typeof candidate.payload !== "object" ||
      Array.isArray(candidate.payload)
    ) {
      return null;
    }
    return {
      runtimeType: candidate.runtimeType,
      externalAgentId: candidate.externalAgentId,
      registeredAt: candidate.registeredAt,
      payload: candidate.payload as Record<string, unknown>,
    };
  }

  readRuntimeStreamDraft(
    metadata: Record<string, unknown> | null | undefined,
  ): RuntimeStreamDraftRecord | null {
    const raw = metadata?.runtimeStreamDraft;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const candidate = raw as Partial<RuntimeStreamDraftRecord>;
    if (
      candidate.version !== 1 ||
      typeof candidate.text !== "string" ||
      typeof candidate.latestSeq !== "number" ||
      typeof candidate.updatedAt !== "string"
    ) {
      return null;
    }
    return {
      version: 1,
      text: candidate.text,
      latestSeq: candidate.latestSeq,
      updatedAt: candidate.updatedAt,
      truncated: candidate.truncated === true,
    };
  }

  private withoutBridgeBackfill(
    metadata: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const next = { ...(metadata ?? {}) };
    delete next.bridgeBackfill;
    return next;
  }

  private withoutRuntimeEphemeralMetadata(
    metadata: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const next = this.withoutBridgeBackfill(metadata);
    delete next.runtimeStreamDraft;
    return next;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    const candidate = error as {
      code?: unknown;
      driverError?: { code?: unknown };
    };
    const code = candidate?.code ?? candidate?.driverError?.code;
    return (
      code === "23505" ||
      code === "ER_DUP_ENTRY" ||
      code === "SQLITE_CONSTRAINT" ||
      code === "SQLITE_CONSTRAINT_UNIQUE"
    );
  }

  private sanitizeBridgeBackfillPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    try {
      const cloned = JSON.parse(JSON.stringify(payload)) as unknown;
      const sanitized = this.redactSensitiveBridgeBackfillValue(cloned);
      return sanitized &&
        typeof sanitized === "object" &&
        !Array.isArray(sanitized)
        ? (sanitized as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private redactSensitiveBridgeBackfillValue(
    value: unknown,
    key?: string,
  ): unknown {
    if (
      key &&
      SENSITIVE_BRIDGE_BACKFILL_KEY_PATTERN.test(key) &&
      value !== null &&
      value !== undefined &&
      typeof value !== "boolean"
    ) {
      return "[redacted]";
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.redactSensitiveBridgeBackfillValue(item));
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([entryKey, entryValue]) => [
          entryKey,
          this.redactSensitiveBridgeBackfillValue(entryValue, entryKey),
        ],
      ),
    );
  }
}
