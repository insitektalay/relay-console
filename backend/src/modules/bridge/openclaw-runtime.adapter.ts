import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Like, Repository } from "typeorm";
import { AgentEntity } from "../../entities/agent.entity";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";
import { RuntimeThreadSessionEntity } from "../../entities/runtime-thread-session.entity";
import { EventsGateway } from "../../gateways/events.gateway";
import { RuntimeAdapterRegistry } from "../runtime/runtime-adapter-registry.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { RuntimeThreadSessionService } from "../runtime/runtime-thread-session.service";
import {
  RUNTIME_DOCUMENT_REFERENCE_CONTRACT,
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeDispatchContext,
  RuntimeEventSink,
  RuntimeHealth,
} from "../runtime/runtime.types";
import {
  RUNTIME_STRUCTURED_JOB_CAPABILITY,
  RUNTIME_STRUCTURED_OUTPUT_CAPABILITY,
} from "../runtime/runtime-structured-job.service";

const OPENCLAW_RUNTIME_TYPE = "openclaw";
const OPENCLAW_ADAPTER_KIND = "bridge_ws";

@Injectable()
export class OpenClawRuntimeAdapter implements RuntimeAdapter, OnModuleInit {
  readonly type = "openclaw" as const;

  private readonly logger = new Logger(OpenClawRuntimeAdapter.name);

  constructor(
    private readonly runtimeAdapterRegistry: RuntimeAdapterRegistry,
    private readonly runtimeBindingService: RuntimeBindingService,
    private readonly runtimeThreadSessionService: RuntimeThreadSessionService,
    private readonly eventsGateway: EventsGateway,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.runtimeAdapterRegistry.register(this);
    await this.backfillOpenClawBindings();
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
      runtimeSessionId: `${OPENCLAW_RUNTIME_TYPE}:${input.agentId}:${input.threadSessionId}`,
      metadata: {
        compatibilityMode: "openclaw_bridge_transport",
      },
    });
  }

  async dispatchTurn(
    input: RuntimeDispatchContext,
    sink: RuntimeEventSink,
  ): Promise<void> {
    const targetExternalId =
      typeof input.dispatchMetadata?.targetExternalId === "string"
        ? input.dispatchMetadata.targetExternalId.trim()
        : "";

    if (!targetExternalId) {
      await sink.emit({
        type: "run.failed",
        dispatchId: input.dispatchId,
        code: "openclaw_external_id_missing",
        message: "OpenClaw agent is missing an external runtime id",
        retryable: false,
      });
      return;
    }

    const runtime = this.eventsGateway.getWorkspaceBridgeRuntime(
      input.workspaceId,
    );
    const targetIsLive =
      runtime.liveRegisteredExternalAgentIds.includes(targetExternalId);
    if (!targetIsLive) {
      await sink.emit({
        type: "run.failed",
        dispatchId: input.dispatchId,
        code:
          runtime.connectedBridgeDeviceCount > 0
            ? "openclaw_agent_not_live"
            : "openclaw_runtime_offline",
        message:
          runtime.connectedBridgeDeviceCount > 0
            ? `OpenClaw is connected, but agent ${targetExternalId} is not currently live`
            : "OpenClaw is not connected for this workspace right now",
        retryable: true,
      });
      return;
    }

    await sink.emit({
      type: "dispatch.accepted",
      dispatchId: input.dispatchId,
      runtimeRunId: input.dispatchId,
    });

    const payload = {
      ...(input.dispatchMetadata ?? {}),
      dispatchId: input.dispatchId,
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      messageId: input.messageId,
      content: input.inputText,
      workspaceId: input.workspaceId,
      recentMessages: input.recentMessages,
      externalAgentId: targetExternalId,
      runtimeHostId: input.runtimeHostId,
      assignmentEpoch: input.assignmentEpoch,
      documentReferenceContract: RUNTIME_DOCUMENT_REFERENCE_CONTRACT,
    };

    this.eventsGateway.emitToBridgeAgents(
      input.workspaceId,
      [targetExternalId],
      "agent.dispatch",
      payload,
    );
  }

  async cancelDispatch(input: {
    dispatchId: string;
    runtimeSessionId: string;
  }): Promise<void> {
    const [, agentId] = input.runtimeSessionId.split(":");
    if (!agentId) return;
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    const externalAgentId = agent?.externalId?.trim();
    if (!agent || !externalAgentId) return;
    this.eventsGateway.emitToBridgeAgents(
      agent.workspaceId,
      [externalAgentId],
      "runtime.dispatch.cancel",
      {
        dispatchId: input.dispatchId,
        runtimeSessionId: input.runtimeSessionId,
        externalAgentId,
      },
    );
  }

  async closeSession(_input: {
    runtimeSessionId: string;
    reason?: string;
  }): Promise<void> {
    // No runtime-side close behavior for bridge-backed OpenClaw sessions.
  }

  async getHealth(binding: RuntimeBindingEntity): Promise<RuntimeHealth> {
    const agent = await this.agentRepo.findOne({
      where: { id: binding.agentId },
    });

    if (!binding.isEnabled) {
      return {
        status: "unconfigured",
        checkedAt: new Date(),
        message: "OpenClaw runtime binding disabled",
      };
    }

    if (!agent?.externalId) {
      return {
        status: "error",
        checkedAt: new Date(),
        message: "OpenClaw agent is missing externalId",
      };
    }

    const runtime = this.eventsGateway.getWorkspaceBridgeRuntime(
      binding.workspaceId,
    );
    const isLive = runtime.liveRegisteredExternalAgentIds.includes(
      agent.externalId,
    );

    return {
      status: isLive ? "ready" : "offline",
      checkedAt: new Date(),
      message: isLive
        ? "OpenClaw bridge agent is connected"
        : "OpenClaw bridge agent is not currently connected",
      metadata: {
        externalId: agent.externalId,
        liveRegisteredAgentCount: runtime.liveRegisteredAgentCount,
      },
    };
  }

  async getCapabilities(
    binding: RuntimeBindingEntity,
  ): Promise<RuntimeCapabilities> {
    return {
      streamText: false,
      resumeSession: false,
      toolActivity: "none",
      bridgeBacked: true,
      requiresExternalRuntimePresence: true,
      structuredJobs: binding.capabilities?.structuredJobs === true,
      structuredOutput: binding.capabilities?.structuredOutput === true,
      ...(binding.capabilities ?? {}),
      cancelRun: true,
    } as RuntimeCapabilities;
  }

  private async backfillOpenClawBindings(): Promise<void> {
    const agents = await this.agentRepo.find({
      where: [
        { source: OPENCLAW_RUNTIME_TYPE },
        { description: Like("%External ID:%") },
      ],
    });
    let normalizedAgentCount = 0;
    let upsertedBindingCount = 0;

    for (const agent of agents) {
      if (!agent.workspaceId) {
        continue;
      }

      const legacyExternalId = this.extractLegacyExternalId(agent.description);
      const canNormalizeLegacyDescription =
        Boolean(legacyExternalId) &&
        (!agent.source || ["manual", "external"].includes(agent.source));
      if (
        agent.source !== OPENCLAW_RUNTIME_TYPE &&
        !canNormalizeLegacyDescription
      ) {
        continue;
      }
      const normalizedExternalId = agent.externalId?.trim() || legacyExternalId;
      const normalizedSource =
        agent.source === OPENCLAW_RUNTIME_TYPE || canNormalizeLegacyDescription
          ? OPENCLAW_RUNTIME_TYPE
          : agent.source;

      if (
        normalizedExternalId !== (agent.externalId ?? null) ||
        normalizedSource !== agent.source ||
        (normalizedExternalId && agent.provisioningStatus !== "ready")
      ) {
        await this.agentRepo.update(agent.id, {
          externalId: normalizedExternalId,
          source: normalizedSource,
          provisioningStatus: normalizedExternalId
            ? "ready"
            : agent.provisioningStatus,
        });
        agent.externalId = normalizedExternalId;
        agent.source = normalizedSource;
        agent.provisioningStatus = normalizedExternalId
          ? "ready"
          : agent.provisioningStatus;
        normalizedAgentCount += 1;
      }

      try {
        await this.runtimeBindingService.upsertByAgentId(agent.id, {
          workspaceId: agent.workspaceId,
          runtimeType: OPENCLAW_RUNTIME_TYPE,
          adapterKind: OPENCLAW_ADAPTER_KIND,
          routingMode: "default_target",
          isEnabled: Boolean(agent.externalId),
          healthStatus: agent.externalId ? "ready" : "unconfigured",
          capabilities: this.getDefaultCapabilities(),
          configMetadata: {
            compatibilitySource: legacyExternalId
              ? "openclaw_legacy_agent_normalization"
              : "openclaw_agent_backfill",
          },
        });
        upsertedBindingCount += 1;
      } catch (error) {
        this.logger.warn(
          `Failed to backfill OpenClaw runtime binding for agent ${agent.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (normalizedAgentCount || upsertedBindingCount) {
      this.logger.log(
        `OpenClaw startup repair normalized ${normalizedAgentCount} legacy agent(s) and upserted ${upsertedBindingCount} runtime binding(s)`,
      );
    }
  }

  private getDefaultCapabilities(): RuntimeCapabilities {
    return {
      streamText: false,
      cancelRun: false,
      resumeSession: false,
      toolActivity: "none",
      bridgeBacked: true,
      requiresExternalRuntimePresence: true,
      [RUNTIME_STRUCTURED_JOB_CAPABILITY]: false,
      [RUNTIME_STRUCTURED_OUTPUT_CAPABILITY]: false,
    };
  }

  private extractLegacyExternalId(description?: string | null): string | null {
    const match = description?.match(/External ID:\s*(\S+)/i);
    return match?.[1]?.trim() || null;
  }
}
