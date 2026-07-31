import { Injectable, Logger } from "@nestjs/common";
import { RuntimeDispatchService } from "../runtime/runtime-dispatch.service";
import { RuntimeEvent, RuntimeEventSink } from "../runtime/runtime.types";

type HermesBridgeTerminalEvent =
  | Extract<RuntimeEvent, { type: "run.completed" }>
  | Extract<RuntimeEvent, { type: "run.failed" }>
  | Extract<RuntimeEvent, { type: "run.cancelled" }>;

export type HermesBridgeInboundEvent =
  | Extract<RuntimeEvent, { type: "run.started" }>
  | Extract<RuntimeEvent, { type: "run.delta" }>
  | Extract<RuntimeEvent, { type: "run.thinking" }>
  | Extract<RuntimeEvent, { type: "run.status" }>
  | Extract<RuntimeEvent, { type: "run.tool" }>
  | Extract<RuntimeEvent, { type: "run.context" }>
  | HermesBridgeTerminalEvent;

interface PendingHermesBridgeDispatch {
  dispatchId: string;
  workspaceId: string;
  externalAgentId: string;
  sink: RuntimeEventSink;
  dispatchPayload: Record<string, unknown>;
  registeredAt: Date;
  resolve: () => void;
  reject: (error: Error) => void;
  terminal: boolean;
  terminalInProgress: boolean;
}

@Injectable()
export class HermesBridgeRuntimeService {
  private readonly logger = new Logger(HermesBridgeRuntimeService.name);
  private readonly pendingDispatches = new Map<
    string,
    PendingHermesBridgeDispatch
  >();

  constructor(
    private readonly runtimeDispatchService: RuntimeDispatchService,
  ) {}

  waitForTerminal(input: {
    dispatchId: string;
    workspaceId: string;
    externalAgentId: string;
    sink: RuntimeEventSink;
    dispatchPayload: Record<string, unknown>;
  }): Promise<void> {
    const existing = this.pendingDispatches.get(input.dispatchId);
    if (existing) {
      existing.reject(
        new Error(`Hermes bridge dispatch ${input.dispatchId} was replaced`),
      );
      this.pendingDispatches.delete(input.dispatchId);
    }

    return new Promise<void>((resolve, reject) => {
      this.pendingDispatches.set(input.dispatchId, {
        ...input,
        registeredAt: new Date(),
        resolve,
        reject,
        terminal: false,
        terminalInProgress: false,
      });
    });
  }

  getPendingTarget(dispatchId: string) {
    const pending = this.pendingDispatches.get(dispatchId);
    if (!pending) return null;
    return {
      workspaceId: pending.workspaceId,
      externalAgentId: pending.externalAgentId,
    };
  }

  async acceptBridgeEvent(input: {
    workspaceId: string;
    event: HermesBridgeInboundEvent;
  }): Promise<boolean> {
    const pending = this.pendingDispatches.get(input.event.dispatchId);
    if (!pending) {
      this.logger.warn(
        `Ignoring Hermes bridge event for unknown dispatch ${input.event.dispatchId}`,
      );
      return false;
    }

    if (pending.workspaceId !== input.workspaceId) {
      this.logger.warn(
        `Ignoring Hermes bridge event for dispatch ${input.event.dispatchId} from wrong workspace`,
      );
      return false;
    }

    if (pending.terminal) {
      return true;
    }

    if (this.isTerminalEvent(input.event)) {
      if (pending.terminalInProgress) {
        this.logger.warn(
          `Ignoring duplicate Hermes bridge terminal event while processing dispatchId=${input.event.dispatchId} type=${input.event.type}`,
        );
        return true;
      }
      pending.terminalInProgress = true;
      this.logger.log(
        `Processing Hermes bridge terminal event dispatchId=${input.event.dispatchId} type=${input.event.type}`,
      );
    }
    try {
      await pending.sink.emit(input.event);
    } catch (error) {
      if (this.isTerminalEvent(input.event)) {
        pending.terminalInProgress = false;
      }
      throw error;
    }

    if (this.isTerminalEvent(input.event)) {
      pending.terminal = true;
      this.pendingDispatches.delete(input.event.dispatchId);
      pending.resolve();
      this.logger.log(
        `Processed Hermes bridge terminal event dispatchId=${input.event.dispatchId} type=${input.event.type}`,
      );
    }

    return true;
  }

  async listPendingBackfill(input: {
    workspaceId: string;
    externalAgentIds?: string[];
  }): Promise<
    Array<{
      dispatchId: string;
      externalAgentId: string;
      registeredAt: string;
      payload: Record<string, unknown>;
      status: string;
      timeoutAt: string | null;
      expiresAt: string | null;
      skipped?: false;
    }>
  > {
    const allowedExternalIds = new Set(
      (input.externalAgentIds ?? []).map((id) => id.trim()).filter(Boolean),
    );
    const pending = Array.from(this.pendingDispatches.values()).filter(
      (entry) =>
        entry.workspaceId === input.workspaceId &&
        !entry.terminal &&
        (!allowedExternalIds.size ||
          allowedExternalIds.has(entry.externalAgentId)),
    );
    const resultByDispatchId = new Map<
      string,
      {
        dispatchId: string;
        externalAgentId: string;
        registeredAt: string;
        payload: Record<string, unknown>;
        status: string;
        timeoutAt: string | null;
        expiresAt: string | null;
        skipped?: false;
      }
    >();
    const result: Array<{
      dispatchId: string;
      externalAgentId: string;
      registeredAt: string;
      payload: Record<string, unknown>;
      status: string;
      timeoutAt: string | null;
      expiresAt: string | null;
      skipped?: false;
    }> = [];
    const now = Date.now();
    for (const entry of pending) {
      const dispatch = await this.runtimeDispatchService.findById(
        entry.dispatchId,
      );
      if (!dispatch) continue;
      if (dispatch.workspaceId !== input.workspaceId) continue;
      if (["completed", "failed", "cancelled"].includes(dispatch.status)) {
        continue;
      }
      if (dispatch.timeoutAt && dispatch.timeoutAt.getTime() <= now) {
        continue;
      }
      resultByDispatchId.set(entry.dispatchId, {
        dispatchId: entry.dispatchId,
        externalAgentId: entry.externalAgentId,
        registeredAt: entry.registeredAt.toISOString(),
        payload: entry.dispatchPayload,
        status: dispatch.status,
        timeoutAt: dispatch.timeoutAt?.toISOString() ?? null,
        expiresAt: dispatch.timeoutAt?.toISOString() ?? null,
      });
    }
    const persistedBackfills =
      await this.runtimeDispatchService.findActiveBridgeBackfillDispatches({
        workspaceId: input.workspaceId,
        runtimeType: "hermes",
        externalAgentIds: input.externalAgentIds,
      });
    for (const { dispatch, backfill } of persistedBackfills) {
      if (resultByDispatchId.has(dispatch.id)) continue;
      resultByDispatchId.set(dispatch.id, {
        dispatchId: dispatch.id,
        externalAgentId: backfill.externalAgentId,
        registeredAt: backfill.registeredAt,
        payload: backfill.payload,
        status: dispatch.status,
        timeoutAt: dispatch.timeoutAt?.toISOString() ?? null,
        expiresAt: dispatch.timeoutAt?.toISOString() ?? null,
      });
    }
    result.push(...resultByDispatchId.values());
    this.logger.log(
      JSON.stringify({
        event: "hermes.bridge.pending_backfill.list",
        workspaceId: input.workspaceId,
        requestedExternalAgentIds: Array.from(allowedExternalIds),
        returnedCount: result.length,
        dispatchIds: result.map((entry) => entry.dispatchId),
        persistedRecoveredCount: persistedBackfills.filter(
          ({ dispatch }) =>
            !pending.some((entry) => entry.dispatchId === dispatch.id),
        ).length,
      }),
    );
    return result;
  }

  async rejectPendingDispatch(input: {
    dispatchId: string;
    code: string;
    message: string;
    retryable: boolean;
  }): Promise<boolean> {
    const pending = this.pendingDispatches.get(input.dispatchId);
    if (!pending) return false;

    await pending.sink.emit({
      type: "run.failed",
      dispatchId: input.dispatchId,
      code: input.code,
      message: input.message,
      retryable: input.retryable,
    });
    pending.terminal = true;
    this.pendingDispatches.delete(input.dispatchId);
    pending.resolve();
    return true;
  }

  async isDispatchInWorkspace(dispatchId: string, workspaceId: string) {
    const dispatch = await this.runtimeDispatchService.findById(dispatchId);
    return Boolean(dispatch && dispatch.workspaceId === workspaceId);
  }

  private isTerminalEvent(
    event: HermesBridgeInboundEvent,
  ): event is HermesBridgeTerminalEvent {
    return (
      event.type === "run.completed" ||
      event.type === "run.failed" ||
      event.type === "run.cancelled"
    );
  }
}
