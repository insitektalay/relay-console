import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { UserEntity } from "../../entities/user.entity";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import {
  ConfigureLinkCrestOpenClawDto,
  AutoConnectLocalAppDto,
  CreateLocalMarketplaceAppDto,
  ApplyLocalRepoDocsProposalDto,
  CreateMarketplaceConnectionDto,
  ImportMarketplacePackSourcesDto,
  InstallMarketplaceAppDto,
  PreviewMarketplacePackDto,
  RecordMarketplacePackReviewDto,
  SyncLinkCrestPolicyDto,
  UpdateLocalMarketplaceAppDto,
  UpdateMarketplaceConnectionDto,
  UpdateMarketplaceInstallDto,
  UpdateMarketplacePackSourcesDto,
  ValidateConnectorSenderIdentityDto,
} from "./dto/marketplace.dto";
import { MarketplaceService } from "./marketplace.service";
import { MarketplaceConnectorExecutionService } from "./connectors/connector-execution.service";
import { MarketplaceConnectorOAuthService } from "./connectors/connector-oauth.service";
import { ToolRequestService } from "../tool-request/tool-request.service";
import {
  CreateToolRequestDto,
  UpdateToolRequestStatusDto,
} from "../tool-request/dto/tool-request.dto";
import { BlueskyOAuthService } from "./bluesky/bluesky-oauth.service";

const MARKETPLACE_TOOL_REQUEST_RATE_LIMIT = {
  default: { limit: 30, ttl: 60_000 },
};
const MARKETPLACE_CREDENTIAL_ATTEMPT_RATE_LIMIT = {
  default: { limit: 5, ttl: 60_000 },
};

@ApiTags("marketplace")
@UseInterceptors(ResponseInterceptor)
@Controller("marketplace")
export class PublicMarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Public()
  @Get("catalog")
  catalog(
    @Query("query") query?: string,
    @Query("category") category?: string,
    @Query("sourceType") sourceType?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    const paginated =
      query !== undefined ||
      category !== undefined ||
      sourceType !== undefined ||
      cursor !== undefined ||
      limit !== undefined;
    return paginated
      ? this.marketplaceService.listPublicCatalogPage({
          query,
          category,
          sourceType,
          cursor,
          limit,
        })
      : this.marketplaceService.listPublicCatalog();
  }

  @Public()
  @Get("public-catalog/:slug")
  app(@Param("slug") slug: string) {
    return this.marketplaceService.getPublicApp(slug);
  }
}

@ApiTags("marketplace")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller("workspaces/:workspaceId/marketplace")
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly toolRequestService: ToolRequestService,
    private readonly connectorOAuthService: MarketplaceConnectorOAuthService,
    private readonly connectorExecutionService: MarketplaceConnectorExecutionService,
    private readonly blueskyOAuthService: BlueskyOAuthService,
  ) {}

  @Get("catalog")
  async catalog(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Query("query") query?: string,
    @Query("category") category?: string,
    @Query("sourceType") sourceType?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    const paginated =
      query !== undefined ||
      category !== undefined ||
      sourceType !== undefined ||
      cursor !== undefined ||
      limit !== undefined;
    return paginated
      ? this.marketplaceService.listCatalogPage(
          workspaceId,
          { query, category, sourceType, cursor, limit },
          user.id,
        )
      : this.marketplaceService.listCatalog(workspaceId, user.id);
  }

  @Get("catalog/:slug")
  async app(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.getApp(workspaceId, slug, user.id);
  }

  @Post("local-apps")
  async createLocalApp(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateLocalMarketplaceAppDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    await this.marketplaceService.createLocalApp(workspaceId, user.id, dto);
    return this.marketplaceService.listCatalog(workspaceId, user.id);
  }

  @Patch("local-apps/:slug")
  async updateLocalApp(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateLocalMarketplaceAppDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.updateLocalApp(
      workspaceId,
      slug,
      user.id,
      dto,
    );
  }

  @Get("local-source-hosts")
  async localSourceHosts(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.listLocalRepoSourceHosts(workspaceId);
  }

  @Post("apps/:slug/update-pack")
  async updatePack(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.updatePack(workspaceId, slug, user.id);
  }

  @Post("apps/:slug/refresh-agent-docs")
  async refreshAgentDocs(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.refreshInstalledAgentDocs(
      workspaceId,
      slug,
      user.id,
    );
  }

  @Post("apps/:slug/linkcrest-policy/sync")
  async syncLinkCrestPolicy(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: SyncLinkCrestPolicyDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.syncLinkCrestCampaignPolicy(
      workspaceId,
      slug,
      user.id,
      dto,
    );
  }

  @Post("apps/:slug/linkcrest-agent-api/configure")
  @Post("apps/:slug/linkcrest-openclaw/configure")
  async configureLinkCrestOpenClaw(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ConfigureLinkCrestOpenClawDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.configureLinkCrestOpenClaw(
      workspaceId,
      slug,
      user.id,
      dto,
    );
  }

  @Post("apps/:slug/auto-connect")
  async autoConnectLocalApp(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: AutoConnectLocalAppDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.autoConnectLocalApp(
      workspaceId,
      slug,
      user.id,
      dto,
    );
  }

  @Get("apps/:slug/documentation-history")
  async documentationHistory(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.getDocumentationHistory(
      workspaceId,
      slug,
      user.id,
    );
  }

  @Get("apps/:slug/local-repo-docs/status")
  async localRepoDocsStatus(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.getLocalRepoDocumentationStatus(
      workspaceId,
      slug,
      user.id,
    );
  }

  @Post("apps/:slug/local-repo-docs/analyze")
  async analyzeLocalRepoDocs(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.analyzeLocalRepoDocumentation(
      workspaceId,
      slug,
      user.id,
    );
  }

  @Get("apps/:slug/local-repo-docs/proposals/:proposalId")
  async localRepoDocsProposal(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @Param("proposalId") proposalId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.getLocalRepoDocumentationProposal(
      workspaceId,
      slug,
      proposalId,
    );
  }

  @Post("apps/:slug/local-repo-docs/proposals/:proposalId/apply")
  async applyLocalRepoDocsProposal(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @Param("proposalId") proposalId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ApplyLocalRepoDocsProposalDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.applyLocalRepoDocumentationProposal(
      workspaceId,
      slug,
      proposalId,
      user.id,
      dto,
    );
  }

  @Get("connections")
  async connections(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Query("appSlug") appSlug?: string,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.listConnections(workspaceId, appSlug);
  }

  @Post("connections")
  @Throttle(MARKETPLACE_CREDENTIAL_ATTEMPT_RATE_LIMIT)
  async createConnection(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateMarketplaceConnectionDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    const created = await this.marketplaceService.createConnection(
      workspaceId,
      user.id,
      dto,
    );
    const connection = await this.verifyCredentialConnection(
      workspaceId,
      user.id,
      created,
      dto.retainUnverifiedCredentials === true,
    );
    if (this.connectionCanResolveToolRequests(connection)) {
      await this.toolRequestService.resolveToolRequestsFromConnection({
        workspaceId,
        appSlug: connection.appSlug,
        selectedCapabilities: connection.selectedCapabilities,
      });
    }
    return connection;
  }

  @Patch("connections/:id")
  @Throttle(MARKETPLACE_CREDENTIAL_ATTEMPT_RATE_LIMIT)
  async updateConnection(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateMarketplaceConnectionDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    const updated = await this.marketplaceService.updateConnection(
      workspaceId,
      id,
      user.id,
      dto,
    );
    const connection = dto.credentials
      ? await this.verifyCredentialConnection(
          workspaceId,
          user.id,
          updated,
          dto.retainUnverifiedCredentials === true,
        )
      : updated;
    if (this.connectionCanResolveToolRequests(connection)) {
      await this.toolRequestService.resolveToolRequestsFromConnection({
        workspaceId,
        appSlug: connection.appSlug,
        selectedCapabilities: connection.selectedCapabilities,
      });
    }
    return connection;
  }

  @Post("connections/:id/disconnect")
  async disconnectConnection(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.disconnectConnection(
      workspaceId,
      id,
      user.id,
    );
  }

  @Get("tool-requests")
  async toolRequests(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Query("linkedAppId") linkedAppId?: string,
    @Query("appSlug") appSlug?: string,
    @Query("teamId") teamId?: string,
    @Query("threadId") threadId?: string,
    @Query("agentId") agentId?: string,
    @Query("status") status?: any,
    @Query("capability") capability?: string,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.toolRequestService.listToolRequests(workspaceId, {
      linkedAppId,
      appSlug,
      teamId,
      threadId,
      agentId,
      status,
      capability,
    });
  }

  @Get("tool-requests/summary")
  async neededToolsSummary(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Query("appSlug") appSlug?: string,
    @Query("teamId") teamId?: string,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.toolRequestService.getNeededToolsSummary(workspaceId, {
      appSlug,
      teamId,
    });
  }

  @Post("tool-requests")
  @Throttle(MARKETPLACE_TOOL_REQUEST_RATE_LIMIT)
  async createToolRequest(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateToolRequestDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.toolRequestService.createToolRequest(workspaceId, dto);
  }

  @Get("connectors/bluesky/oauth/config")
  async blueskyOAuthConfig(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.blueskyOAuthService.getOAuthConfig();
  }

  @Get("connectors/:slug/oauth/config")
  async connectorOAuthConfig(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.connectorOAuthService.getOAuthConfig(slug);
  }

  @Post("connectors/bluesky/oauth/start")
  async startBlueskyOAuth(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: Record<string, unknown>,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.blueskyOAuthService.startOAuth(workspaceId, user.id, {
      handle: typeof dto.handle === "string" ? dto.handle : undefined,
      displayName:
        typeof dto.displayName === "string" ? dto.displayName : undefined,
      returnTo: typeof dto.returnTo === "string" ? dto.returnTo : undefined,
      connectionId:
        typeof dto.connectionId === "string" ? dto.connectionId : undefined,
    });
  }

  @Post("connectors/:slug/oauth/start")
  async startConnectorOAuth(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: Record<string, unknown>,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.connectorOAuthService.startOAuth(
      workspaceId,
      user.id,
      slug,
      dto as any,
    );
  }

  @Post("connectors/sentry/oauth/device/poll")
  async pollSentryDeviceOAuth(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: Record<string, unknown>,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.connectorOAuthService.pollSentryDeviceOAuth(
      workspaceId,
      user.id,
      typeof dto.deviceFlowToken === "string" ? dto.deviceFlowToken : "",
    );
  }

  @Post("connectors/bluesky/connections/:connectionId/oauth/reauthorize")
  async reauthorizeBlueskyOAuth(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: Record<string, unknown>,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.blueskyOAuthService.startOAuth(workspaceId, user.id, {
      handle: typeof dto.handle === "string" ? dto.handle : undefined,
      displayName:
        typeof dto.displayName === "string" ? dto.displayName : undefined,
      returnTo: typeof dto.returnTo === "string" ? dto.returnTo : undefined,
      connectionId,
    });
  }

  @Post("connectors/:slug/connections/:connectionId/oauth/reauthorize")
  async reauthorizeConnectorOAuth(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: Record<string, unknown>,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.connectorOAuthService.startOAuth(workspaceId, user.id, slug, {
      ...dto,
      connectionId,
    } as any);
  }

  @Post("connectors/bluesky/connections/:connectionId/disconnect")
  async disconnectBluesky(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.blueskyOAuthService.disconnect(
      workspaceId,
      user.id,
      connectionId,
    );
  }

  @Post("connectors/:slug/connections/:connectionId/disconnect")
  async disconnectConnector(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.connectorOAuthService.disconnect(
      workspaceId,
      user.id,
      slug,
      connectionId,
    );
  }

  @Get("connectors/bluesky/connections/:connectionId/health")
  async blueskyHealth(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.blueskyOAuthService.health(workspaceId, connectionId);
  }

  @Post("connectors/bluesky/connections/:connectionId/actions/:toolName")
  @Throttle(MARKETPLACE_TOOL_REQUEST_RATE_LIMIT)
  async executeBlueskyAgentAction(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @Param("toolName") toolName: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: Record<string, unknown>,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    const agentId = typeof dto.agentId === "string" ? dto.agentId.trim() : "";
    const payload = dto.payload;
    if (
      !agentId ||
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      throw new BadRequestException(
        "Bluesky action requires an agentId and object payload",
      );
    }
    return this.connectorExecutionService.executeInstalledAgentTool({
      workspaceId,
      agentId,
      userId: user.id,
      appSlug: "bluesky",
      toolName,
      connectionId,
      body: payload as Record<string, unknown>,
    });
  }

  @Post("connectors/:slug/connections/:connectionId/actions/:toolName")
  @Throttle(MARKETPLACE_TOOL_REQUEST_RATE_LIMIT)
  async executeInstalledAgentConnectorAction(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @Param("connectionId") connectionId: string,
    @Param("toolName") toolName: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: Record<string, unknown>,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    const agentId = typeof dto.agentId === "string" ? dto.agentId.trim() : "";
    const payload = dto.payload;
    if (
      !agentId ||
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      throw new BadRequestException(
        `${slug} action requires an agentId and object payload`,
      );
    }
    return this.connectorExecutionService.executeInstalledAgentTool({
      workspaceId,
      agentId,
      userId: user.id,
      appSlug: slug,
      toolName,
      connectionId,
      body: payload as Record<string, unknown>,
    });
  }

  @Post("connectors/:slug/connections/:connectionId/sender-identities/validate")
  async validateConnectorSenderIdentity(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ValidateConnectorSenderIdentityDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.connectorOAuthService.validateSenderIdentity(
      workspaceId,
      slug,
      connectionId,
      dto,
    );
  }

  @Get("connectors/:slug/connections/:connectionId/health")
  @Throttle(MARKETPLACE_CREDENTIAL_ATTEMPT_RATE_LIMIT)
  async connectorHealth(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.connectorExecutionService.health(
      workspaceId,
      slug,
      connectionId,
    );
  }

  private async verifyCredentialConnection(
    workspaceId: string,
    userId: string,
    connection: {
      id: string;
      appSlug: string;
      status: string;
      selectedCapabilities: string[];
      metadata?: Record<string, unknown>;
    },
    retainUnverifiedCredentials: boolean,
  ): Promise<{
    id: string;
    appSlug: string;
    status: string;
    selectedCapabilities: string[];
    metadata?: Record<string, unknown>;
  }> {
    const verification = connection.metadata?.connectionVerification;
    if (
      !verification ||
      typeof verification !== "object" ||
      Array.isArray(verification) ||
      (verification as Record<string, unknown>).customerStatus !== "checking"
    ) {
      return connection;
    }
    let health: {
      status: string;
      tokenValid: boolean;
      errorCode?: string | null;
      networkPolicy?: "connector_fixed_provider_egress" | "no_provider_egress";
    };
    if (!this.connectorExecutionService.hasRegisteredConnector(connection.appSlug)) {
      // Documentation-reviewed catalog entries without a bounded connector may
      // retain encrypted credentials only with explicit customer consent. No
      // provider request or agent tool is available for these entries.
      health = {
        status: "ready",
        tokenValid: false,
        errorCode: "no_safe_probe",
        networkPolicy: "no_provider_egress",
      };
    } else try {
      health = await this.connectorExecutionService.health(
        workspaceId,
        connection.appSlug,
        connection.id,
      );
    } catch {
      health = {
        status: "error",
        tokenValid: false,
        errorCode: "provider_unavailable",
        networkPolicy: "connector_fixed_provider_egress",
      };
    }
    const reconciled = await this.marketplaceService.reconcileConnectionVerification(
      workspaceId,
      connection.id,
      userId,
      health,
      retainUnverifiedCredentials,
    );
    return reconciled as {
      id: string;
      appSlug: string;
      status: string;
      selectedCapabilities: string[];
      metadata?: Record<string, unknown>;
    };
  }

  private connectionCanResolveToolRequests(connection: {
    status: string;
    metadata?: Record<string, unknown>;
  }): boolean {
    if (connection.status !== "ready") return false;
    const verification = connection.metadata?.connectionVerification;
    if (!verification || typeof verification !== "object" || Array.isArray(verification))
      return true;
    return (
      (verification as Record<string, unknown>).networkPolicy !==
      "no_provider_egress"
    );
  }

  @Patch("tool-requests/:id")
  async updateToolRequestStatus(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateToolRequestStatusDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.toolRequestService.updateToolRequestStatus(
      workspaceId,
      id,
      dto.status,
      dto.resolutionNotes,
    );
  }

  @Get("installs")
  async installs(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.listInstalls(workspaceId);
  }

  @Delete("installs/:id")
  async removeInstall(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.removeInstall(workspaceId, id, user.id);
  }

  @Get("packs/generated")
  async generatedPacks(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.listGeneratedPacks(workspaceId);
  }

  @Get("packs/generated/coverage")
  async generatedPackCoverage(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.generatedPackCoverage(workspaceId);
  }

  @Get("packs/generated/:slug")
  async generatedPackDetail(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.getGeneratedPackDetail(workspaceId, slug);
  }

  @Post("packs/generated/:slug/rerun")
  async rerunGeneratedPack(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.rerunGeneratedPack(
      workspaceId,
      slug,
      user.id,
    );
  }

  @Patch("packs/generated/:slug/sources")
  async updateGeneratedPackSources(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateMarketplacePackSourcesDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.updateGeneratedPackSources(
      workspaceId,
      slug,
      user.id,
      dto,
    );
  }

  @Post("packs/generated/:slug/sources/preview")
  async previewGeneratedPackSourceImport(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ImportMarketplacePackSourcesDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.previewGeneratedPackSourceImport(
      workspaceId,
      slug,
      dto,
    );
  }

  @Post("packs/generated/:slug/sources/import")
  async importGeneratedPackSources(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ImportMarketplacePackSourcesDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.importGeneratedPackSources(
      workspaceId,
      slug,
      user.id,
      dto,
    );
  }

  @Post("packs/generated/:slug/reviews")
  async recordGeneratedPackReview(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: RecordMarketplacePackReviewDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.recordGeneratedPackReview(
      workspaceId,
      slug,
      user.id,
      "review_note",
      dto.notes,
    );
  }

  @Post("packs/generated/:slug/promote")
  async promoteGeneratedPack(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: RecordMarketplacePackReviewDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.promoteGeneratedPack(
      workspaceId,
      slug,
      user.id,
      dto.notes,
    );
  }

  @Post("packs/generated/:slug/publish")
  async publishGeneratedPack(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: RecordMarketplacePackReviewDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.publishGeneratedPack(
      workspaceId,
      slug,
      user.id,
      dto.notes,
    );
  }

  @Post("packs/generated/:slug/reject")
  async rejectGeneratedPack(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: RecordMarketplacePackReviewDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.rejectGeneratedPack(
      workspaceId,
      slug,
      user.id,
      dto.notes,
    );
  }

  @Post("packs/generated/:slug/needs-manual-review")
  async markGeneratedPackNeedsManualReview(
    @Param("workspaceId") workspaceId: string,
    @Param("slug") slug: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: RecordMarketplacePackReviewDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.markGeneratedPackNeedsManualReview(
      workspaceId,
      slug,
      user.id,
      dto.notes,
    );
  }

  @Post("packs/preview")
  async previewPack(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: PreviewMarketplacePackDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.previewPack(workspaceId, user.id, dto);
  }

  @Post("install")
  async install(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: InstallMarketplaceAppDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.install(workspaceId, user.id, dto);
  }

  @Patch("installs/:installId")
  async updateInstall(
    @Param("workspaceId") workspaceId: string,
    @Param("installId") installId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateMarketplaceInstallDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.marketplaceService.updateInstall(
      workspaceId,
      user.id,
      installId,
      dto,
    );
  }
}
