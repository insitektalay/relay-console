import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import {
  assertMarketplaceBetaGateAllowed,
  evaluateMarketplaceBetaGate,
} from "../../../marketplace-beta-gate";
import { MARKETPLACE_RELEASE_MANIFEST } from "../../../marketplace-release-policy";
import { BadRequestException } from "@nestjs/common";
import { BOUNDED_REST_CONNECTOR_BY_SLUG } from "../../bounded-rest/bounded-rest-registry";
import { MarketplaceConnectorRegistry } from "../../connector-registry";
import { EhrFhirApiError } from "../../ehr-fhir/ehr-fhir-api.adapter";
import {
  type MarketplaceConnectorExecutorRequest,
  type MarketplaceConnectorExecutorResult,
  type MarketplaceConnectorRuntimeDescriptor,
} from "../../types";
import { ConnectorExecutionError } from "../connector-execution.error";
import { createMarketplaceConnectorHandlers } from "../connector-handler.factory";
import { MarketplaceConnectorHandlerRegistry } from "../connector-handler.registry";
import { NATIVE_EXECUTOR_REGISTRATION_BY_SLUG } from "../provider-handlers/native-executor-registry.index";

export const OrchestrationExtension1 = {
  buildRuntimeDescriptors(
    this: MarketplaceConnectorExecutionService,
    input: {
      workspaceId: string;
      appSlug: string;
      connection: MarketplaceConnectionEntity | null;
      selectedCapabilities?: string[];
    },
  ): MarketplaceConnectorRuntimeDescriptor[] {
    const manifest = this.registry.get(input.appSlug);
    if (!manifest || !input.connection || input.connection.status !== "ready")
      return [];
    const betaGate = evaluateMarketplaceBetaGate({
      slug: manifest.slug,
      sourceType: "external_provider",
    });
    if (!betaGate.available) return [];
    const selected = new Set(
      input.selectedCapabilities ?? input.connection.selectedCapabilities ?? [],
    );
    const providerGranted =
      manifest.slug === "outlook"
        ? new Set(this.outlookProviderGrantedCapabilities(input.connection))
        : manifest.slug === "microsoft-teams"
          ? new Set(
              this.microsoftTeamsProviderGrantedCapabilities(input.connection),
            )
          : manifest.slug === "linkedin"
            ? new Set(
                this.linkedInProviderGrantedCapabilities(input.connection),
              )
            : null;
    const bridgePath = `/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/${manifest.slug}`;
    const tools = manifest.tools
      .map((tool) => {
        const installSelected =
          selected.has(tool.capability) ||
          selected.has(tool.platformCapability);
        const providerSelected =
          !providerGranted ||
          providerGranted.has(tool.capability) ||
          providerGranted.has(tool.platformCapability);
        return { tool, installSelected, providerSelected };
      })
      .filter(
        ({ installSelected, providerSelected }) =>
          installSelected && providerSelected,
      )
      .map((tool) => ({
        name: tool.tool.name,
        functionName: tool.tool.functionName,
        aliases: tool.tool.aliases,
        appSlug: manifest.slug,
        provider: manifest.slug,
        connectionId: input.connection!.id,
        workspaceId: input.workspaceId,
        capability: tool.tool.capability,
        platformCapability: tool.tool.platformCapability,
        action: tool.tool.action,
        approvalRequired: tool.tool.approvalRequired,
        description: tool.tool.description,
        inputSchema: tool.tool.inputSchema,
        auth: "clawchat_connector_token_proxy" as const,
        tokenExposure: "never_exposed_to_agent" as const,
        credential: {
          secretRef: `${manifest.slug}:${input.connection!.id}`,
          secretMaterialSentToHermes: false as const,
        },
        execution: {
          authority: [
            "obsidian",
            "roam-research",
            "logseq",
            "local-wordpress-org",
          ].includes(manifest.slug)
            ? ("device_local_source_host" as const)
            : ("railway" as const),
          transport: [
            "obsidian",
            "roam-research",
            "logseq",
            "local-wordpress-org",
          ].includes(manifest.slug)
            ? ("clawchat_bridge_source_host_tool" as const)
            : ("clawchat_bridge_marketplace_tool" as const),
          endpointBasePath: bridgePath,
          requiresBridgeAccessToken: true as const,
          credentialAttachment: "server_side_token_proxy" as const,
        },
      }));
    this.logger.log(
      JSON.stringify({
        event: "marketplace.connector.runtime_descriptors.built",
        appSlug: manifest.slug,
        connectionId: input.connection.id,
        selectedCapabilities: Array.from(selected),
        providerCapabilities: providerGranted
          ? Array.from(providerGranted)
          : null,
        toolCount: tools.length,
        tools: tools.map((tool) => tool.functionName),
      }),
    );
    return tools;
  },

  async executeDispatchTool(
    this: MarketplaceConnectorExecutionService,
    input: {
      dispatchId: string;
      appSlug: string;
      toolName: string;
      body: Record<string, unknown>;
      workspaceId: string;
    },
  ) {
    const dispatch = await this.runtimeDispatchRepo.findOne({
      where: { id: input.dispatchId },
    });
    if (!dispatch || dispatch.workspaceId !== input.workspaceId) {
      throw new BadRequestException(
        `Runtime dispatch ${input.dispatchId} not found`,
      );
    }
    assertMarketplaceBetaGateAllowed({
      slug: input.appSlug,
      name: input.appSlug,
      sourceType: "external_provider",
    });
    const tool = this.registry.getTool(input.appSlug, input.toolName);
    if (!tool)
      throw new BadRequestException(
        `Unsupported marketplace connector tool: ${input.appSlug}/${input.toolName}`,
      );
    const install = this.latestInstalledMarketplaceInstall(
      await this.installRepo.find({
        where: {
          workspaceId: input.workspaceId,
          agentId: dispatch.agentId,
          appSlug: input.appSlug,
          installStatus: "installed",
        },
        order: { updatedAt: "DESC" },
      }),
    );
    if (!install?.connectionId) {
      return this.safeError(
        "connection_not_ready",
        `${input.appSlug} is not installed for this runtime agent`,
      );
    }
    if (
      !this.toolGranted(
        tool.capability,
        tool.platformCapability,
        install.selectedCapabilities ?? [],
      )
    ) {
      return this.safeError(
        "tool_not_granted",
        `${tool.name} is not granted to this agent`,
      );
    }
    const message = await this.messageRepo.findOne({
      where: { id: dispatch.messageId },
    });
    return this.executeTool({
      workspaceId: input.workspaceId,
      dispatchId: input.dispatchId,
      agentId: dispatch.agentId,
      userId: typeof message?.senderId === "string" ? message.senderId : null,
      appSlug: input.appSlug,
      toolName: input.toolName,
      connectionId: install.connectionId,
      installMetadata: install.metadata,
      input: this.normalizeBody(input.body),
    });
  },

  async executeInstalledAgentTool(
    this: MarketplaceConnectorExecutionService,
    input: {
      workspaceId: string;
      agentId: string;
      userId: string;
      dispatchId?: string;
      appSlug: string;
      toolName: string;
      connectionId: string;
      body: Record<string, unknown>;
    },
  ) {
    assertMarketplaceBetaGateAllowed({
      slug: input.appSlug,
      name: input.appSlug,
      sourceType: "external_provider",
    });
    const tool = this.registry.getTool(input.appSlug, input.toolName);
    if (!tool) {
      throw new BadRequestException(
        `Unsupported marketplace connector tool: ${input.appSlug}/${input.toolName}`,
      );
    }
    const install = this.latestInstalledMarketplaceInstall(
      await this.installRepo.find({
        where: {
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          appSlug: input.appSlug,
          connectionId: input.connectionId,
          installStatus: "installed",
        },
        order: { updatedAt: "DESC" },
      }),
    );
    if (!install?.connectionId) {
      return this.safeError(
        "connection_not_ready",
        `${input.appSlug} is not installed for this agent and connection`,
      );
    }
    if (
      !this.toolGranted(
        tool.capability,
        tool.platformCapability,
        install.selectedCapabilities ?? [],
      )
    ) {
      return this.safeError(
        "tool_not_granted",
        `${tool.name} is not granted to this agent`,
      );
    }
    return this.executeTool({
      workspaceId: input.workspaceId,
      dispatchId: input.dispatchId?.trim() || `desktop:${input.userId}`,
      agentId: input.agentId,
      userId: input.userId,
      appSlug: input.appSlug,
      toolName: input.toolName,
      connectionId: install.connectionId,
      installMetadata: install.metadata,
      input: this.normalizeBody(input.body),
    });
  },

  async executeTool(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ): Promise<MarketplaceConnectorExecutorResult> {
    let result: MarketplaceConnectorExecutorResult;
    try {
      result = await this.executeToolInternal(input);
    } catch (error) {
      try {
        await this.getExecutionApprovalService().finalize(input, {
          ok: false,
          error: {
            code: "graph_error",
            message: "Connector execution ended unexpectedly",
          },
        });
      } catch (finalizeError) {
        this.logger.error(
          `Failed to finalize connector approval after an execution exception: ${
            finalizeError instanceof Error
              ? finalizeError.message
              : String(finalizeError)
          }`,
        );
      }
      throw error;
    }
    try {
      await this.getExecutionApprovalService().finalize(input, result);
    } catch (error) {
      this.logger.error(
        `Failed to finalize connector approval for ${input.workspaceId}/${input.appSlug}/${input.connectionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (result.ok) {
      try {
        await this.markConfiguredConnectionVerifiedByAction(input);
      } catch (error) {
        this.logger.warn(
          `Failed to persist bounded-action verification for ${input.workspaceId}/${input.appSlug}/${input.connectionId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return result;
  },

  getExecutionHandlerRegistry(this: MarketplaceConnectorExecutionService) {
    if (this.executionHandlers) return this.executionHandlers;

    for (const [slug, registration] of NATIVE_EXECUTOR_REGISTRATION_BY_SLUG) {
      if (
        typeof (this as unknown as Record<string, unknown>)[
          registration.methodName
        ] !== "function"
      ) {
        throw new Error(
          `Connector ${slug} references missing executor ${registration.methodName}`,
        );
      }
    }

    const manifests = new MarketplaceConnectorRegistry().list();
    const handlers = createMarketplaceConnectorHandlers({
      manifests,
      executeNative: (registration, context) =>
        this.invokeNativeExecutor(registration, context),
      executeBoundedRest: (context) => this.executeBoundedRest(context.request),
      executeEhrFhir: (context) => this.executeEhrFhir(context.request),
      executePartnerFinance: (context) =>
        this.executePartnerFinance(context.request),
    });
    this.executionHandlers = new MarketplaceConnectorHandlerRegistry(
      manifests,
      handlers,
      MARKETPLACE_RELEASE_MANIFEST.providers,
    );
    return this.executionHandlers;
  },

  eventTicketingRuntime(this: MarketplaceConnectorExecutionService) {
    return {
      oauth: this.oauth,
      credentials: this.credentials,
      registry: this.registry,
      airmeetApi: this.airmeetApi,
      splashApi: this.splashApi,
      cventApi: this.cventApi,
      bizzaboApi: this.bizzaboApi,
      goldcastApi: this.goldcastApi,
      eventzillaApi: this.eventzillaApi,
      ticketTailorApi: this.ticketTailorApi,
      humanitixApi: this.humanitixApi,
      buildiumApi: this.buildiumApi,
      sessionizeApi: this.sessionizeApi,
      pretixApi: this.pretixApi,
      donorboxApi: this.donorboxApi,
      airmeetCredentials: this.airmeetCredentials.bind(this),
      splashCredentials: this.splashCredentials.bind(this),
      cventCredentials: this.cventCredentials.bind(this),
      eventPlatformCredentials: this.eventPlatformCredentials.bind(this),
      buildiumCredentials: this.buildiumCredentials.bind(this),
      sessionizeCredentials: this.sessionizeCredentials.bind(this),
      pretixCredentials: this.pretixCredentials.bind(this),
      donorboxCredentials: this.donorboxCredentials.bind(this),
      requiredString: this.requiredString.bind(this),
      positiveInteger: this.positiveInteger.bind(this),
      stringOrNull: this.stringOrNull.bind(this),
      hash: this.hash.bind(this),
      safeError: this.safeError.bind(this),
      ok: this.ok.bind(this),
      recordAudit: this.recordAudit.bind(this),
    };
  },

  async executeToolInternal(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ): Promise<MarketplaceConnectorExecutorResult> {
    const manifest = this.registry.get(input.appSlug);
    const tool = this.registry.getTool(input.appSlug, input.toolName);
    if (!manifest || !tool)
      return this.safeError(
        "tool_unavailable",
        "Connector tool is not registered",
      );
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      manifest.slug,
      input.connectionId,
    );
    if (connection.status !== "ready")
      return this.safeError(
        "connection_not_ready",
        `${manifest.name} connection is not ready`,
      );
    if (
      !this.connectionGrantsTool(
        manifest.slug,
        tool.capability,
        tool.platformCapability,
        connection,
      )
    ) {
      return this.safeError(
        "tool_not_granted",
        `${tool.name} is not granted on this connection`,
      );
    }
    try {
      const resolved = this.getExecutionHandlerRegistry().resolve(
        manifest.slug,
        tool.functionName ?? input.toolName,
      );
      if (!resolved) {
        return this.safeError(
          "tool_unavailable",
          `${manifest.slug} has no registered handler for ${tool.functionName}`,
        );
      }
      return await resolved.handler.execute({
        request: input,
        manifest,
        tool: resolved.tool,
        connection,
      });
    } catch (error) {
      const safe = this.mapError(error);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: `marketplace.${manifest.slug}.action.failed`,
        resourceId: input.connectionId,
        metadata: {
          toolName: input.toolName,
          code: safe.error?.code,
          message: safe.error?.message,
        },
      });
      return safe;
    }
  },

  async markConfiguredConnectionVerifiedByAction(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.connectionRepo.findOne({
      where: {
        id: input.connectionId,
        workspaceId: input.workspaceId,
        appSlug: input.appSlug,
      },
    });
    if (!connection) return;
    const verification = connection.metadata?.connectionVerification;
    if (
      !verification ||
      typeof verification !== "object" ||
      Array.isArray(verification) ||
      (verification as Record<string, unknown>).customerStatus !==
        "configured_unverified"
    ) {
      return;
    }
    const checkedAt = new Date();
    connection.metadata = {
      ...(connection.metadata ?? {}),
      connectionVerification: {
        ...(verification as Record<string, unknown>),
        customerStatus: "customer_connected",
        verifiedBy: "first_bounded_provider_action",
        checkedAt: checkedAt.toISOString(),
      },
    };
    connection.status = "ready";
    connection.lastValidatedAt = checkedAt;
    connection.lastErrorCode = null;
    connection.lastErrorMessage = null;
    await this.connectionRepo.save(connection);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.connection.verified_by_bounded_action",
      resourceId: connection.id,
      metadata: {
        appSlug: input.appSlug,
        toolName: input.toolName,
        customerStatus: "customer_connected",
      },
    });
  },

  async executePartnerFinance(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      input.appSlug,
      input.connectionId,
    );
    const credentials = this.credentials.decrypt(connection);
    const tool = this.registry.getTool(input.appSlug, input.toolName)!;
    const isManage = tool.action !== "read";
    if (isManage) {
      await this.requireConnectorApproval(
        input,
        connection,
        `${input.appSlug.replace(/-/g, "_")}_full_api`,
        input.appSlug,
      );
    }
    const data = isManage
      ? await this.partnerFinanceApi.manage(
          input.appSlug,
          credentials,
          input.input,
        )
      : await this.partnerFinanceApi.read(
          input.appSlug,
          credentials,
          input.input,
        );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${input.appSlug}.api.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action: isManage ? "full_api" : "read",
        method:
          this.stringOrNull(input.input.method) ?? (isManage ? null : "GET"),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
      },
    });
    return this.ok(
      data,
      `${this.registry.get(input.appSlug)?.name ?? input.appSlug} API request completed.`,
    );
  },

  async executeBoundedRest(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const config = BOUNDED_REST_CONNECTOR_BY_SLUG.get(input.appSlug);
    if (!config)
      return this.safeError(
        "tool_unavailable",
        `${input.appSlug} has no bounded REST contract`,
      );
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      config.slug,
      input.connectionId,
    );
    const manifest = this.registry.get(config.slug)!;
    const stored =
      manifest.auth.type === "oauth2_authorization_code" ||
      manifest.auth.type === "oauth1"
        ? await this.oauth.refreshIfNeeded(connection).then((token) => ({
            ...token.credentials,
            accessToken: token.accessToken,
          }))
        : this.credentials.decrypt(connection);
    if (config.originSubdomain) {
      stored[config.originSubdomain.credentialName] =
        connection.metadata?.[config.originSubdomain.credentialName];
    }
    const tool = this.registry.getTool(config.slug, input.toolName)!;
    const mode = tool.action === "read" ? "read" : "manage";
    if (mode === "manage")
      await this.requireConnectorApproval(
        input,
        connection,
        `${config.slug}_manage`,
        config.slug,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const operationSchema = (
      tool.inputSchema.properties as Record<string, Record<string, unknown>>
    ).operation;
    const allowedOperations = operationSchema?.enum;
    if (
      Array.isArray(allowedOperations) &&
      !allowedOperations.includes(operation)
    )
      throw new ConnectorExecutionError(
        "provider_validation_error",
        `${config.name} operation is not allowed by this tool.`,
      );
    if (mode === "read" && tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        config.slug,
      );
    const data = await this.boundedRestApi.execute(
      config,
      stored,
      mode,
      operation,
      {
        pathParameters: this.recordOrUndefined(input.input.pathParameters),
        query: this.recordOrUndefined(input.input.query),
        json: input.input.json,
      },
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${config.slug}.${mode}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
        mode,
        pathParameterNames: Object.keys(
          this.recordOrUndefined(input.input.pathParameters) ?? {},
        ),
        queryNames: Object.keys(
          this.recordOrUndefined(input.input.query) ?? {},
        ),
      },
    });
    return this.ok(data, `${config.name} ${operation} completed.`);
  },

  async executeEhrFhir(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const manifest = this.registry.get(input.appSlug);
    if (!manifest)
      return this.safeError(
        "tool_unavailable",
        "EHR/FHIR connector is not registered",
      );
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      manifest.slug,
      input.connectionId,
    );
    const tool = this.registry.getTool(manifest.slug, input.toolName)!;
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        manifest.slug,
      );
    const credentials = this.ehrFhirCredentials(
      this.credentials.decrypt(connection),
    );
    let data: unknown;
    if (tool.functionName === "ehr_fhir_discovery_read") {
      const [smart, capability] = await Promise.all([
        this.ehrFhirApi.smartConfiguration(credentials).catch((error) => ({
          unavailable: true,
          code:
            error instanceof EhrFhirApiError
              ? error.code
              : "provider_unavailable",
        })),
        this.ehrFhirApi.capabilityStatement(credentials),
      ]);
      data = { smartConfiguration: smart, capabilityStatement: capability };
    } else if (tool.functionName === "ehr_fhir_metadata_search") {
      data = await this.ehrFhirApi.search(credentials, {
        resourceType: this.requiredString(
          input.input.resourceType,
          "resourceType",
        ),
        query: this.recordOrUndefined(input.input.query),
      });
    } else if (tool.functionName === "ehr_fhir_metadata_read") {
      data = await this.ehrFhirApi.read(credentials, {
        resourceType: this.requiredString(
          input.input.resourceType,
          "resourceType",
        ),
        id: this.requiredString(input.input.id, "id"),
      });
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${manifest.slug}.ehr_fhir.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        resourceType: this.stringOrNull(input.input.resourceType),
        resourceIdHash: this.stringOrNull(input.input.id)
          ? this.hash(this.stringOrNull(input.input.id)!)
          : null,
      },
    });
    return this.ok(data, `${manifest.name} SMART/FHIR ${tool.name} completed.`);
  },
};
