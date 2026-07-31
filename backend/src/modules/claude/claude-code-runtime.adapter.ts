import { Injectable, OnModuleInit } from "@nestjs/common";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";
import { RuntimeThreadSessionEntity } from "../../entities/runtime-thread-session.entity";
import { RuntimeAdapterRegistry } from "../runtime/runtime-adapter-registry.service";
import { RuntimeThreadSessionService } from "../runtime/runtime-thread-session.service";
import {
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeDispatchContext,
  RuntimeEventSink,
  RuntimeHealth,
} from "../runtime/runtime.types";

@Injectable()
export class ClaudeCodeRuntimeAdapter implements RuntimeAdapter, OnModuleInit {
  readonly type = "claude_code" as const;

  constructor(
    private readonly runtimeAdapterRegistry: RuntimeAdapterRegistry,
    private readonly runtimeThreadSessionService: RuntimeThreadSessionService,
  ) {}

  onModuleInit(): void {
    this.runtimeAdapterRegistry.register(this);
  }

  async resolveSession(input: {
    binding: RuntimeBindingEntity;
    threadId: string;
    threadSessionId: string;
    agentId: string;
  }): Promise<RuntimeThreadSessionEntity> {
    return this.runtimeThreadSessionService.ensure({
      workspaceId: input.binding.workspaceId,
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      agentId: input.agentId,
      runtimeBindingId: input.binding.id,
      metadata: {
        compatibilityMode: "claude_bridge_callbacks",
      },
    });
  }

  async dispatchTurn(
    _input: RuntimeDispatchContext,
    _sink: RuntimeEventSink,
  ): Promise<void> {
    throw new Error(
      "ClaudeCodeRuntimeAdapter dispatchTurn is not used in Phase 2 compatibility mode",
    );
  }

  async cancelDispatch(_input: {
    dispatchId: string;
    runtimeSessionId: string;
  }): Promise<void> {
    throw new Error(
      "ClaudeCodeRuntimeAdapter cancelDispatch is not implemented in Phase 2 compatibility mode",
    );
  }

  async closeSession(_input: {
    runtimeSessionId: string;
    reason?: string;
  }): Promise<void> {
    // Compatibility mode does not yet support explicit runtime-side close.
  }

  async getHealth(binding: RuntimeBindingEntity): Promise<RuntimeHealth> {
    return {
      status: binding.isEnabled ? "ready" : "unconfigured",
      checkedAt: new Date(),
      message: binding.isEnabled
        ? "Claude bridge runtime compatibility path configured"
        : "Claude runtime binding disabled",
    };
  }

  async getCapabilities(
    binding: RuntimeBindingEntity,
  ): Promise<RuntimeCapabilities> {
    return (binding.capabilities ?? {}) as RuntimeCapabilities;
  }
}
