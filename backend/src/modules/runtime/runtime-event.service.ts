import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { EventsGateway } from "../../gateways/events.gateway";
import {
  RuntimeContextReference,
  RuntimeDispatchQueuedPayload,
  RuntimeParticipantHealthPayload,
  RuntimeTodoTask,
} from "./runtime.types";

@Injectable()
export class RuntimeEventService {
  constructor(
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {}

  async emitDispatchQueued(
    payload: RuntimeDispatchQueuedPayload,
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.dispatch.queued",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitDispatchStarted(
    payload: RuntimeDispatchQueuedPayload,
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.dispatch.started",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitDispatchCompleted(
    payload: RuntimeDispatchQueuedPayload & {
      postedMessageId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.dispatch.completed",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitDispatchFailed(
    payload: RuntimeDispatchQueuedPayload & {
      code: string;
      message: string;
      retryable: boolean;
    },
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.dispatch.failed",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitDispatchCancelled(
    payload: RuntimeDispatchQueuedPayload,
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.dispatch.cancelled",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitRunDelta(
    payload: RuntimeDispatchQueuedPayload & {
      seq: number;
      text: string;
    },
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.run.delta",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitRunThinking(
    payload: RuntimeDispatchQueuedPayload & {
      seq: number;
      thinking: string;
      kind?: "thinking" | "reasoning";
    },
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.run.thinking",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitRunStatus(
    payload: RuntimeDispatchQueuedPayload & {
      code: string;
      message: string;
    },
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.run.status",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitRunTool(
    payload: RuntimeDispatchQueuedPayload & {
      toolName: string;
      phase: "started" | "updated" | "completed";
      summary?: string;
      tasks?: RuntimeTodoTask[];
    },
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.run.tool",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitRunContext(
    payload: RuntimeDispatchQueuedPayload & {
      totalTokens: number | null;
      contextTokens: number | null;
      percentUsed: number | null;
      level: "unknown" | "ok" | "warn" | "critical" | "overflow";
      fresh: boolean;
      sessionId?: string;
      model?: string;
      modelProvider?: string;
      references?: RuntimeContextReference[];
    },
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.run.context",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }

  async emitParticipantHealth(
    payload: RuntimeParticipantHealthPayload,
  ): Promise<void> {
    this.eventsGateway.emitToScopes(
      {
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
      },
      "runtime.participant.health",
      payload,
    );
    await this.eventsGateway.emitAgentOpsLiveStateUpdateForAgent(
      payload.workspaceId,
      payload.agentId,
    );
  }
}
