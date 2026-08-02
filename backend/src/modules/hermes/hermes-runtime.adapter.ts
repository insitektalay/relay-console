import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AgentEntity } from "../../entities/agent.entity";
import { ManagedRuntimeEntity } from "../../entities";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";
import { RuntimeThreadSessionEntity } from "../../entities/runtime-thread-session.entity";
import { EventsGateway } from "../../gateways/events.gateway";
import { RuntimeAdapterRegistry } from "../runtime/runtime-adapter-registry.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { RuntimeDispatchService } from "../runtime/runtime-dispatch.service";
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
import { resolveHermesCapabilityProfile } from "./hermes-capability-profile";
import { HermesBridgeRuntimeService } from "./hermes-bridge-runtime.service";
import { filterDisabledHermesNativeTools } from "./hermes-native-tools";
import { HermesWorkerClient } from "./hermes-worker.client";
import { HermesWorkerEvent } from "./hermes-worker.types";
import { RailwayManagedRuntimeProvider } from "../runtime/railway-managed-runtime.provider";

const HERMES_BRIDGE_ADAPTER_KINDS = new Set(["bridge", "hermes_bridge"]);
const MARKETPLACE_TOOLS_BRIDGE_CAPABILITY = "clawchat.marketplace.tools";
const HERMES_BROWSER_TOOLSET = "browser";
const HERMES_BROWSER_CAPABILITIES = [
  "browser",
  "browserSupport",
  "browserTools",
  "toolset:browser",
  "hermes.toolset.browser",
  "clawchat.runtime.hermes.browser",
] as const;
const HERMES_BROWSER_TOOLS = [
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_vision",
] as const;
const LARGE_DISPATCH_METADATA_FIELDS = new Set([
  "marketplaceRuntimeContext",
  "marketplaceTools",
  "availableMarketplaceTools",
  "runtimeInstruction",
  "systemInstruction",
]);
const MARKETPLACE_CONTEXT_TOOL_FIELDS = new Set([
  "tools",
  "availableMarketplaceTools",
]);

@Injectable()
export class HermesRuntimeAdapter implements RuntimeAdapter, OnModuleInit {
  readonly type = "hermes" as const;
  private readonly logger = new Logger(HermesRuntimeAdapter.name);

  constructor(
    private readonly runtimeAdapterRegistry: RuntimeAdapterRegistry,
    private readonly runtimeBindingService: RuntimeBindingService,
    private readonly runtimeThreadSessionService: RuntimeThreadSessionService,
    private readonly runtimeDispatchService: RuntimeDispatchService,
    private readonly hermesWorkerClient: HermesWorkerClient,
    private readonly hermesBridgeRuntimeService: HermesBridgeRuntimeService,
    private readonly eventsGateway: EventsGateway,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(ManagedRuntimeEntity)
    private readonly managedRuntimes: Repository<ManagedRuntimeEntity>,
    private readonly managedRuntimeProvider: RailwayManagedRuntimeProvider,
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
      runtimeSessionId: this.isBridgeBinding(input.binding)
        ? `hermes:${input.agentId}:${input.threadSessionId}`
        : undefined,
      metadata: {
        hermesPath: this.isBridgeBinding(input.binding)
          ? "hermes_bridge"
          : "python_worker",
        decisionGate: "passed",
        workspaceKey: input.binding.repoKey ?? input.binding.agentId,
      },
    });
  }

  async dispatchTurn(
    input: RuntimeDispatchContext,
    sink: RuntimeEventSink,
  ): Promise<void> {
    const binding = await this.runtimeBindingService.findById(
      input.runtimeBindingId,
    );
    if (!binding) {
      throw new Error(
        `Hermes runtime binding not found for ${input.runtimeBindingId}`,
      );
    }

    if (this.isBridgeBinding(binding)) {
      await this.dispatchBridgeTurn(binding, input, sink);
      return;
    }

    const marketplaceTools = this.readMarketplaceTools(input.dispatchMetadata);
    const localAppRuntimeTools =
      this.readLocalAppRuntimeTools(marketplaceTools);
    const toolsetResolution = this.resolveToolsets(binding, {
      workspaceId: input.workspaceId,
      marketplaceTools,
      localAppRuntimeTools,
    });

    this.logCapabilityResolution("hermes.worker.dispatch.capabilities", {
      input,
      binding,
      toolsetResolution,
      marketplaceTools,
      localAppRuntimeTools,
    });

    const managedTarget = await this.managedTarget(binding.runtimeHostId);
    await this.hermesWorkerClient.streamRun(
      {
        dispatchId: input.dispatchId,
        runtimeSessionId: input.runtimeSessionId,
        inputText: input.inputText,
        workspaceKey: managedTarget?.workspaceKey ?? binding.agentId,
        model:
          typeof binding.configMetadata?.model === "string"
            ? binding.configMetadata.model
            : null,
        enabledToolsets: toolsetResolution.enabledToolsetsForHermes,
        disabledToolsets: toolsetResolution.disabledToolsetsForHermes,
        defaultSkills: this.parseStringList(
          binding.configMetadata,
          "defaultSkills",
        ),
        correlationId: input.correlationId,
        timeoutMs: input.timeoutMs,
        documentReferenceContract: RUNTIME_DOCUMENT_REFERENCE_CONTRACT,
        configMetadata: this.compactRuntimeConfigMetadata(
          binding.configMetadata,
        ),
        marketplaceRuntimeContext:
          input.dispatchMetadata?.marketplaceRuntimeContext,
        marketplaceTools,
        availableMarketplaceTools: marketplaceTools,
        responsePresentation:
          typeof input.dispatchMetadata?.responsePresentation === "string"
            ? input.dispatchMetadata.responsePresentation
            : undefined,
        expectedContentFormat:
          typeof input.dispatchMetadata?.expectedContentFormat === "string"
            ? input.dispatchMetadata.expectedContentFormat
            : undefined,
        responseContract:
          input.dispatchMetadata?.responseContract &&
          typeof input.dispatchMetadata.responseContract === "object"
            ? (input.dispatchMetadata.responseContract as Record<
                string,
                unknown
              >)
            : undefined,
        responseFormatContract:
          typeof input.dispatchMetadata?.responseFormatContract === "string"
            ? input.dispatchMetadata.responseFormatContract
            : undefined,
        runtimeInstruction:
          typeof input.dispatchMetadata?.runtimeInstruction === "string"
            ? input.dispatchMetadata.runtimeInstruction
            : undefined,
        systemInstruction:
          typeof input.dispatchMetadata?.systemInstruction === "string"
            ? input.dispatchMetadata.systemInstruction
            : undefined,
      },
      async (event) => {
        await sink.emit(this.normalizeWorkerEvent(event));
      },
      managedTarget ?? undefined,
    );
  }

  async cancelDispatch(input: {
    dispatchId: string;
    runtimeSessionId: string;
  }): Promise<void> {
    const pending = this.hermesBridgeRuntimeService.getPendingTarget(
      input.dispatchId,
    );
    if (pending) {
      this.eventsGateway.emitToHermesBridgeWorkspace(
        pending.workspaceId,
        "hermes.run.cancel",
        {
          dispatchId: input.dispatchId,
          runtimeSessionId: input.runtimeSessionId,
          externalAgentId: pending.externalAgentId,
        },
      );
      return;
    }

    const dispatch = await this.runtimeDispatchService.findById(
      input.dispatchId,
    );
    const managedTarget = dispatch
      ? await this.managedTarget(dispatch.runtimeHostId)
      : null;
    await this.hermesWorkerClient.cancelRun(
      input.dispatchId,
      managedTarget ?? undefined,
    );
  }

  async closeSession(_input: {
    runtimeSessionId: string;
    reason?: string;
  }): Promise<void> {
    // No runtime-side close behavior in the Phase 3 skeleton.
  }

  async getHealth(binding: RuntimeBindingEntity): Promise<RuntimeHealth> {
    if (!binding.isEnabled) {
      return {
        status: "unconfigured",
        checkedAt: new Date(),
        message: "Hermes runtime binding disabled",
      };
    }

    if (this.isBridgeBinding(binding)) {
      const agent = await this.agentRepo.findOne({
        where: { id: binding.agentId },
        select: ["id", "externalId"],
      });
      const externalId = agent?.externalId?.trim();
      if (!externalId) {
        return {
          status: "error",
          checkedAt: new Date(),
          message: "Hermes bridge agent is missing externalId",
        };
      }
      const runtime = this.eventsGateway.getWorkspaceHermesBridgeRuntime(
        binding.workspaceId,
      );
      const isLive = runtime.connectedBridgeDeviceCount > 0;
      return {
        status: isLive ? "ready" : "offline",
        checkedAt: new Date(),
        message: isLive
          ? "Hermes bridge runtime is connected for this workspace"
          : "Hermes bridge runtime is not currently connected for this workspace",
        metadata: {
          externalId,
          adapterKind: binding.adapterKind,
          connectedBridgeDeviceCount: runtime.connectedBridgeDeviceCount,
          liveRegisteredAgentCount: runtime.liveRegisteredAgentCount,
        },
      };
    }

    try {
      const health = await this.hermesWorkerClient.getHealth(
        (await this.managedTarget(binding.runtimeHostId)) ?? undefined,
      );
      return {
        status: "ready",
        checkedAt: new Date(),
        message: "Hermes worker reachable",
        metadata: {
          implementation: health.implementation,
          authEnabled: health.authEnabled,
          workspaceIsolation: health.workspaceIsolation,
          activeRuns: health.activeRuns,
          maxActiveRuns: health.maxActiveRuns,
        },
      };
    } catch (error) {
      return {
        status: "offline",
        checkedAt: new Date(),
        message:
          error instanceof Error ? error.message : "Hermes worker unreachable",
      };
    }
  }

  private async managedTarget(runtimeHostId: string | null) {
    if (!runtimeHostId) return null;
    const runtime = await this.managedRuntimes.findOne({
      where: { runtimeHostId },
    });
    return runtime ? this.managedRuntimeProvider.workerTarget(runtime) : null;
  }

  async getCapabilities(
    binding: RuntimeBindingEntity,
  ): Promise<RuntimeCapabilities> {
    const browserSupport = this.bindingAllowsBrowserSupport(binding);
    return {
      streamText: true,
      cancelRun: true,
      resumeSession: true,
      toolActivity: "coarse",
      workspaceExecution: true,
      bridgeBacked: this.isBridgeBinding(binding),
      requiresExternalRuntimePresence: true,
      structuredJobs:
        binding.capabilities?.structuredJobs === true ||
        binding.capabilities?.[RUNTIME_STRUCTURED_JOB_CAPABILITY] === true,
      structuredOutput:
        binding.capabilities?.structuredOutput === true ||
        binding.capabilities?.[RUNTIME_STRUCTURED_OUTPUT_CAPABILITY] === true,
      ...(binding.capabilities ?? {}),
      browserSupport,
      browserToolset: browserSupport ? HERMES_BROWSER_TOOLSET : undefined,
      browserTools: browserSupport ? [...HERMES_BROWSER_TOOLS] : [],
    } as RuntimeCapabilities;
  }

  private async dispatchBridgeTurn(
    binding: RuntimeBindingEntity,
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
        code: "hermes_external_id_missing",
        message: "Hermes bridge agent is missing an external runtime id",
        retryable: false,
      });
      return;
    }

    const runtime = this.eventsGateway.getWorkspaceHermesBridgeRuntime(
      input.workspaceId,
    );
    if (runtime.connectedBridgeDeviceCount === 0) {
      await sink.emit({
        type: "run.failed",
        dispatchId: input.dispatchId,
        code: "hermes_runtime_offline",
        message: "Hermes bridge is not connected for this workspace right now",
        retryable: true,
      });
      return;
    }
    if (!runtime.liveRegisteredExternalAgentIds.includes(targetExternalId)) {
      await sink.emit({
        type: "run.failed",
        dispatchId: input.dispatchId,
        code: "hermes_agent_not_live",
        message: `Hermes bridge is connected, but agent ${targetExternalId} is not currently live`,
        retryable: true,
      });
      return;
    }

    const marketplaceTools = this.readMarketplaceTools(input.dispatchMetadata);
    const executableMarketplaceTools = marketplaceTools.filter(
      (tool) =>
        !(
          tool.execution &&
          typeof tool.execution === "object" &&
          (tool.execution as Record<string, unknown>).descriptorOnly === true
        ),
    );
    if (
      executableMarketplaceTools.length > 0 &&
      !this.eventsGateway.hasHermesBridgeWorkspaceCapability(
        input.workspaceId,
        MARKETPLACE_TOOLS_BRIDGE_CAPABILITY,
      )
    ) {
      await sink.emit({
        type: "run.failed",
        dispatchId: input.dispatchId,
        code: "hermes_marketplace_tools_unavailable",
        message: `Hermes bridge is connected, but it does not advertise ${MARKETPLACE_TOOLS_BRIDGE_CAPABILITY}. Update/restart the Hermes bridge so it can expose marketplace tools such as x.getMe and x.getUserTweets.`,
        retryable: true,
      });
      return;
    }

    const localAppRuntimeTools =
      this.readLocalAppRuntimeTools(marketplaceTools);
    const toolsetResolution = this.resolveToolsets(binding, {
      workspaceId: input.workspaceId,
      marketplaceTools,
      localAppRuntimeTools,
    });
    if (toolsetResolution.replaceBaseHarness) {
      await sink.emit({
        type: "run.failed",
        dispatchId: input.dispatchId,
        code: "hermes_base_harness_replacement_requested",
        message:
          "ClawChat refused to dispatch Hermes with replaceBaseHarness=true. Hermes agents must preserve the native base harness unless an explicit audited runtime policy handles the restriction.",
        retryable: false,
      });
      return;
    }

    const browserSupport = this.bindingAllowsBrowserSupport(
      binding,
      input.workspaceId,
    );

    this.logCapabilityResolution("hermes.bridge.dispatch.capabilities", {
      input,
      binding,
      toolsetResolution,
      marketplaceTools,
      localAppRuntimeTools,
      externalAgentId: targetExternalId,
    });

    const compactMarketplaceRuntimeContext =
      this.compactMarketplaceRuntimeContext(
        input.dispatchMetadata?.marketplaceRuntimeContext,
        marketplaceTools,
      );
    const compactDispatchMetadata = this.compactDispatchMetadata(
      input.dispatchMetadata,
    );
    const compactTopLevelMetadata = this.compactTopLevelDispatchMetadata(
      input.dispatchMetadata,
    );
    const availableRuntimeTools = [
      ...filterDisabledHermesNativeTools(
        toolsetResolution.disabledToolsetsForHermes,
      ),
      ...(browserSupport ? [...HERMES_BROWSER_TOOLS] : []),
      ...localAppRuntimeTools,
    ];
    const payload = {
      dispatchId: input.dispatchId,
      runtimeSessionId: input.runtimeSessionId,
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      messageId: input.messageId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      externalAgentId: targetExternalId,
      inputText: input.inputText,
      content: input.inputText,
      recentMessages: input.recentMessages,
      workspaceKey: binding.repoKey ?? binding.agentId,
      model:
        typeof binding.configMetadata?.model === "string"
          ? binding.configMetadata.model
          : null,
      enabledToolsets: toolsetResolution.enabledToolsetsForHermes,
      enabled_toolsets: toolsetResolution.enabledToolsetsForHermes,
      toolsets: toolsetResolution.enabledToolsetsForHermes,
      disabledToolsets: toolsetResolution.disabledToolsetsForHermes,
      disabled_toolsets: toolsetResolution.disabledToolsetsForHermes,
      runtimeToolsets: {
        enabled: toolsetResolution.enabledToolsetsForHermes,
        additive: toolsetResolution.additiveToolsets,
        disabled: toolsetResolution.disabledToolsetsForHermes,
        profile: toolsetResolution.profile,
        replaceBaseHarness: toolsetResolution.replaceBaseHarness,
        baseHarnessPreserved: toolsetResolution.baseHarnessPreserved,
      },
      defaultSkills: this.parseStringList(
        binding.configMetadata,
        "defaultSkills",
      ),
      correlationId: input.correlationId,
      timeoutMs: input.timeoutMs,
      documentReferenceContract: RUNTIME_DOCUMENT_REFERENCE_CONTRACT,
      configMetadata: this.compactRuntimeConfigMetadata(
        binding.configMetadata,
      ),
      dispatchMetadata: compactDispatchMetadata,
      runtimeCapabilities: {
        browserSupport,
        browserToolset: browserSupport ? HERMES_BROWSER_TOOLSET : null,
        browserTools: browserSupport ? [...HERMES_BROWSER_TOOLS] : [],
        nativeBaseHarnessPreserved: toolsetResolution.baseHarnessPreserved,
        nativeBaseHarnessTools: filterDisabledHermesNativeTools(
          toolsetResolution.disabledToolsetsForHermes,
        ),
      },
      availableRuntimeTools,
      marketplaceRuntimeContext: compactMarketplaceRuntimeContext,
      marketplaceTools,
      ...compactTopLevelMetadata,
    };

    this.logDispatchPayloadSize(payload);
    await this.runtimeDispatchService.recordBridgeBackfillPayload(
      input.dispatchId,
      {
        runtimeType: "hermes",
        externalAgentId: targetExternalId,
        registeredAt: new Date().toISOString(),
        payload,
      },
    );

    const terminalPromise = this.hermesBridgeRuntimeService.waitForTerminal({
      dispatchId: input.dispatchId,
      workspaceId: input.workspaceId,
      externalAgentId: targetExternalId,
      sink,
      dispatchPayload: payload,
    });

    this.eventsGateway.emitToHermesBridgeAgents(
      input.workspaceId,
      [targetExternalId],
      "hermes.run.dispatch",
      payload,
    );

    await terminalPromise;
  }

  private compactDispatchMetadata(
    metadata: Record<string, unknown> | undefined,
  ) {
    if (!metadata) return {};
    return Object.fromEntries(
      Object.entries(metadata).filter(
        ([key]) => !LARGE_DISPATCH_METADATA_FIELDS.has(key),
      ),
    );
  }

  private compactRuntimeConfigMetadata(
    metadata: Record<string, unknown> | null | undefined,
  ) {
    const compact = { ...(metadata ?? {}) };
    delete compact.workspaceRoot;
    delete compact.repoPath;
    delete compact.cwd;
    return compact;
  }

  private compactTopLevelDispatchMetadata(
    metadata: Record<string, unknown> | undefined,
  ) {
    if (!metadata) return {};
    const compact = { ...metadata };
    delete compact.marketplaceRuntimeContext;
    delete compact.marketplaceTools;
    delete compact.availableMarketplaceTools;
    if (
      typeof compact.runtimeInstruction === "string" &&
      compact.runtimeInstruction === compact.systemInstruction
    ) {
      delete compact.systemInstruction;
    }
    return compact;
  }

  private compactMarketplaceRuntimeContext(
    context: unknown,
    marketplaceTools: Array<Record<string, unknown>>,
  ) {
    if (!context || typeof context !== "object" || Array.isArray(context)) {
      return context;
    }
    const compact = Object.fromEntries(
      Object.entries(context as Record<string, unknown>).filter(
        ([key]) => !MARKETPLACE_CONTEXT_TOOL_FIELDS.has(key),
      ),
    ) as Record<string, unknown>;
    compact.toolCount = marketplaceTools.length;
    compact.toolNames = marketplaceTools
      .map(
        (tool) =>
          this.objectString(tool, "name") ??
          this.objectString(tool, "functionName"),
      )
      .filter(Boolean);

    if (Array.isArray(compact.installedApplications)) {
      compact.installedApplications = compact.installedApplications.map(
        (application) => {
          if (
            !application ||
            typeof application !== "object" ||
            Array.isArray(application)
          ) {
            return application;
          }
          const copy = { ...(application as Record<string, unknown>) };
          delete copy.connectorTools;
          return copy;
        },
      );
    }

    return compact;
  }

  private logDispatchPayloadSize(payload: Record<string, unknown>) {
    const sectionBytes = (value: unknown) =>
      Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
    const recentMessages = Array.isArray(payload.recentMessages)
      ? payload.recentMessages
      : [];
    const marketplaceTools = Array.isArray(payload.marketplaceTools)
      ? payload.marketplaceTools
      : [];
    const recentMessageChars = recentMessages.reduce((total, message) => {
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        return total;
      }
      const content = (message as Record<string, unknown>).content;
      return total + (typeof content === "string" ? content.length : 0);
    }, 0);

    this.logger.log(
      JSON.stringify({
        event: "hermes.bridge.dispatch.payload_size",
        dispatchId: payload.dispatchId,
        workspaceId: payload.workspaceId,
        agentId: payload.agentId,
        externalAgentId: payload.externalAgentId,
        runtimeSessionId: payload.runtimeSessionId,
        workspaceKey: payload.workspaceKey,
        runtimeToolsets: payload.runtimeToolsets,
        replaceBaseHarness:
          typeof payload.runtimeToolsets === "object" &&
          payload.runtimeToolsets !== null &&
          !Array.isArray(payload.runtimeToolsets)
            ? (payload.runtimeToolsets as Record<string, unknown>)
                .replaceBaseHarness
            : null,
        enabledToolsets: payload.enabledToolsets ?? null,
        disabledToolsets: payload.disabledToolsets ?? null,
        defaultSkills: payload.defaultSkills ?? [],
        baseHarnessPreserved:
          typeof payload.runtimeToolsets === "object" &&
          payload.runtimeToolsets !== null &&
          !Array.isArray(payload.runtimeToolsets)
            ? (payload.runtimeToolsets as Record<string, unknown>)
                .baseHarnessPreserved
            : null,
        stateless: payload.stateless ?? null,
        ephemeral: payload.ephemeral ?? null,
        skipMemory: payload.skipMemory ?? payload.skip_memory ?? null,
        serializedBytes: sectionBytes(payload),
        sectionBytes: {
          recentMessages: sectionBytes(payload.recentMessages),
          dispatchMetadata: sectionBytes(payload.dispatchMetadata),
          marketplaceRuntimeContext: sectionBytes(
            payload.marketplaceRuntimeContext,
          ),
          marketplaceTools: sectionBytes(payload.marketplaceTools),
          runtimeInstruction: sectionBytes(payload.runtimeInstruction),
          systemInstruction: sectionBytes(payload.systemInstruction),
          runtimeCapabilities: sectionBytes(payload.runtimeCapabilities),
          runtimeToolsets: sectionBytes(payload.runtimeToolsets),
        },
        recentMessages: {
          count: recentMessages.length,
          contentChars: recentMessageChars,
        },
        marketplaceTools: {
          count: marketplaceTools.length,
          descriptorBytes: sectionBytes(marketplaceTools),
          names: marketplaceTools
            .map((tool) =>
              tool && typeof tool === "object" && !Array.isArray(tool)
                ? (this.objectString(tool as Record<string, unknown>, "name") ??
                  this.objectString(
                    tool as Record<string, unknown>,
                    "functionName",
                  ))
                : null,
            )
            .filter(Boolean),
        },
      }),
    );
  }

  private isBridgeBinding(binding: RuntimeBindingEntity) {
    return HERMES_BRIDGE_ADAPTER_KINDS.has(
      binding.adapterKind?.trim().toLowerCase(),
    );
  }

  private parseToolsets(
    configMetadata: Record<string, unknown> | null | undefined,
    key: "enabledToolsets" | "disabledToolsets",
    fallback: string[] = [],
  ): string[] {
    return this.parseStringList(configMetadata, key, fallback);
  }

  private resolveToolsets(
    binding: RuntimeBindingEntity,
    input: {
      workspaceId?: string;
      marketplaceTools: Array<Record<string, unknown>>;
      localAppRuntimeTools: string[];
    },
  ) {
    return resolveHermesCapabilityProfile({
      configMetadata: binding.configMetadata,
      capabilities: binding.capabilities,
      rawEnabledToolsets: this.parseToolsets(
        binding.configMetadata,
        "enabledToolsets",
      ),
      rawDisabledToolsets: this.parseToolsets(
        binding.configMetadata,
        "disabledToolsets",
      ),
      browserSupport: this.bindingAllowsBrowserSupport(
        binding,
        input.workspaceId,
      ),
      marketplaceToolNames: input.marketplaceTools.map(
        (tool) =>
          this.objectString(tool, "name") ??
          this.objectString(tool, "functionName") ??
          "unknown",
      ),
      localAppRuntimeToolNames: input.localAppRuntimeTools,
    });
  }

  private bindingAllowsBrowserSupport(
    binding: RuntimeBindingEntity,
    workspaceId?: string,
  ): boolean {
    if (this.browserSupportIsExplicitlyDisabled(binding)) {
      return false;
    }

    const configEnabledToolsets = this.parseToolsets(
      binding.configMetadata,
      "enabledToolsets",
    );
    if (configEnabledToolsets.includes(HERMES_BROWSER_TOOLSET)) {
      return true;
    }

    if (
      this.recordHasAnyTrueCapability(
        binding.capabilities,
        HERMES_BROWSER_CAPABILITIES,
      ) ||
      this.recordHasAnyTrueCapability(
        binding.configMetadata,
        HERMES_BROWSER_CAPABILITIES,
      )
    ) {
      return true;
    }

    if (this.isBridgeBinding(binding)) {
      return true;
    }

    return Boolean(
      workspaceId &&
      HERMES_BROWSER_CAPABILITIES.some((capability) =>
        this.eventsGateway.hasHermesBridgeWorkspaceCapability?.(
          workspaceId,
          capability,
        ),
      ),
    );
  }

  private browserSupportIsExplicitlyDisabled(binding: RuntimeBindingEntity) {
    const disabledToolsets = this.parseToolsets(
      binding.configMetadata,
      "disabledToolsets",
    );
    return (
      disabledToolsets.includes(HERMES_BROWSER_TOOLSET) ||
      binding.capabilities?.browserDisabled === true ||
      binding.capabilities?.browserSupportDisabled === true ||
      binding.configMetadata?.browserDisabled === true ||
      binding.configMetadata?.browserSupportDisabled === true
    );
  }

  private recordHasAnyTrueCapability(
    record: Record<string, unknown> | null | undefined,
    capabilities: readonly string[],
  ) {
    return capabilities.some((capability) => record?.[capability] === true);
  }

  private readMarketplaceTools(dispatchMetadata?: Record<string, unknown>) {
    const context = dispatchMetadata?.marketplaceRuntimeContext;
    if (!context || typeof context !== "object" || Array.isArray(context)) {
      return [];
    }
    const tools = (context as { tools?: unknown }).tools;
    return Array.isArray(tools)
      ? tools.filter((tool): tool is Record<string, unknown> =>
          Boolean(tool && typeof tool === "object" && !Array.isArray(tool)),
        )
      : [];
  }

  private readLocalAppRuntimeTools(tools: Array<Record<string, unknown>>) {
    return tools
      .map(
        (tool) =>
          this.objectString(tool, "name") ??
          this.objectString(tool, "functionName"),
      )
      .filter((name): name is string =>
        Boolean(name && name.startsWith("localApp.")),
      );
  }

  private logCapabilityResolution(
    event: string,
    input: {
      input: RuntimeDispatchContext;
      binding: RuntimeBindingEntity;
      toolsetResolution: ReturnType<typeof resolveHermesCapabilityProfile>;
      marketplaceTools: Array<Record<string, unknown>>;
      localAppRuntimeTools: string[];
      externalAgentId?: string;
    },
  ) {
    this.logger.log(
      JSON.stringify({
        event,
        dispatchId: input.input.dispatchId,
        workspaceId: input.input.workspaceId,
        agentId: input.input.agentId,
        runtimeBindingId: input.binding.id,
        runtimeType: input.binding.runtimeType,
        adapterKind: input.binding.adapterKind,
        externalAgentId: input.externalAgentId ?? null,
        selectedCapabilityProfile: input.toolsetResolution.profile,
        rawEnabledToolsets: input.toolsetResolution.rawEnabledToolsets,
        rawDisabledToolsets: input.toolsetResolution.rawDisabledToolsets,
        additiveToolsets: input.toolsetResolution.additiveToolsets,
        finalEnabledToolsetsSentToHermes:
          input.toolsetResolution.enabledToolsetsForHermes ?? null,
        finalDisabledToolsetsSentToHermes:
          input.toolsetResolution.disabledToolsetsForHermes,
        finalResolvedToolManifest:
          input.toolsetResolution.finalResolvedToolManifest,
        replaceBaseHarness: input.toolsetResolution.replaceBaseHarness,
        baseHarnessPreserved: input.toolsetResolution.baseHarnessPreserved,
        toolCount: input.marketplaceTools.length,
        toolNames: input.marketplaceTools.map(
          (tool) =>
            this.objectString(tool, "name") ??
            this.objectString(tool, "functionName") ??
            "unknown",
        ),
        localAppRuntimeToolNames: input.localAppRuntimeTools,
        localappconnectorAgentApi: this.localAppConnectorAgentApiDiagnostics(
          input.marketplaceTools,
        ),
      }),
    );
  }

  private objectString(object: Record<string, unknown>, key: string) {
    const value = object[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private localAppConnectorAgentApiDiagnostics(tools: Array<Record<string, unknown>>) {
    const tool = tools.find((candidate) => {
      const name =
        this.objectString(candidate, "name") ??
        this.objectString(candidate, "functionName");
      return name === "localappconnector.agentApi" || name === "localappconnector_agent_api";
    });
    if (!tool) {
      return {
        descriptorSent: false,
        bearerConfigured: false,
        credentialAttached: false,
      };
    }
    const credential =
      tool.credential &&
      typeof tool.credential === "object" &&
      !Array.isArray(tool.credential)
        ? (tool.credential as Record<string, unknown>)
        : {};
    const execution =
      tool.execution &&
      typeof tool.execution === "object" &&
      !Array.isArray(tool.execution)
        ? (tool.execution as Record<string, unknown>)
        : {};
    return {
      descriptorSent: true,
      bearerConfigured: credential.bearerConfigured === true,
      credentialAttached:
        execution.credentialAttachment === "server_side_bearer_proxy" ||
        execution.transport === "clawchat_bridge_marketplace_tool",
      secretMaterialSentToHermes:
        credential.secretMaterialSentToHermes === true,
    };
  }

  private parseStringList(
    configMetadata: Record<string, unknown> | null | undefined,
    key: string,
    fallback: string[] = [],
  ): string[] {
    const raw = configMetadata?.[key];
    if (!Array.isArray(raw)) {
      return fallback;
    }

    return raw
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private normalizeWorkerEvent(event: HermesWorkerEvent) {
    switch (event.type) {
      case "dispatch.accepted":
        return {
          type: "dispatch.accepted" as const,
          dispatchId: event.dispatchId,
          runtimeRunId: event.runtimeRunId,
          metadata: event.metadata,
        };
      case "run.started":
        return {
          type: "run.started" as const,
          dispatchId: event.dispatchId,
          runtimeRunId: event.runtimeRunId,
        };
      case "run.delta":
      case "run.status":
      case "run.tool":
      case "run.context":
      case "run.completed":
      case "run.failed":
      case "run.cancelled":
        return event;
    }
  }
}
