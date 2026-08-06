import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BridgeAuthenticated } from "../../common/decorators/public.decorator";
import {
  LinkedApplicationEntity,
  MarketplaceInstallEntity,
  RuntimeDispatchEntity,
} from "../../entities";
import { BridgeService } from "../bridge/bridge.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { MessageService } from "../message/message.service";
import { MarketplaceConnectorExecutionService } from "./connectors/connector-execution.service";
import { ConnectorExecutionError } from "./connectors/execution/connector-execution.error";
import { resolveLocalAppRuntimeProfile } from "./local-app-runtime-profile";

const MARKETPLACE_RUNTIME_TOOL_RATE_LIMIT = {
  default: { limit: 60, ttl: 60_000 },
};

@Throttle(MARKETPLACE_RUNTIME_TOOL_RATE_LIMIT)
@BridgeAuthenticated()
@Controller("bridge/runtime-dispatches/:dispatchId/marketplace-tools")
export class LocalAppConnectorAgentApiBridgeToolsController {
  private readonly logger = new Logger(
    LocalAppConnectorAgentApiBridgeToolsController.name,
  );

  constructor(
    private readonly bridgeService: BridgeService,
    @InjectRepository(RuntimeDispatchEntity)
    private readonly runtimeDispatchRepo: Repository<RuntimeDispatchEntity>,
    @InjectRepository(MarketplaceInstallEntity)
    private readonly marketplaceInstallRepo: Repository<MarketplaceInstallEntity>,
    @InjectRepository(LinkedApplicationEntity)
    private readonly linkedApplicationRepo: Repository<LinkedApplicationEntity>,
    private readonly connectorExecutionService: MarketplaceConnectorExecutionService,
    private readonly runtimeBindingService: RuntimeBindingService,
    private readonly messageService: MessageService,
  ) {}

  @Post("localappconnector-agent-api/:appSlug/:toolName")
  async executeDedicatedTool(
    @Param("dispatchId") dispatchId: string,
    @Param("appSlug") appSlug: string,
    @Param("toolName") toolName: string,
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.executeLocalAppConnectorAgentApiTool(
      dispatchId,
      appSlug,
      toolName,
      headers,
      body,
    );
  }

  @Post(":appSlug/:toolName")
  async executeGenericTool(
    @Param("dispatchId") dispatchId: string,
    @Param("appSlug") appSlug: string,
    @Param("toolName") toolName: string,
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ) {
    if (appSlug === "relay" && toolName === "relay_publish_message") {
      const bridge = await this.bridgeService.authenticateBridgeAccessToken(
        headers.authorization,
      );
      const dispatch = await this.requireBridgeAuthorizedDispatch(
        dispatchId,
        bridge,
      );
      if (dispatch.workspaceId !== bridge.workspaceId) {
        throw new ForbiddenException(
          "Runtime dispatch belongs to another workspace",
        );
      }
      return this.messageService.publishTeamRuntimeMessage(dispatchId, body);
    }
    if (this.isLocalAppRuntimeTool(toolName)) {
      return this.executeLocalAppRuntimeTool(
        dispatchId,
        appSlug,
        toolName,
        headers,
        body,
      );
    }
    if (
      !this.isLocalAppConnectorAlias(appSlug) ||
      !this.isSupportedToolName(toolName)
    ) {
      const bridge = await this.bridgeService.authenticateBridgeAccessToken(
        headers.authorization,
      );
      await this.requireBridgeAuthorizedDispatch(dispatchId, bridge);
      try {
        return await this.connectorExecutionService.executeDispatchTool({
          dispatchId,
          appSlug,
          toolName,
          body,
          workspaceId: bridge.workspaceId,
        });
      } catch (error) {
        if (error instanceof ConnectorExecutionError) {
          return {
            ok: false,
            error: error.code,
            message: error.message,
            details: error.details ?? null,
          };
        }
        throw error;
      }
    }
    return this.executeLocalAppConnectorAgentApiTool(
      dispatchId,
      appSlug,
      toolName,
      headers,
      body,
    );
  }

  private async executeLocalAppRuntimeTool(
    dispatchId: string,
    appSlug: string,
    toolName: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const { dispatch, install, linked, resolvedAppSlug } =
      await this.requireLocalAppDispatchInstall({
        dispatchId,
        requestedAppSlug: appSlug,
        workspaceId: bridge.workspaceId,
      });
    await this.assertBridgeAuthorizedDispatch(bridge, dispatch);
    const normalizedBody = this.normalizeBody(body);
    const runtimeProfile = resolveLocalAppRuntimeProfile({
      appSlug: resolvedAppSlug,
      appName: linked.name,
      repoPath: linked.repoPath,
      metadata: linked.metadata ?? null,
      apiStyleMetadata: linked.apiStyleMetadata ?? null,
    });
    const sourceHostId = this.stringOrNull(
      linked.metadata?.sourceHostId ??
        linked.metadata?.bridgeDeviceId ??
        linked.apiStyleMetadata?.sourceHostId ??
        linked.apiStyleMetadata?.bridgeDeviceId,
    );
    const sourceHostType = this.stringOrNull(
      linked.metadata?.sourceHostType ??
        linked.apiStyleMetadata?.sourceHostType,
    );
    this.logger.log(
      JSON.stringify({
        event: "marketplace.tool_executor.local_app_runtime",
        dispatchId,
        workspaceId: dispatch.workspaceId,
        agentId: dispatch.agentId,
        requestedAppSlug: appSlug,
        appSlug: resolvedAppSlug,
        toolName,
        sourceHostId,
        sourceHostType,
        installId: install.id,
        linkedAppId: linked.id,
      }),
    );
    return this.bridgeService.executeLocalAppRuntimeTool({
      workspaceId: dispatch.workspaceId,
      appSlug: resolvedAppSlug,
      linkedAppId: linked.id,
      sourceHostId,
      sourceHostType,
      runtimeProfile,
      toolName,
      input: normalizedBody,
      agentId: dispatch.agentId,
      dispatchId,
    });
  }

  private async executeLocalAppConnectorAgentApiTool(
    dispatchId: string,
    appSlug: string,
    toolName: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const dispatch = await this.runtimeDispatchRepo.findOne({
      where: { id: dispatchId },
    });
    if (!dispatch || dispatch.workspaceId !== bridge.workspaceId) {
      throw new BadRequestException(`Runtime dispatch ${dispatchId} not found`);
    }
    await this.assertBridgeAuthorizedDispatch(bridge, dispatch);
    if (!this.isSupportedToolName(toolName)) {
      throw new NotFoundException(
        `Unsupported LocalAppConnector Agent API tool: ${toolName}`,
      );
    }
    const { linked, install, connectionId, resolvedAppSlug } =
      await this.requireDispatchInstall({
        dispatchId,
        requestedAppSlug: appSlug,
        workspaceId: bridge.workspaceId,
      });

    const normalizedBody = this.normalizeBody(body);
    const runtimeProfile = resolveLocalAppRuntimeProfile({
      appSlug: resolvedAppSlug,
      appName: linked?.name ?? null,
      repoPath: linked?.repoPath ?? null,
      metadata: linked?.metadata ?? null,
      apiStyleMetadata: linked?.apiStyleMetadata ?? null,
    });
    this.logger.log(
      JSON.stringify({
        event: "marketplace.tool_executor.localappconnector_agent_api",
        dispatchId,
        workspaceId: dispatch.workspaceId,
        agentId: dispatch.agentId,
        requestedAppSlug: appSlug,
        appSlug: resolvedAppSlug,
        toolName,
        method: this.method(normalizedBody.method),
        path: this.requiredString(normalizedBody.path, "path"),
        bearerConfigured: Boolean(connectionId),
        sourceHostId: this.stringOrNull(
          linked?.metadata?.sourceHostId ??
            linked?.apiStyleMetadata?.sourceHostId,
        ),
        runtimeRecoveryEnabled: runtimeProfile.autoStartAllowed,
        sourceHostType: this.stringOrNull(
          linked?.metadata?.sourceHostType ??
            linked?.apiStyleMetadata?.sourceHostType,
        ),
        installId: install.id,
        linkedAppId: linked?.id ?? null,
        tokenExposure: "never_logged",
      }),
    );

    try {
      return await this.bridgeService.callLocalAppConnectorAgentApi({
        workspaceId: dispatch.workspaceId,
        connectionId,
        method: this.method(normalizedBody.method),
        path: this.requiredString(normalizedBody.path, "path"),
        query:
          normalizedBody.query &&
          typeof normalizedBody.query === "object" &&
          !Array.isArray(normalizedBody.query)
            ? (normalizedBody.query as Record<string, unknown>)
            : {},
        body:
          normalizedBody.input &&
          typeof normalizedBody.input === "object" &&
          !Array.isArray(normalizedBody.input)
            ? (normalizedBody.input as Record<string, unknown>)
            : {},
        contractVersion: this.stringOrNull(normalizedBody.contractVersion),
        appSlug: resolvedAppSlug,
        linkedAppId: linked?.id ?? null,
        sourceHostId: this.stringOrNull(
          linked?.metadata?.sourceHostId ??
            linked?.apiStyleMetadata?.sourceHostId,
        ),
        sourceHostType: this.stringOrNull(
          linked?.metadata?.sourceHostType ??
            linked?.apiStyleMetadata?.sourceHostType,
        ),
        runtimeProfile,
        runtimeRecoveryApprovalId: this.stringOrNull(normalizedBody.approvalId),
        agentId: dispatch.agentId,
        dispatchId,
      });
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "marketplace.tool_executor.localappconnector_agent_api.error",
          dispatchId,
          workspaceId: dispatch.workspaceId,
          agentId: dispatch.agentId,
          requestedAppSlug: appSlug,
          appSlug: resolvedAppSlug,
          toolName,
          connectionFound: Boolean(connectionId),
          bearerConfigured: Boolean(connectionId),
          sourceHostId: this.stringOrNull(
            linked?.metadata?.sourceHostId ??
              linked?.apiStyleMetadata?.sourceHostId,
          ),
          sourceHostType: this.stringOrNull(
            linked?.metadata?.sourceHostType ??
              linked?.apiStyleMetadata?.sourceHostType,
          ),
          errorClass:
            error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          tokenExposure: "never_logged",
        }),
      );
      throw error;
    }
  }

  @Post("localappconnector-agent-api/:appSlug/_runtime-secret/fetch")
  async fetchRuntimeSecret(
    @Param("dispatchId") dispatchId: string,
    @Param("appSlug") appSlug: string,
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const { dispatch, linked, connectionId, resolvedAppSlug } =
      await this.requireDispatchInstall({
        dispatchId,
        requestedAppSlug: appSlug,
        workspaceId: bridge.workspaceId,
      });
    await this.assertBridgeAuthorizedDispatch(bridge, dispatch);
    this.logger.log(
      JSON.stringify({
        event: "marketplace.tool_executor.localappconnector_agent_api.secret_fetch",
        dispatchId,
        workspaceId: dispatch.workspaceId,
        agentId: dispatch.agentId,
        requestedAppSlug: appSlug,
        appSlug: resolvedAppSlug,
        bearerConfigured: Boolean(connectionId),
        tokenExposure: "returned_to_authenticated_hermes_bridge_only",
      }),
    );
    const secret = await this.bridgeService.getLocalAppConnectorAgentApiRuntimeSecret({
      workspaceId: dispatch.workspaceId,
      connectionId,
    });
    return {
      type: secret.type,
      connectionId: secret.connectionId,
      instanceUrl: secret.instanceUrl,
      authorizationHeader: secret.authorizationHeader,
      linkedAppId: linked?.id ?? null,
    };
  }

  private normalizeBody(body: Record<string, unknown> | null | undefined) {
    const objectBody =
      body && typeof body === "object" && !Array.isArray(body) ? body : {};
    const args = objectBody.arguments ?? objectBody.args;
    if (args && typeof args === "object" && !Array.isArray(args)) {
      return args as Record<string, unknown>;
    }
    return objectBody;
  }

  private isSupportedToolName(toolName: string) {
    return new Set([
      "localappconnector_agent_api",
      "localappconnector.agentApi",
      "localappconnector-agent-api",
      "agentApi",
    ]).has(typeof toolName === "string" ? toolName.trim() : "");
  }

  private isLocalAppRuntimeTool(toolName: string) {
    return new Set([
      "localApp.status",
      "localApp_status",
      "localApp.inspectConfig",
      "localApp_inspect_config",
      "localApp.ensureRunning",
      "localApp_ensure_running",
      "localApp.start",
      "localApp_start",
      "localApp.restart",
      "localApp_restart",
      "localApp.healthCheck",
      "localApp_health_check",
      "localApp.tailLogs",
      "localApp_tail_logs",
      "localApp.explainRecoveryFailure",
      "localApp_explain_recovery_failure",
    ]).has(typeof toolName === "string" ? toolName.trim() : "");
  }

  private isLocalAppConnectorAlias(appSlug: string) {
    return new Set(["localappconnector", "local-localappconnector"]).has(
      typeof appSlug === "string" ? appSlug.trim() : "",
    );
  }

  private method(value: unknown): "GET" | "POST" {
    return typeof value === "string" && value.trim().toUpperCase() === "POST"
      ? "POST"
      : "GET";
  }

  private requiredString(value: unknown, field: string) {
    const stringValue = this.stringOrNull(value);
    if (!stringValue) throw new BadRequestException(`${field} is required`);
    return stringValue;
  }

  private stringOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private async requireBridgeAuthorizedDispatch(
    dispatchId: string,
    bridge: { workspaceId: string; deviceId: string; runtimeType: string },
  ) {
    const dispatch = await this.runtimeDispatchRepo.findOne({
      where: { id: dispatchId },
    });
    if (!dispatch || dispatch.workspaceId !== bridge.workspaceId) {
      throw new BadRequestException(`Runtime dispatch ${dispatchId} not found`);
    }
    await this.assertBridgeAuthorizedDispatch(bridge, dispatch);
    return dispatch;
  }

  private async assertBridgeAuthorizedDispatch(
    bridge: { workspaceId: string; deviceId: string; runtimeType: string },
    dispatch: RuntimeDispatchEntity,
  ) {
    const runtimeBinding = dispatch.runtimeBindingId
      ? await this.runtimeBindingService.findById(dispatch.runtimeBindingId)
      : null;
    await this.bridgeService.assertBridgeDeviceRuntimeDispatchBinding({
      workspaceId: bridge.workspaceId,
      bridgeDeviceId: bridge.deviceId,
      bridgeRuntimeType: bridge.runtimeType,
      dispatch: {
        id: dispatch.id,
        workspaceId: dispatch.workspaceId,
        agentId: dispatch.agentId,
        runtimeBindingId: dispatch.runtimeBindingId,
      },
      runtimeBinding,
    });
  }

  private isLocalAppConnectorApp(
    appSlug: string,
    linkedApp?: LinkedApplicationEntity | null,
  ) {
    const haystack =
      `${appSlug} ${linkedApp?.name ?? ""} ${linkedApp?.slug ?? ""}`.toLowerCase();
    return haystack.includes("localappconnector");
  }

  private async requireDispatchInstall(input: {
    dispatchId: string;
    requestedAppSlug: string;
    workspaceId: string;
  }) {
    const dispatch = await this.runtimeDispatchRepo.findOne({
      where: { id: input.dispatchId },
    });
    if (!dispatch || dispatch.workspaceId !== input.workspaceId) {
      throw new BadRequestException(
        `Runtime dispatch ${input.dispatchId} not found`,
      );
    }
    const linked = await this.resolveLocalAppConnectorLinkedApp(
      dispatch.workspaceId,
      input.requestedAppSlug,
    );
    const appSlugCandidates = [
      input.requestedAppSlug,
      linked?.slug,
      input.requestedAppSlug === "localappconnector" ? "local-localappconnector" : null,
    ]
      .map((value) => this.stringOrNull(value))
      .filter(
        (value, index, values): value is string =>
          Boolean(value) && values.indexOf(value) === index,
      );
    let install: MarketplaceInstallEntity | null = null;
    for (const candidate of appSlugCandidates) {
      install = this.latestInstalledMarketplaceInstall(
        await this.marketplaceInstallRepo.find({
          where: {
            workspaceId: dispatch.workspaceId,
            agentId: dispatch.agentId,
            appSlug: candidate,
            installStatus: "installed",
          },
          order: { updatedAt: "DESC" },
        }),
      );
      if (install) break;
    }
    if (!install) {
      throw new ForbiddenException(
        "LocalAppConnector is not installed for this runtime agent",
      );
    }
    const resolvedAppSlug = linked?.slug ?? install.appSlug;
    if (!this.isLocalAppConnectorApp(input.requestedAppSlug, linked)) {
      throw new NotFoundException(
        "This Agent API tool is only available for LocalAppConnector local apps",
      );
    }
    const connectionId =
      this.stringOrNull(linked?.metadata?.localappconnectorOpenClawConnectionId) ??
      this.stringOrNull(
        linked?.apiStyleMetadata?.localappconnectorOpenClawConnectionId,
      );
    return { dispatch, install, linked, connectionId, resolvedAppSlug };
  }

  private async requireLocalAppDispatchInstall(input: {
    dispatchId: string;
    requestedAppSlug: string;
    workspaceId: string;
  }) {
    const dispatch = await this.runtimeDispatchRepo.findOne({
      where: { id: input.dispatchId },
    });
    if (!dispatch || dispatch.workspaceId !== input.workspaceId) {
      throw new BadRequestException(
        `Runtime dispatch ${input.dispatchId} not found`,
      );
    }
    const linked = await this.linkedApplicationRepo.findOne({
      where: {
        workspaceId: dispatch.workspaceId,
        slug: input.requestedAppSlug,
      },
    });
    if (!linked) {
      throw new NotFoundException("Registered local app not found");
    }
    const install = this.latestInstalledMarketplaceInstall(
      await this.marketplaceInstallRepo.find({
        where: {
          workspaceId: dispatch.workspaceId,
          agentId: dispatch.agentId,
          appSlug: linked.slug,
          installStatus: "installed",
        },
        order: { updatedAt: "DESC" },
      }),
    );
    if (!install) {
      throw new ForbiddenException(
        "Registered local app is not installed for this runtime agent",
      );
    }
    return { dispatch, install, linked, resolvedAppSlug: linked.slug };
  }

  private latestInstalledMarketplaceInstall(
    installs: MarketplaceInstallEntity[],
  ) {
    return (
      installs
        .filter((install) => install.installStatus === "installed")
        .sort(
          (left, right) =>
            this.marketplaceInstallTimestamp(right.updatedAt) -
            this.marketplaceInstallTimestamp(left.updatedAt),
        )[0] ?? null
    );
  }

  private marketplaceInstallTimestamp(value: Date | string | null | undefined) {
    if (!value) return 0;
    const timestamp =
      value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private async resolveLocalAppConnectorLinkedApp(
    workspaceId: string,
    requestedAppSlug: string,
  ) {
    const requested = requestedAppSlug.trim().toLowerCase();
    const candidates = await this.linkedApplicationRepo.find({
      where: { workspaceId },
    });
    const localappconnectorApps = candidates.filter((candidate) =>
      this.isLocalAppConnectorApp(requestedAppSlug, candidate),
    );
    return (
      localappconnectorApps.find(
        (candidate) => candidate.slug.toLowerCase() === requested,
      ) ??
      localappconnectorApps.find(
        (candidate) =>
          requested === "localappconnector" &&
          candidate.slug.toLowerCase() === "local-localappconnector",
      ) ??
      localappconnectorApps.find((candidate) =>
        candidate.slug.toLowerCase().includes("localappconnector"),
      ) ??
      null
    );
  }
}

@Throttle(MARKETPLACE_RUNTIME_TOOL_RATE_LIMIT)
@BridgeAuthenticated()
@Controller("bridge/agents/:agentId/marketplace-tools")
export class BridgeAgentMarketplaceToolsController {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly messageService: MessageService,
    @InjectRepository(MarketplaceInstallEntity)
    private readonly marketplaceInstallRepo: Repository<MarketplaceInstallEntity>,
    private readonly connectorExecutionService: MarketplaceConnectorExecutionService,
    private readonly runtimeBindingService: RuntimeBindingService,
  ) {}

  @Get()
  async listTools(
    @Param("agentId") agentId: string,
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.authorizeAgent(agentId, headers);
    const context =
      (await this.messageService.buildAgentMarketplaceRuntimeContext(
        bridge.workspaceId,
        agentId,
      )) as Record<string, unknown>;
    const runtimeContext =
      context.marketplaceRuntimeContext &&
      typeof context.marketplaceRuntimeContext === "object" &&
      !Array.isArray(context.marketplaceRuntimeContext)
        ? (context.marketplaceRuntimeContext as Record<string, unknown>)
        : {};
    const tools = Array.isArray(runtimeContext.tools)
      ? runtimeContext.tools
          .filter((tool): tool is Record<string, unknown> =>
            Boolean(tool && typeof tool === "object" && !Array.isArray(tool)),
          )
          .map((tool) => this.agentBridgeDescriptor(tool))
      : [];
    return {
      success: true,
      workspaceId: bridge.workspaceId,
      agentId,
      toolCount: tools.length,
      tools,
    };
  }

  @Post(":appSlug/:toolName")
  async executeTool(
    @Param("agentId") agentId: string,
    @Param("appSlug") appSlug: string,
    @Param("toolName") toolName: string,
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ) {
    const bridge = await this.authorizeAgent(agentId, headers);
    const device = await this.bridgeService.getBridgeDevice(bridge.deviceId);
    if (!device.createdByUserId) {
      throw new ForbiddenException(
        "Bridge device has no owning user for Marketplace execution",
      );
    }
    const install = (
      await this.marketplaceInstallRepo.find({
        where: {
          workspaceId: bridge.workspaceId,
          agentId,
          appSlug,
          installStatus: "installed",
        },
        order: { updatedAt: "DESC" },
      })
    ).find((candidate) => Boolean(candidate.connectionId));
    if (!install?.connectionId) {
      throw new ForbiddenException(
        `${appSlug} is not installed for this runtime agent`,
      );
    }
    const args =
      body.arguments &&
      typeof body.arguments === "object" &&
      !Array.isArray(body.arguments)
        ? (body.arguments as Record<string, unknown>)
        : body;
    const localDispatchId =
      typeof body.localDispatchId === "string" &&
      body.localDispatchId.trim().length > 0
        ? body.localDispatchId.trim()
        : "unknown";
    return this.connectorExecutionService.executeInstalledAgentTool({
      workspaceId: bridge.workspaceId,
      agentId,
      userId: device.createdByUserId,
      dispatchId: `bridge-local:${bridge.deviceId}:${localDispatchId}`,
      appSlug,
      toolName,
      connectionId: install.connectionId,
      body: args,
    });
  }

  private async authorizeAgent(
    agentId: string,
    headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const runtimeBinding =
      await this.runtimeBindingService.findEnabledByAgentId(agentId);
    await this.bridgeService.assertBridgeDeviceRuntimeDispatchBinding({
      workspaceId: bridge.workspaceId,
      bridgeDeviceId: bridge.deviceId,
      bridgeRuntimeType: bridge.runtimeType,
      dispatch: {
        id: `bridge-agent-context:${agentId}`,
        workspaceId: bridge.workspaceId,
        agentId,
        runtimeBindingId: runtimeBinding?.id ?? "",
        runtimeHostId: runtimeBinding?.runtimeHostId ?? null,
        assignmentEpoch: runtimeBinding?.assignmentEpoch ?? "1",
      },
      runtimeBinding,
    });
    return bridge;
  }

  private agentBridgeDescriptor(tool: Record<string, unknown>) {
    const appSlug =
      typeof tool.appSlug === "string" && tool.appSlug.trim()
        ? tool.appSlug.trim()
        : typeof tool.provider === "string" && tool.provider.trim()
          ? tool.provider.trim()
          : null;
    if (!appSlug) return tool;
    const execution =
      tool.execution &&
      typeof tool.execution === "object" &&
      !Array.isArray(tool.execution)
        ? (tool.execution as Record<string, unknown>)
        : {};
    return {
      ...tool,
      execution: {
        ...execution,
        transport: "clawchat_bridge_marketplace_tool",
        endpointBasePath: `/api/v1/bridge/agents/{agentId}/marketplace-tools/${appSlug}`,
        requiresBridgeAccessToken: true,
      },
    };
  }
}
