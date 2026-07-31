import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Optional,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  BridgeAuthenticated,
  JwtAuthenticated,
} from "../../common/decorators/public.decorator";
import { AllowReadOnlyEntitlement } from "../cloud-commercial/entitlement-bypass.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { AgentService } from "../agent/agent.service";
import { MessageService } from "../message/message.service";
import {
  BridgeAgentPayload,
  BridgeRuntimeModelCatalogPayload,
  BridgeService,
  BridgeTaskPayload,
} from "./bridge.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { ClaudeService } from "../claude/claude.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { RuntimeDispatchCoordinator } from "../runtime/runtime-dispatch-coordinator.service";
import { RuntimeDispatchService } from "../runtime/runtime-dispatch.service";
import { RuntimeStructuredJobService } from "../runtime/runtime-structured-job.service";
import { HermesBridgeRuntimeService } from "../hermes/hermes-bridge-runtime.service";
import { getTrustedClientIp } from "../security/client-ip";
import {
  BeginOpenClawAttachmentUploadDto,
  CompleteOpenClawAttachmentUploadDto,
  UploadOpenClawAttachmentChunkDto,
} from "../message/dto/message.dto";
import { ToolRequestService } from "../tool-request/tool-request.service";
import { CreateToolRequestDto } from "../tool-request/dto/tool-request.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RelayExecutionOwnerLeaseEntity } from "../../entities";
import { RuntimeEvent } from "../runtime/runtime.types";
import {
  AgentHostSyncExchangeInput,
  AgentHostSyncService,
} from "./agent-host-sync.service";
import { WorkspaceArtifactService } from "../workspace/workspace-artifact.service";
import { WorkspaceArtifactSyncDto } from "../workspace/dto/artifact.dto";
import {
  BridgeDeviceCredentialDto,
  CreateBridgeEnrollmentDto,
  RedeemBridgeEnrollmentDto,
} from "./dto/bridge-auth.dto";

const BRIDGE_ENROLLMENT_REDEEM_RATE_LIMIT = {
  default: { limit: 10, ttl: 60_000 },
};
const BRIDGE_ENROLLMENT_CREATE_RATE_LIMIT = {
  default: { limit: 10, ttl: 60_000 },
};
const BRIDGE_DEVICE_AUTH_RATE_LIMIT = {
  default: { limit: 30, ttl: 60_000 },
};

type RuntimeDispatchProgressPostback =
  | { type: "dispatch.accepted"; runtimeRunId?: string }
  | { type: "run.started"; runtimeRunId?: string }
  | {
      type: "run.delta";
      seq: number;
      text: string;
    }
  | {
      type: "run.thinking";
      seq: number;
      thinking: string;
      kind?: "thinking" | "reasoning";
    }
  | {
      type: "run.status";
      code: string;
      message: string;
    }
  | {
      type: "run.tool";
      toolName: string;
      phase: "started" | "updated" | "completed";
      summary?: string;
      tasks?: Array<{
        id: string;
        content: string;
        status: "pending" | "in_progress" | "completed" | "cancelled";
      }>;
      references?: Array<{
        uri: string;
        title?: string | null;
        kind?: string | null;
        source?: string | null;
      }>;
    }
  | {
      type: "run.context";
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
  | {
      type: "run.missing_tool_request";
      requestedCapability?: string;
      missingCapability?: string;
      capability?: string;
      requiredForAction?: string;
      action?: string;
      reason?: string;
      linkedAppId?: string | null;
      appSlug?: string | null;
      teamId?: string | null;
      threadId?: string | null;
      campaignId?: string | null;
      campaignName?: string | null;
      relatedTaskId?: string | null;
      relatedRecordType?: string | null;
      relatedRecordId?: string | null;
      autonomyModeAtRequest?: string | null;
      policyAllowed?: boolean;
      toolAvailable?: boolean;
      toolConnected?: boolean;
      toolGranted?: boolean;
      suggestedMarketplaceAppSlugs?: string[];
      suggestedMarketplaceApps?: string[];
      suggestedToolCategories?: string[];
      requiredEvidenceType?: string | null;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "run.completed";
      finalText?: string;
      metadata?: Record<string, unknown>;
    }
  | { type: "run.failed"; code: string; message: string; retryable: boolean }
  | { type: "run.cancelled" };

@ApiTags("bridge")
@BridgeAuthenticated()
@Controller("bridge")
export class BridgeController {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly agentService: AgentService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly claudeService: ClaudeService,
    private readonly messageService: MessageService,
    private readonly runtimeDispatchService: RuntimeDispatchService,
    private readonly runtimeBindingService: RuntimeBindingService,
    private readonly runtimeDispatchCoordinator: RuntimeDispatchCoordinator,
    private readonly runtimeStructuredJobService: RuntimeStructuredJobService,
    private readonly toolRequestService: ToolRequestService,
    private readonly hermesBridgeRuntimeService: HermesBridgeRuntimeService,
    private readonly agentHostSyncService: AgentHostSyncService,
    private readonly workspaceArtifacts: WorkspaceArtifactService,
    @Optional()
    @InjectRepository(RelayExecutionOwnerLeaseEntity)
    private readonly executionOwnerLeases?: Repository<RelayExecutionOwnerLeaseEntity>,
  ) {}

  @Post("artifacts/sync")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Publish a bridge host's metadata-only artifact catalogue",
  })
  async synchronizeArtifactCatalogue(
    @Body() body: WorkspaceArtifactSyncDto,
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    return this.workspaceArtifacts.synchronizeFromBridge(
      bridge.workspaceId,
      bridge.deviceId,
      body,
    );
  }

  @Post("agent-sync/exchange")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Exchange a runtime host's complete agent/document inventory with Railway",
  })
  async exchangeAgentInventory(
    @Body() body: AgentHostSyncExchangeInput,
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const exchange = await this.agentHostSyncService.exchange(bridge, body);
    await this.agentService.resumeWaitingProvisioningJobsForHost(
      bridge.workspaceId,
      exchange.runtimeHostId,
      body.runtimeType,
    );
    return exchange;
  }

  @Post("enroll")
  @Throttle(BRIDGE_ENROLLMENT_REDEEM_RATE_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @ApiOperation({ summary: "Redeem a one-time bridge enrollment code" })
  async enroll(@Body() body: RedeemBridgeEnrollmentDto, @Req() req: Request) {
    return this.bridgeService.redeemEnrollment(
      body.code,
      {
        deviceLabel: body.deviceLabel,
        pluginVersion: body.pluginVersion,
        openCoreVersion: body.openCoreVersion,
        runtimeType: body.runtimeType,
        hostType: body.hostType,
        apiContractVersion: body.apiContractVersion,
        websocketContractVersion: body.websocketContractVersion,
        capabilities: body.capabilities ?? [],
      },
      this.getRequestContext(req),
    );
  }

  @Post("device/auth")
  @Throttle(BRIDGE_DEVICE_AUTH_RATE_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @ApiOperation({ summary: "Authenticate a paired bridge device" })
  async authenticateDevice(
    @Body() body: BridgeDeviceCredentialDto,
    @Req() req: Request,
  ) {
    return this.bridgeService.authenticateDevice(
      body.devicePublicId,
      body.deviceToken,
      {
        pluginVersion: body.pluginVersion,
        openCoreVersion: body.openCoreVersion,
        runtimeType: body.runtimeType,
        hostType: body.hostType,
        apiContractVersion: body.apiContractVersion,
        websocketContractVersion: body.websocketContractVersion,
        capabilities: body.capabilities ?? [],
      },
      this.getRequestContext(req),
    );
  }

  @Post("device/rotate")
  @Throttle(BRIDGE_DEVICE_AUTH_RATE_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @ApiOperation({ summary: "Rotate a paired bridge device credential" })
  async rotateDeviceCredential(
    @Body() body: BridgeDeviceCredentialDto,
    @Req() req: Request,
  ) {
    return this.bridgeService.rotateDeviceCredential(
      body.devicePublicId,
      body.deviceToken,
      {
        pluginVersion: body.pluginVersion,
        openCoreVersion: body.openCoreVersion,
        runtimeType: body.runtimeType,
        hostType: body.hostType,
        apiContractVersion: body.apiContractVersion,
        websocketContractVersion: body.websocketContractVersion,
        capabilities: body.capabilities ?? [],
      },
      this.getRequestContext(req),
    );
  }

  @Get("runtime-dispatches/pending")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Return pending Hermes bridge dispatches for reconnect backfill",
  })
  async listPendingRuntimeDispatches(
    @Query("externalAgentIds") externalAgentIds: string | string[] | undefined,
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const normalizedExternalAgentIds = (
      Array.isArray(externalAgentIds)
        ? externalAgentIds
        : typeof externalAgentIds === "string"
          ? externalAgentIds.split(",")
          : []
    )
      .map((id) => id.trim())
      .filter(Boolean);
    const dispatches =
      await this.hermesBridgeRuntimeService.listPendingBackfill({
        workspaceId: bridge.workspaceId,
        externalAgentIds: normalizedExternalAgentIds,
      });
    return {
      success: true,
      workspaceId: bridge.workspaceId,
      count: dispatches.length,
      dispatches,
    };
  }

  @Post("execution-owner-leases/heartbeat")
  @HttpCode(HttpStatus.OK)
  async heartbeatExecutionOwnerLeases(
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    if (!this.executionOwnerLeases) {
      throw new ConflictException("EXECUTION_OWNER_LEASE_STORAGE_UNAVAILABLE");
    }
    const leaseExpiresAt = new Date(Date.now() + 120_000);
    const result = await this.executionOwnerLeases.update(
      {
        workspaceId: bridge.workspaceId,
        bridgeDeviceId: bridge.deviceId,
        state: "active",
      },
      { leaseExpiresAt },
    );
    return {
      deviceId: bridge.deviceId,
      renewedLeaseCount: result.affected ?? 0,
      leaseExpiresAt,
    };
  }

  @Get("connections")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getConnections(
    @CurrentUser() user: AuthenticatedUser,
    @Query("workspaceId") workspaceId: string,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.bridgeService.getConnections(workspaceId);
  }

  @Post("attachments/openclaw/init")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async beginOpenClawAttachmentUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BeginOpenClawAttachmentUploadDto,
  ) {
    return this.bridgeService.beginOpenClawAttachmentUpload({
      ...body,
      userId: user.id,
    });
  }

  @Post("attachments/openclaw/chunk")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async uploadOpenClawAttachmentChunk(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UploadOpenClawAttachmentChunkDto,
  ) {
    return this.bridgeService.uploadOpenClawAttachmentChunk({
      ...body,
      userId: user.id,
    });
  }

  @Post("attachments/openclaw/complete")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async completeOpenClawAttachmentUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CompleteOpenClawAttachmentUploadDto,
  ) {
    return this.bridgeService.completeOpenClawAttachmentUpload({
      ...body,
      userId: user.id,
    });
  }

  @Post("attachments/openclaw/cancel")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async cancelOpenClawAttachmentUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CompleteOpenClawAttachmentUploadDto,
  ) {
    return this.bridgeService.cancelOpenClawAttachmentUpload({
      ...body,
      userId: user.id,
    });
  }

  @Post("connections")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      workspaceId: string;
      instanceUrl: string;
      apiKey?: string;
      useMockMode?: boolean;
    },
    @Req() req: Request,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      body.workspaceId,
      user.id,
    );
    return this.bridgeService.createConnection(
      body.workspaceId,
      body.instanceUrl,
      body.apiKey,
      body.useMockMode,
      user.id,
      this.getRequestContext(req),
    );
  }

  @Get("connections/:id")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const connection = await this.bridgeService.getConnectionStatus(id);
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      connection.workspaceId,
      user.id,
    );
    return connection;
  }

  @Post("connections/:id/reconnect")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async reconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    const connection = await this.bridgeService.getConnectionStatus(id);
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      connection.workspaceId,
      user.id,
    );
    await this.bridgeService.triggerReconnect(
      id,
      user.id,
      this.getRequestContext(req),
    );
    return { success: true };
  }

  @Post("sync")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async triggerSync(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { workspaceId: string },
    @Req() req: Request,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      body.workspaceId,
      user.id,
    );
    await this.bridgeService.recordSyncRequested(
      body.workspaceId,
      user.id,
      this.getRequestContext(req),
    );
    return {
      success: true,
      message: "Sync triggered",
      workspaceId: body.workspaceId,
    };
  }

  @Post("workspaces/:id/enrollments")
  @Throttle(BRIDGE_ENROLLMENT_CREATE_RATE_LIMIT)
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a one-time bridge enrollment code" })
  async createEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") workspaceId: string,
    @Body() body: CreateBridgeEnrollmentDto,
    @Req() req: Request,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.bridgeService.createEnrollment(
      workspaceId,
      user.id,
      body.deviceLabel,
      body.expiresInMinutes,
      this.getRequestContext(req),
    );
  }

  @Get("workspaces/:id/devices")
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List paired bridge devices for a workspace" })
  async listDevices(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") workspaceId: string,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.bridgeService.listBridgeDevices(workspaceId);
  }

  @Post("devices/:id/revoke")
  @AllowReadOnlyEntitlement()
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke a single paired bridge device" })
  async revokeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") deviceId: string,
    @Req() req: Request,
  ) {
    const device = await this.bridgeService.getBridgeDevice(deviceId);
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      device.workspaceId,
      user.id,
    );
    await this.bridgeService.revokeBridgeDevice(
      device.id,
      user.id,
      this.getRequestContext(req),
    );
    return { success: true, deviceId };
  }

  @Post("workspaces/:id/devices/revoke-all")
  @AllowReadOnlyEntitlement()
  @JwtAuthenticated()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke all paired bridge devices for a workspace" })
  async revokeAllDevices(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") workspaceId: string,
    @Req() req: Request,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    const revokedDeviceIds = await this.bridgeService.revokeAllBridgeDevices(
      workspaceId,
      user.id,
      this.getRequestContext(req),
    );
    return { success: true, revokedDeviceIds };
  }

  @Post("agents")
  @HttpCode(HttpStatus.OK)
  async syncAgent(
    @Body() body: { agent: BridgeAgentPayload },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertWorkspaceScope(
      bridge.workspaceId,
      body.agent.workspaceId,
    );
    const agent = await this.bridgeService.createOrUpdateAgentFromBridge(
      bridge.workspaceId,
      {
        ...body.agent,
        metadata: {
          ...(body.agent.metadata ?? {}),
          bridgeDeviceId: bridge.deviceId,
          devicePublicId: bridge.devicePublicId,
        },
      },
    );
    return { id: agent.id, name: agent.name };
  }

  @Post("agents/:externalId/clear-mapping")
  @HttpCode(HttpStatus.OK)
  async clearAgentMapping(
    @Param("externalId") externalId: string,
    @Body() body: { workspaceId: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertWorkspaceScope(
      bridge.workspaceId,
      body.workspaceId,
    );
    const result = await this.bridgeService.clearExternalIdMapping(
      externalId,
      bridge.workspaceId,
    );
    return { success: true, externalId, ...result };
  }

  @Patch("agents/:externalId/status")
  @HttpCode(HttpStatus.OK)
  async updateAgentStatus(
    @Param("externalId") externalId: string,
    @Body() body: { status: string },
    @Headers() headers: Record<string, string>,
  ) {
    await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    return { success: true, externalId, status: body.status };
  }

  @Post("messages")
  @HttpCode(HttpStatus.CREATED)
  async postMessage(
    @Body()
    body: {
      threadId: string;
      threadSessionId?: string;
      dispatchId?: string;
      content: string;
      senderId: string;
      embeddedCard?: object;
      senderName?: string;
      metadata?: Record<string, unknown>;
    },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertThreadInWorkspace(
      body.threadId,
      bridge.workspaceId,
    );
    const runtimeDispatch = body.dispatchId
      ? await this.runtimeDispatchService.findById(body.dispatchId)
      : null;
    if (body.dispatchId && !runtimeDispatch) {
      throw new BadRequestException(
        `Runtime dispatch ${body.dispatchId} not found`,
      );
    }
    if (runtimeDispatch && runtimeDispatch.threadId !== body.threadId) {
      throw new BadRequestException(
        `Runtime dispatch ${body.dispatchId} does not belong to thread ${body.threadId}`,
      );
    }
    const runtimeBinding = runtimeDispatch
      ? await this.assertBridgeRuntimePostbackAuthorized(
          bridge,
          runtimeDispatch,
        )
      : null;
    if (body.dispatchId && runtimeBinding?.runtimeType === "claude_code") {
      const claudeDispatch = await this.claudeService.getDispatchOrThrow(
        body.dispatchId,
      );
      if (claudeDispatch.bridgeDeviceId !== bridge.deviceId) {
        throw new ForbiddenException(
          "Claude dispatch belongs to another bridge device",
        );
      }
    }
    if (body.threadSessionId) {
      const isActive = await this.claudeService.validateActiveThreadSession(
        body.threadId,
        body.threadSessionId,
      );
      if (!isActive) {
        throw new ConflictException("Thread session is no longer active");
      }
    }
    const rawBridgeMessageMetadata = {
      ...(body.metadata ?? {}),
      ...(body.dispatchId ? { runtimeDispatchId: body.dispatchId } : {}),
    };
    const enrichedBridgeMessageMetadata =
      body.dispatchId && runtimeDispatch
        ? await this.runtimeDispatchCoordinator.documentMetadataForPostback(
            body.dispatchId,
            rawBridgeMessageMetadata,
          )
        : rawBridgeMessageMetadata;
    const bridgeMessageMetadata = sanitizeBridgeMessageMetadata(
      enrichedBridgeMessageMetadata,
    );
    const message = await this.bridgeService.postBridgeMessage(
      body.threadId,
      bridge.workspaceId,
      body.content,
      body.senderId,
      body.embeddedCard,
      body.senderName,
      bridgeMessageMetadata,
      {
        preferredAgentId: runtimeDispatch?.agentId ?? null,
      },
    );
    if (body.dispatchId) {
      if (runtimeBinding?.runtimeType === "claude_code") {
        await this.claudeService.attachPostedMessage(
          body.dispatchId,
          message.id,
        );
      } else if (runtimeDispatch) {
        await this.runtimeDispatchCoordinator.completeDispatchFromPostback({
          dispatchId: body.dispatchId,
          postedMessageId: message.id,
          resultSummary: body.content,
          resultMetadata: bridgeMessageMetadata,
        });
      }
    }
    return { id: message.id };
  }

  @Post("runtime-dispatches/:id/events")
  @HttpCode(HttpStatus.OK)
  async postRuntimeDispatchEvent(
    @Param("id") dispatchId: string,
    @Body() body: RuntimeDispatchProgressPostback,
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const dispatch = await this.runtimeDispatchService.findById(dispatchId);
    if (!dispatch) {
      throw new BadRequestException(`Runtime dispatch ${dispatchId} not found`);
    }

    await this.bridgeService.assertThreadInWorkspace(
      dispatch.threadId,
      bridge.workspaceId,
    );
    const runtimeBinding = await this.assertBridgeRuntimePostbackAuthorized(
      bridge,
      dispatch,
    );
    const runtimeEvent = { ...body, dispatchId } as RuntimeEvent;
    const acceptedByHermes =
      runtimeBinding.runtimeType === "hermes"
        ? await this.hermesBridgeRuntimeService.acceptBridgeEvent({
            workspaceId: bridge.workspaceId,
            event: runtimeEvent as never,
          })
        : false;
    if (acceptedByHermes) {
      return {
        success: true,
        dispatchId,
        type: body.type,
        terminalAcknowledged: [
          "run.completed",
          "run.failed",
          "run.cancelled",
        ].includes(body.type),
      };
    }
    if (body.type === "run.failed") {
      await this.runtimeDispatchCoordinator.failDispatchById({
        dispatchId,
        code: body.code,
        message: body.message,
        retryable: body.retryable,
      });
      return {
        success: true,
        dispatchId,
        type: body.type,
        terminalAcknowledged: true,
      };
    }
    if (body.type === "run.cancelled") {
      await this.runtimeDispatchCoordinator.cancelDispatch(dispatchId);
      return {
        success: true,
        dispatchId,
        type: body.type,
        terminalAcknowledged: true,
      };
    }
    if (body.type === "run.completed") {
      // OpenClaw completes through the idempotent bridge/messages postback so the
      // canonical reply and dispatch transition happen in one coordinator path.
      return {
        success: true,
        dispatchId,
        type: body.type,
        terminalAcknowledged: false,
        requiresMessagePostback: true,
      };
    }
    if (body.type === "dispatch.accepted" || body.type === "run.started") {
      return { success: true, dispatchId, type: body.type };
    }
    if (body.type !== "run.missing_tool_request") {
      await this.runtimeDispatchCoordinator.emitProgressFromPostback({
        dispatchId,
        event: body,
      });
    }
    const toolRequestResult = await this.createToolRequestFromRuntimeEvent(
      bridge.workspaceId,
      dispatch,
      body,
    );
    return { success: true, dispatchId, type: body.type, toolRequestResult };
  }

  @Post("runtime-dispatches/:id/tool-requests")
  @HttpCode(HttpStatus.OK)
  async postRuntimeDispatchToolRequest(
    @Param("id") dispatchId: string,
    @Body() body: CreateToolRequestDto,
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const dispatch = await this.runtimeDispatchService.findById(dispatchId);
    if (!dispatch) {
      throw new BadRequestException(`Runtime dispatch ${dispatchId} not found`);
    }
    await this.bridgeService.assertThreadInWorkspace(
      dispatch.threadId,
      bridge.workspaceId,
    );
    await this.assertBridgeRuntimePostbackAuthorized(bridge, dispatch);
    const result = await this.toolRequestService.createToolRequest(
      bridge.workspaceId,
      {
        ...body,
        threadId: body.threadId ?? dispatch.threadId,
        requestingAgentId:
          body.requestingAgentId ?? body.agentId ?? dispatch.agentId,
        metadata: {
          ...(body.metadata ?? {}),
          dispatchId,
          runtimeBindingId: dispatch.runtimeBindingId,
        },
      },
    );
    return { success: true, dispatchId, ...result };
  }

  private async createToolRequestFromRuntimeEvent(
    workspaceId: string,
    dispatch: {
      id: string;
      threadId: string;
      agentId: string;
      runtimeBindingId?: string | null;
    },
    body: RuntimeDispatchProgressPostback,
  ) {
    if (body.type !== "run.missing_tool_request") return null;
    const requestedCapability =
      this.stringOrNull(body.requestedCapability) ??
      this.stringOrNull(body.missingCapability) ??
      this.stringOrNull(body.capability);
    if (!requestedCapability) {
      throw new BadRequestException(
        "Missing tool request capability is required",
      );
    }
    const requiredForAction =
      this.stringOrNull(body.requiredForAction) ??
      this.stringOrNull(body.action) ??
      requestedCapability;
    const reason =
      this.stringOrNull(body.reason) ??
      `Policy allows ${requestedCapability}, but no executable tool is connected or granted.`;
    return this.toolRequestService.createToolRequest(workspaceId, {
      linkedAppId: this.stringOrNull(body.linkedAppId),
      appSlug: this.stringOrNull(body.appSlug) ?? "local-linkcrest",
      teamId: this.stringOrNull(body.teamId),
      threadId: this.stringOrNull(body.threadId) ?? dispatch.threadId,
      campaignId: this.stringOrNull(body.campaignId),
      campaignName: this.stringOrNull(body.campaignName),
      requestingAgentId: dispatch.agentId,
      requestedCapability,
      requiredForAction,
      reason,
      relatedTaskId: this.stringOrNull(body.relatedTaskId),
      relatedRecordType: this.stringOrNull(body.relatedRecordType),
      relatedRecordId: this.stringOrNull(body.relatedRecordId),
      autonomyModeAtRequest: this.stringOrNull(body.autonomyModeAtRequest),
      policyAllowed: body.policyAllowed ?? true,
      toolAvailable: body.toolAvailable ?? false,
      toolConnected: body.toolConnected ?? false,
      toolGranted: body.toolGranted ?? false,
      suggestedMarketplaceAppSlugs: body.suggestedMarketplaceAppSlugs,
      suggestedMarketplaceApps: body.suggestedMarketplaceApps,
      suggestedToolCategories: body.suggestedToolCategories,
      requiredEvidenceType: this.stringOrNull(body.requiredEvidenceType),
      metadata: {
        ...(body.metadata ?? {}),
        dispatchId: dispatch.id,
        runtimeBindingId: dispatch.runtimeBindingId ?? null,
        source: "runtime_event",
      },
    });
  }

  private stringOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private async assertBridgeRuntimePostbackAuthorized(
    bridge: { workspaceId: string; deviceId: string; runtimeType: string },
    dispatch: {
      id: string;
      workspaceId: string;
      agentId: string;
      runtimeBindingId: string;
      runtimeHostId?: string | null;
      assignmentEpoch?: string | number;
    },
  ) {
    const runtimeBinding = await this.runtimeBindingService.findById(
      dispatch.runtimeBindingId,
    );
    await this.bridgeService.assertBridgeDeviceRuntimeDispatchBinding({
      workspaceId: bridge.workspaceId,
      bridgeDeviceId: bridge.deviceId,
      bridgeRuntimeType: bridge.runtimeType,
      dispatch,
      runtimeBinding,
    });
    return runtimeBinding;
  }

  private async assertClaudeDispatchPostbackAuthorized(
    bridge: { workspaceId: string; deviceId: string; runtimeType: string },
    dispatchId: string,
    allowUnclaimed: boolean,
  ) {
    const [legacyDispatch, runtimeDispatch] = await Promise.all([
      this.claudeService.getDispatchOrThrow(dispatchId),
      this.runtimeDispatchService.findById(dispatchId),
    ]);
    if (!runtimeDispatch) {
      throw new BadRequestException(`Runtime dispatch ${dispatchId} not found`);
    }
    if (
      legacyDispatch.bridgeDeviceId !== bridge.deviceId &&
      !(allowUnclaimed && legacyDispatch.bridgeDeviceId === null)
    ) {
      throw new ForbiddenException(
        "Claude dispatch belongs to another bridge device",
      );
    }
    await this.assertBridgeRuntimePostbackAuthorized(bridge, runtimeDispatch);
    return legacyDispatch;
  }

  @Post("structured-jobs/:id/result")
  @HttpCode(HttpStatus.OK)
  async completeStructuredJob(
    @Param("id") jobId: string,
    @Body()
    body: {
      output: unknown;
      model?: string | null;
      metadata?: Record<string, unknown> | null;
    },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const accepted = await this.runtimeStructuredJobService.completeJob({
      jobId,
      workspaceId: bridge.workspaceId,
      output: body.output,
      model: body.model ?? null,
      metadata: body.metadata ?? null,
    });
    if (!accepted) {
      throw new BadRequestException(
        `Structured job ${jobId} not found or not pending`,
      );
    }
    return { success: true, jobId };
  }

  @Post("structured-jobs/:id/error")
  @HttpCode(HttpStatus.OK)
  async failStructuredJob(
    @Param("id") jobId: string,
    @Body()
    body: {
      code: string;
      message: string;
      retryable?: boolean;
      metadata?: Record<string, unknown> | null;
    },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const accepted = await this.runtimeStructuredJobService.failJob({
      jobId,
      workspaceId: bridge.workspaceId,
      code: body.code || "runtime_structured_job_failed",
      message: body.message || "Runtime structured job failed",
      retryable: body.retryable ?? false,
      metadata: body.metadata ?? null,
    });
    if (!accepted) {
      throw new BadRequestException(
        `Structured job ${jobId} not found or not pending`,
      );
    }
    return { success: true, jobId };
  }

  @Post("claude-dispatches/start")
  @HttpCode(HttpStatus.OK)
  async markClaudeDispatchStarted(
    @Body()
    body: {
      dispatchId: string;
    },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const dispatch = await this.assertClaudeDispatchPostbackAuthorized(
      bridge,
      body.dispatchId,
      true,
    );
    await this.bridgeService.assertThreadInWorkspace(
      dispatch.threadId,
      bridge.workspaceId,
    );
    await this.claudeService.markDispatchStarted({
      dispatchId: body.dispatchId,
      bridgeDeviceId: bridge.deviceId,
    });
    return { success: true, dispatchId: body.dispatchId };
  }

  @Post("claude-dispatches/:id/complete")
  @HttpCode(HttpStatus.OK)
  async completeClaudeDispatch(
    @Param("id") dispatchId: string,
    @Body()
    body: {
      resultSummary?: string | null;
      resultMetadata?: Record<string, unknown>;
    },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const dispatch = await this.assertClaudeDispatchPostbackAuthorized(
      bridge,
      dispatchId,
      false,
    );
    await this.bridgeService.assertThreadInWorkspace(
      dispatch.threadId,
      bridge.workspaceId,
    );
    await this.claudeService.markDispatchCompleted({
      dispatchId,
      resultSummary: body.resultSummary ?? null,
      resultMetadata: body.resultMetadata ?? {},
    });
    return { success: true, dispatchId };
  }

  @Post("claude-dispatches/:id/fail")
  @HttpCode(HttpStatus.OK)
  async failClaudeDispatch(
    @Param("id") dispatchId: string,
    @Body()
    body: {
      errorCode: string;
      errorMessage: string;
      notifyThread?: boolean;
    },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const dispatch = await this.assertClaudeDispatchPostbackAuthorized(
      bridge,
      dispatchId,
      false,
    );
    await this.bridgeService.assertThreadInWorkspace(
      dispatch.threadId,
      bridge.workspaceId,
    );
    const failed = await this.claudeService.markDispatchFailed({
      dispatchId,
      errorCode: body.errorCode,
      errorMessage: body.errorMessage,
    });
    const isStillActive = await this.claudeService.validateActiveThreadSession(
      failed.threadId,
      failed.threadSessionId,
    );
    if (body.notifyThread !== false && isStillActive) {
      const agent = await this.claudeService.getAgentWithBinding(
        failed.agentId,
      );
      await this.messageService.sendSystemMessage(
        failed.threadId,
        `${agent?.name ?? "Claude agent"} failed: ${body.errorMessage}`,
      );
    }
    return { success: true, dispatchId };
  }

  @Post("heartbeat")
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Headers() headers: Record<string, string>) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.claudeService.recordHeartbeat(bridge.deviceId);
    return { success: true, deviceId: bridge.deviceId };
  }

  @Post("runtime-model-catalog")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Publish a runtime-observed model catalogue" })
  async publishRuntimeModelCatalog(
    @Body() body: BridgeRuntimeModelCatalogPayload,
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    return this.bridgeService.publishRuntimeModelCatalog(bridge, body);
  }

  @Post("tasks")
  @HttpCode(HttpStatus.OK)
  async syncTask(
    @Body() body: { task: BridgeTaskPayload },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertWorkspaceScope(
      bridge.workspaceId,
      body.task.workspaceId,
    );
    await this.bridgeService.assertBridgeDeviceExternalAgentBinding({
      workspaceId: bridge.workspaceId,
      bridgeDeviceId: bridge.deviceId,
      externalAgentId: body.task.externalAgentId,
    });
    const result = await this.bridgeService.createOrUpdateTaskFromBridge(
      bridge.workspaceId,
      body.task,
    );
    return { id: result.id, status: result.status };
  }

  @Patch("tasks/:externalId/status")
  @HttpCode(HttpStatus.OK)
  async updateTaskStatus(
    @Param("externalId") externalId: string,
    @Body() body: { status: string },
    @Headers() headers: Record<string, string>,
  ) {
    await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    return { success: true, externalId, status: body.status };
  }

  @Post("runs")
  @HttpCode(HttpStatus.CREATED)
  async createRun(
    @Body() body: { taskId: string; agentId: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertTaskAndAgentInWorkspace(
      body.taskId,
      body.agentId,
      bridge.workspaceId,
    );
    const run = await this.bridgeService.createRunRecord(
      body.taskId,
      body.agentId,
    );
    return { id: run.id };
  }

  @Post("runs/:runId/events")
  @HttpCode(HttpStatus.CREATED)
  async addRunEvent(
    @Param("runId") runId: string,
    @Body() body: { type: string; content: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertRunInWorkspace(runId, bridge.workspaceId);
    const event = await this.bridgeService.addRunEvent(
      runId,
      body.type,
      body.content,
    );
    return { id: event.id };
  }

  @Patch("runs/:runId/complete")
  @HttpCode(HttpStatus.OK)
  async completeRun(
    @Param("runId") runId: string,
    @Body() body: { status: string; error?: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertRunInWorkspace(runId, bridge.workspaceId);
    await this.bridgeService.completeRun(runId, body.status, body.error);
    return { success: true };
  }

  @Post("events")
  @HttpCode(HttpStatus.CREATED)
  async logBridgeEvent(
    @Body()
    body: { connectionId: string; type: string; payload: any; status: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertConnectionInWorkspace(
      body.connectionId,
      bridge.workspaceId,
    );
    await this.bridgeService.addWorkLog(
      bridge.devicePublicId,
      body.type,
      JSON.stringify(body.payload),
    );
    return { success: true };
  }

  @Patch("events/:eventId/processed")
  @HttpCode(HttpStatus.OK)
  async markEventProcessed(
    @Param("eventId") eventId: string,
    @Headers() headers: Record<string, string>,
  ) {
    await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    return { success: true, eventId };
  }

  @Patch("events/:eventId/failed")
  @HttpCode(HttpStatus.OK)
  async markEventFailed(
    @Param("eventId") eventId: string,
    @Body() body: { error: string },
    @Headers() headers: Record<string, string>,
  ) {
    await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    return { success: true, eventId, error: body.error };
  }

  @Post("provision-jobs/:id/progress")
  @HttpCode(HttpStatus.OK)
  async updateProvisioningProgress(
    @Param("id") id: string,
    @Body() body: { status?: string; stage: string; message?: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertProvisioningJobInWorkspace(
      id,
      bridge.workspaceId,
    );
    const job = await this.agentService.updateProvisioningJobProgress(
      id,
      body,
      bridge.deviceId,
    );
    return { success: true, id: job.id, status: job.status, stage: job.stage };
  }

  @Post("provision-jobs/:id/complete")
  @HttpCode(HttpStatus.OK)
  async completeProvisioningJob(
    @Param("id") id: string,
    @Body()
    body: {
      message?: string;
      externalAgentId?: string;
      createdAgentId?: string;
      connectionId?: string;
      agent?: BridgeAgentPayload;
    },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertProvisioningJobInWorkspace(
      id,
      bridge.workspaceId,
    );
    const job = await this.agentService.completeProvisioningJob(
      id,
      body,
      bridge.deviceId,
    );
    return { success: true, id: job.id, status: job.status, stage: job.stage };
  }

  @Post("provision-jobs/:id/fail")
  @HttpCode(HttpStatus.OK)
  async failProvisioningJob(
    @Param("id") id: string,
    @Body() body: { error: string; stage?: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertProvisioningJobInWorkspace(
      id,
      bridge.workspaceId,
    );
    const job = await this.agentService.failProvisioningJob(
      id,
      body.error,
      body.stage,
      bridge.deviceId,
    );
    return { success: true, id: job.id, status: job.status, stage: job.stage };
  }

  @Post("hermes-provisions/:agentId/complete")
  @HttpCode(HttpStatus.OK)
  async completeHermesNativeProvision(
    @Param("agentId") agentId: string,
    @Body()
    body: {
      runtimeHostId: string;
      externalAgentId: string;
      nativeProfileName?: string;
      profile?: Record<string, unknown>;
    },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    const agent = await this.agentService.completeHermesNativeProvision(
      agentId,
      body,
      bridge.deviceId,
      bridge.workspaceId,
    );
    return {
      success: true,
      agentId: agent.id,
      externalAgentId: agent.externalId,
      provisioningStatus: agent.provisioningStatus,
    };
  }

  @Post("hermes-provisions/:agentId/fail")
  @HttpCode(HttpStatus.OK)
  async failHermesNativeProvision(
    @Param("agentId") agentId: string,
    @Body() body: { runtimeHostId: string; error: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    return this.agentService.failHermesNativeProvision(
      agentId,
      body,
      bridge.deviceId,
      bridge.workspaceId,
    );
  }

  @Post("threads/:threadId/remove-agent")
  @HttpCode(HttpStatus.OK)
  async removeAgentFromThread(
    @Param("threadId") threadId: string,
    @Body() body: { agentId: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertThreadInWorkspace(
      threadId,
      bridge.workspaceId,
    );
    await this.bridgeService.assertAgentInWorkspace(
      body.agentId,
      bridge.workspaceId,
    );
    const result = await this.bridgeService.removeAgentFromThread(
      threadId,
      body.agentId,
    );
    return { success: true, ...result };
  }

  @Post("threads/:threadId/reset-agents")
  @HttpCode(HttpStatus.OK)
  async resetThreadAgents(
    @Param("threadId") threadId: string,
    @Body() body: { agentIds?: string[] },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertThreadInWorkspace(
      threadId,
      bridge.workspaceId,
    );
    for (const agentId of body.agentIds ?? []) {
      await this.bridgeService.assertAgentInWorkspace(
        agentId,
        bridge.workspaceId,
      );
    }
    const result = await this.bridgeService.resetThreadAgentIds(
      threadId,
      body.agentIds ?? [],
    );
    return { success: true, ...result };
  }

  @Post("fix-agent-description")
  @HttpCode(HttpStatus.OK)
  async fixAgentDescription(
    @Body() body: { agentId: string; description: string },
    @Headers() headers: Record<string, string>,
  ) {
    const bridge = await this.bridgeService.authenticateBridgeAccessToken(
      headers.authorization,
    );
    await this.bridgeService.assertAgentInWorkspace(
      body.agentId,
      bridge.workspaceId,
    );
    const result = await this.bridgeService.fixAgentDescription(
      body.agentId,
      body.description,
    );
    return { success: true, ...result };
  }

  private getRequestContext(req: Request) {
    return {
      ipAddress: getTrustedClientIp(req),
      userAgent: req.get("user-agent") ?? null,
    };
  }
}

const DOCUMENT_REFERENCE_KIND_VALUES = new Set([
  "workspace_file",
  "memory_file",
  "skill",
  "workflow",
  "library_doc",
  "system_doc",
  "web",
  "artifact",
  "unknown",
]);

const DOCUMENT_REFERENCE_ROLE_VALUES = new Set([
  "knowledge",
  "routing",
  "rule",
  "memory",
  "evidence",
  "artifact",
]);

const DOCUMENT_REFERENCE_ACTION_VALUES = new Set([
  "consulted",
  "read",
  "routed_to",
  "used",
  "generated",
  "modified",
]);

const DOCUMENT_REFERENCE_SOURCE_VALUES = new Set([
  "tool_call",
  "tool_result",
  "prompt_context",
  "skill_router",
  "workflow_router",
  "agent_declared",
  "parsed_markdown",
]);

const DOCUMENT_REFERENCE_CONFIDENCE_VALUES = new Set([
  "observed",
  "injected",
  "inferred",
  "agent_declared",
]);

function sanitizeBridgeMessageMetadata(metadata: Record<string, unknown>) {
  const next = { ...metadata };
  const documentReferences = sanitizeDocumentReferences(
    metadata.documentReferences,
  );

  if (documentReferences.length) {
    next.documentReferences = documentReferences;
    next.referenceSummary = {
      count: documentReferences.length,
      hasSensitive: documentReferences.some(
        (reference) => reference.sensitive === true,
      ),
      redactedCount: documentReferences.filter(
        (reference) => reference.redacted === true,
      ).length,
    };
  } else {
    delete next.documentReferences;
    delete next.referenceSummary;
  }

  return next;
}

function sanitizeDocumentReferences(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 50)
    .flatMap((item, index): Array<Record<string, unknown>> => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }

      const record = item as Record<string, unknown>;
      const kind = readEnumValue(record.kind, DOCUMENT_REFERENCE_KIND_VALUES);
      const displayPath = sanitizeReferencePath(
        readOptionalString(record.displayPath, 240),
      );
      const title =
        sanitizeReferencePath(readOptionalString(record.title, 120)) ??
        displayPath ??
        "Reference";
      const uri = sanitizeReferenceUri(readOptionalString(record.uri, 500));
      const sanitized = {
        id: readOptionalString(record.id, 80) ?? `ref_${index + 1}`,
        kind: kind ?? "unknown",
        title,
        displayPath,
        uri,
        mimeType: readOptionalString(record.mimeType, 120),
        role: readEnumValue(record.role, DOCUMENT_REFERENCE_ROLE_VALUES),
        action: readEnumValue(record.action, DOCUMENT_REFERENCE_ACTION_VALUES),
        source: readEnumValue(record.source, DOCUMENT_REFERENCE_SOURCE_VALUES),
        confidence: readEnumValue(
          record.confidence,
          DOCUMENT_REFERENCE_CONFIDENCE_VALUES,
        ),
        sensitive: record.sensitive === true,
        redacted: record.redacted === true,
      };

      return [dropUndefinedValues(sanitized)];
    });
}

function readOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function readEnumValue(value: unknown, allowedValues: Set<string>) {
  return typeof value === "string" && allowedValues.has(value)
    ? value
    : undefined;
}

function sanitizeReferencePath(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const normalized = value.replace(/\\/g, "/");
  if (/^[a-z]:\//i.test(normalized)) {
    return normalized.split("/").slice(-3).join("/");
  }
  if (normalized.startsWith("/")) {
    return normalized.split("/").filter(Boolean).slice(-3).join("/");
  }
  if (normalized.startsWith("~")) {
    return normalized.replace(/^~\/?/, "");
  }

  return normalized;
}

function sanitizeReferenceUri(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("openclaw://")) {
    return value;
  }

  return undefined;
}

function dropUndefinedValues(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}
