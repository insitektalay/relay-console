import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { Repository } from "typeorm";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  BridgeAuthenticated,
  Public,
} from "../../common/decorators/public.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { MarketplaceInstallEntity, MessageEntity } from "../../entities";
import { RuntimeDispatchEntity } from "../../entities/runtime-dispatch.entity";
import { UserEntity } from "../../entities/user.entity";
import { BridgeService } from "../bridge/bridge.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import {
  CreateXApprovalDto,
  ExecuteXWriteDto,
  StartXOAuthDto,
} from "./dto/marketplace.dto";
import { XMarketplaceService } from "./x-marketplace.service";

const MARKETPLACE_RUNTIME_TOOL_RATE_LIMIT = {
  default: { limit: 60, ttl: 60_000 },
};

const X_OAUTH_CALLBACK_TEXT_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

const X_OAUTH_CALLBACK_ERROR_CODES = new Set([
  "access_denied",
  "account_selection_required",
  "consent_required",
  "interaction_required",
  "invalid_request",
  "invalid_scope",
  "login_required",
  "server_error",
  "temporarily_unavailable",
  "unauthorized_client",
  "unsupported_response_type",
]);

@ApiTags("marketplace-x")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller("workspaces/:workspaceId/marketplace/x")
export class XMarketplaceController {
  constructor(
    private readonly xMarketplaceService: XMarketplaceService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
  ) {}

  @Get("oauth/config")
  async oauthConfig(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.getOAuthConfig();
  }

  @Post("oauth/start")
  async startOAuth(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: StartXOAuthDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.startOAuth(workspaceId, user.id, dto);
  }

  @Post("connections/:connectionId/oauth/reauthorize")
  async reauthorizeOAuth(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: StartXOAuthDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.startOAuth(workspaceId, user.id, {
      ...dto,
      connectionId,
    });
  }

  @Post("connections/:connectionId/disconnect")
  async disconnect(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.disconnectOAuth(
      workspaceId,
      user.id,
      connectionId,
    );
  }

  @Get("connections/:connectionId/status")
  async connectionStatus(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.getConnectionStatus(
      workspaceId,
      connectionId,
    );
  }

  @Get("connections/:connectionId/account")
  async account(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.readAccount(
      workspaceId,
      user.id,
      connectionId,
    );
  }

  @Get("connections/:connectionId/own-posts")
  async ownPosts(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.readOwnPosts(
      workspaceId,
      user.id,
      connectionId,
    );
  }

  @Post("connections/:connectionId/drafts")
  async draft(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { text?: string },
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.createDraft(body.text ?? "");
  }

  @Post("approvals")
  async requestApproval(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateXApprovalDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.requestApproval(workspaceId, user.id, dto);
  }

  @Post("connections/:connectionId/text-posts")
  async createTextPost(
    @Param("workspaceId") workspaceId: string,
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ExecuteXWriteDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.xMarketplaceService.createTextPost(
      workspaceId,
      user.id,
      connectionId,
      dto,
    );
  }
}

@ApiTags("marketplace-x")
@Public()
@Controller("marketplace/oauth/x")
export class XMarketplaceOAuthCallbackController {
  private readonly logger = new Logger(
    XMarketplaceOAuthCallbackController.name,
  );

  constructor(private readonly xMarketplaceService: XMarketplaceService) {}

  @Get("callback")
  async callback(
    @Query("state") state: string,
    @Query("code") code: string,
    @Query("error") error: string | undefined,
    @Query("error_description") _errorDescription: string | undefined,
    @Res() response: Response,
  ) {
    if (error) {
      const errorCode = this.normalizeOAuthErrorCode(error);
      this.logger.warn(`X OAuth callback rejected: ${errorCode}`);
      return this.sendPlainText(
        response,
        400,
        "X authorization failed. Return to ClawChat and try again.",
      );
    }
    const result = await this.xMarketplaceService.completeOAuth({
      state,
      code,
    });
    if (result.returnTo) {
      response.redirect(result.returnTo);
      return;
    }
    return this.sendPlainText(
      response,
      200,
      "X authorization completed. You can return to ClawChat.",
    );
  }

  private normalizeOAuthErrorCode(value: string): string {
    const normalized = value.trim().toLowerCase();
    return X_OAUTH_CALLBACK_ERROR_CODES.has(normalized)
      ? normalized
      : "unknown_oauth_error";
  }

  private sendPlainText(
    response: Response,
    status: number,
    body: string,
  ): Response {
    return response
      .status(status)
      .type("text/plain")
      .set(X_OAUTH_CALLBACK_TEXT_HEADERS)
      .send(body);
  }
}

@ApiTags("marketplace-x")
@Throttle(MARKETPLACE_RUNTIME_TOOL_RATE_LIMIT)
@BridgeAuthenticated()
@Controller("bridge/runtime-dispatches/:dispatchId/marketplace-tools/x")
export class XMarketplaceBridgeToolsController {
  private readonly logger = new Logger(XMarketplaceBridgeToolsController.name);

  constructor(
    private readonly bridgeService: BridgeService,
    private readonly xMarketplaceService: XMarketplaceService,
    @InjectRepository(RuntimeDispatchEntity)
    private readonly runtimeDispatchRepo: Repository<RuntimeDispatchEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    @InjectRepository(MarketplaceInstallEntity)
    private readonly marketplaceInstallRepo: Repository<MarketplaceInstallEntity>,
    private readonly runtimeBindingService: RuntimeBindingService,
  ) {}

  @Post(":toolName")
  async executeTool(
    @Param("dispatchId") dispatchId: string,
    @Param("toolName") toolName: string,
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ) {
    const normalizedBody = this.normalizeBody(body);
    this.logExecutor({
      dispatchId,
      routeToolName: toolName,
      normalizedToolName: this.normalizeToolName(toolName),
      bodyKeys: Object.keys(body ?? {}),
      normalizedBodyKeys: Object.keys(normalizedBody),
      stage: "received",
      matched: this.isSupportedToolName(toolName),
    });
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const dispatch = await this.runtimeDispatchRepo.findOne({
      where: { id: dispatchId },
    });
    if (!dispatch || dispatch.workspaceId !== bridge.workspaceId) {
      this.logExecutor({
        dispatchId,
        routeToolName: toolName,
        normalizedToolName: this.normalizeToolName(toolName),
        bodyKeys: Object.keys(body ?? {}),
        normalizedBodyKeys: Object.keys(normalizedBody),
        stage: "reject",
        matched: this.isSupportedToolName(toolName),
        installFound: false,
        connectionFound: false,
        reason: "dispatch_not_found_or_wrong_workspace",
      });
      throw new BadRequestException(`Runtime dispatch ${dispatchId} not found`);
    }
    await this.assertBridgeAuthorizedDispatch(bridge, dispatch);

    const message = await this.messageRepo.findOne({
      where: { id: dispatch.messageId },
    });
    const userId =
      typeof message?.senderId === "string" && message.senderId.trim()
        ? message.senderId
        : null;
    if (!userId) {
      this.logExecutor({
        dispatchId,
        appSlug: "x",
        routeToolName: toolName,
        normalizedToolName: this.normalizeToolName(toolName),
        bodyKeys: Object.keys(body ?? {}),
        normalizedBodyKeys: Object.keys(normalizedBody),
        stage: "reject",
        matched: this.isSupportedToolName(toolName),
        installFound: false,
        connectionFound: false,
        reason: "missing_user_sender",
      });
      throw new ForbiddenException(
        "X marketplace tool execution requires a user-authored dispatch",
      );
    }

    const install = this.latestInstalledMarketplaceInstall(
      await this.marketplaceInstallRepo.find({
        where: {
          workspaceId: dispatch.workspaceId,
          agentId: dispatch.agentId,
          appSlug: "x",
          installStatus: "installed",
        },
        order: { updatedAt: "DESC" },
      }),
    );
    if (!install?.connectionId) {
      this.logExecutor({
        dispatchId,
        appSlug: "x",
        routeToolName: toolName,
        normalizedToolName: this.normalizeToolName(toolName),
        bodyKeys: Object.keys(body ?? {}),
        normalizedBodyKeys: Object.keys(normalizedBody),
        stage: "reject",
        matched: this.isSupportedToolName(toolName),
        installFound: Boolean(install),
        connectionFound: false,
        reason: "install_or_connection_missing",
      });
      throw new ForbiddenException("X is not installed for this runtime agent");
    }

    this.logExecutor({
      dispatchId,
      appSlug: "x",
      routeToolName: toolName,
      normalizedToolName: this.normalizeToolName(toolName),
      bodyKeys: Object.keys(body ?? {}),
      normalizedBodyKeys: Object.keys(normalizedBody),
      stage: "execute",
      matched: this.isSupportedToolName(toolName),
      installFound: true,
      connectionFound: true,
    });
    return this.executeXTool({
      workspaceId: dispatch.workspaceId,
      userId,
      agentId: dispatch.agentId,
      connectionId: install.connectionId,
      toolName,
      body: normalizedBody,
      installMetadata: install.metadata,
    });
  }

  private async executeXTool(input: {
    workspaceId: string;
    userId: string;
    agentId: string;
    connectionId: string;
    toolName: string;
    body: Record<string, unknown>;
    installMetadata?: Record<string, unknown> | null;
  }) {
    const normalizedToolName = this.normalizeToolName(input.toolName);
    switch (normalizedToolName) {
      case "relay_x_get_account":
        return this.xMarketplaceService.readAccount(
          input.workspaceId,
          input.userId,
          input.connectionId,
        );
      case "relay_x_list_own_posts":
        return this.xMarketplaceService.readOwnPosts(
          input.workspaceId,
          input.userId,
          input.connectionId,
        );
      case "relay_x_draft_text_post":
        return this.xMarketplaceService.createDraft(
          this.requiredString(input.body.text, "text"),
        );
      case "relay_x_publish_text_post":
        return this.xMarketplaceService.createTextPost(
          input.workspaceId,
          input.userId,
          input.connectionId,
          {
            approvalId: this.requiredString(
              input.body.approvalId,
              "approvalId",
            ),
            requestingAgentId: input.agentId,
            text: this.stringOrUndefined(input.body.text),
          },
        );
      default:
        this.logExecutor({
          dispatchId: null,
          appSlug: "x",
          routeToolName: input.toolName,
          normalizedToolName,
          bodyKeys: Object.keys(input.body),
          normalizedBodyKeys: Object.keys(input.body),
          stage: "reject",
          matched: false,
          installFound: true,
          connectionFound: true,
          reason: "unsupported_tool",
        });
        throw new BadRequestException(
          `Unsupported X marketplace tool: ${input.toolName}`,
        );
    }
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

  private normalizeToolName(toolName: string) {
    return typeof toolName === "string" ? toolName.trim() : "";
  }

  private normalizeBody(
    body: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const objectBody =
      body && typeof body === "object" && !Array.isArray(body) ? body : {};
    const args = objectBody.arguments ?? objectBody.args;
    if (args && typeof args === "object" && !Array.isArray(args)) {
      return args as Record<string, unknown>;
    }
    return objectBody;
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

  private isSupportedToolName(toolName: string) {
    return new Set([
      "relay_x_get_account",
      "relay_x_list_own_posts",
      "relay_x_draft_text_post",
      "relay_x_publish_text_post",
    ]).has(this.normalizeToolName(toolName));
  }

  private logExecutor(input: {
    dispatchId: string | null;
    appSlug?: string;
    routeToolName: string;
    normalizedToolName: string;
    bodyKeys: string[];
    normalizedBodyKeys: string[];
    stage: string;
    matched: boolean;
    installFound?: boolean;
    connectionFound?: boolean;
    reason?: string;
  }) {
    this.logger.log(
      JSON.stringify({
        event: "marketplace.tool_executor.x",
        appSlug: input.appSlug ?? "x",
        ...input,
      }),
    );
  }

  private requiredString(value: unknown, field: string) {
    const stringValue = this.stringOrUndefined(value);
    if (!stringValue) {
      throw new BadRequestException(`${field} is required`);
    }
    return stringValue;
  }

  private stringOrUndefined(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}
