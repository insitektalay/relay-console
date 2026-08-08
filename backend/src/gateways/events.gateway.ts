import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Server, WebSocket, type RawData } from "ws";
import { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { WebSessionEntity } from "../entities/web-session.entity";
import { MobileSessionEntity } from "../entities/mobile-session.entity";
import { BridgeControlCoordinatorService } from "./bridge-control-coordinator.service";
import { BridgeControlBusService } from "./bridge-control-bus.service";
import { ThreadEntity } from "../entities/thread.entity";
import { AgentEntity } from "../entities/agent.entity";
import {
  BridgeDeviceEntity,
  BridgeDeviceStatus,
} from "../entities/bridge-device.entity";
import { RuntimeBindingService } from "../modules/runtime/runtime-binding.service";
import { RuntimeDispatchCoordinator } from "../modules/runtime/runtime-dispatch-coordinator.service";
import { RuntimeDispatchService } from "../modules/runtime/runtime-dispatch.service";
import { RuntimeEventService } from "../modules/runtime/runtime-event.service";
import { RuntimeThreadSessionService } from "../modules/runtime/runtime-thread-session.service";
import { AgentOpsService } from "../modules/agent-ops/agent-ops.service";
import { mergeServerAuthorizedBridgeCapabilities } from "../modules/bridge/bridge-capabilities";
import {
  HermesBridgeInboundEvent,
  HermesBridgeRuntimeService,
} from "../modules/hermes/hermes-bridge-runtime.service";
import {
  MESSAGE_CONTENT_FORMAT_MARKDOWN,
  prepareAgentReplyForStorage,
} from "../modules/message/response-presentation";
import { WorkspaceMembershipService } from "../modules/workspace-membership/workspace-membership.service";
import { AuditLogService } from "../modules/audit-log/audit-log.service";
import { MessageEntity, MessageProvenance } from "../entities/message.entity";
import { getRateLimitTracker } from "../modules/security/client-ip";
import { CloudCommercialService } from "../modules/cloud-commercial/cloud-commercial.service";
import { WebsocketTicketReplayService } from "./websocket-ticket-replay.service";
import { DistributedRateLimitService } from "../modules/security/distributed-rate-limit.service";
import {
  BRIDGE_RUNTIME_TYPES,
  BridgeRuntimeType,
} from "../modules/bridge/bridge-compatibility-policy";
import {
  getRealtimeOriginRejectionReason,
  getPositiveConfigInt,
  getRawWebsocketDataByteLength,
  hashRealtimeTelemetryValue,
  rawWebsocketDataToString,
  readRealtimeOriginHeader,
  RealtimeAuthPolicy,
  requestContainsCredentialQuery,
} from "./realtime-auth-policy";

const HERMES_BROWSER_TOOLS = [
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_vision",
] as const;
const DEFAULT_WS_AUTH_DEADLINE_MS = 10_000;
const DEFAULT_WS_MAX_UNAUTHENTICATED_FRAME_BYTES = 16 * 1024;
const DEFAULT_WS_MAX_AUTHENTICATED_FRAME_BYTES = 1024 * 1024;
const DEFAULT_WS_RATE_WINDOW_MS = 10_000;
const DEFAULT_WS_SOCKET_MESSAGE_LIMIT = 80;
const DEFAULT_WS_IP_MESSAGE_LIMIT = 240;
const RELAY_CLOUD_ENTITLEMENT_REQUIRED = "Relay subscription required";

interface WebsocketRateLimitDecision {
  limited: boolean;
  socketLimited: boolean;
  trackerLimited: boolean;
  tracker: string;
  windowMs: number;
  socketLimit: number;
  trackerLimit: number;
}

type SocketKind = "mobile" | "web" | "bridge";

type RealtimeInboundEvent =
  | { type: "authenticate"; token: string; capabilities?: string[] }
  | { type: "subscribe_workspace"; workspaceId: string }
  | { type: "unsubscribe_workspace"; workspaceId: string }
  | { type: "subscribe_thread"; threadId: string }
  | { type: "unsubscribe_thread"; threadId: string }
  | { type: "request_pending_dispatches"; threadId: string }
  | {
      type: "request_agent_ops_live_state";
      workspaceId: string;
      agentIds: string[];
    }
  | {
      type: "subscribe_bridge_control";
      workspaceId: string;
      capabilities?: string[];
    }
  | { type: "unsubscribe_bridge_control"; workspaceId: string }
  | {
      type: "register_bridge_agent";
      externalAgentId: string;
      capabilities?: string[];
    }
  | { type: "unregister_bridge_agent"; externalAgentId: string }
  | {
      type: "register_hermes_agent";
      externalAgentId: string;
      capabilities?: string[];
    }
  | { type: "unregister_hermes_agent"; externalAgentId: string }
  | { type: "hermes_runtime_event"; event: HermesBridgeInboundEvent }
  | { type: "typing_start"; threadId: string }
  | { type: "typing_stop"; threadId: string }
  | { type: string; data?: Record<string, unknown> };

type RealtimeOutboundEvent =
  | {
      type: "authenticated";
      data: { userId: string; kind: SocketKind; workspaceId?: string };
    }
  | { type: "subscribed_workspace"; data: { workspaceId: string } }
  | { type: "subscribed_bridge_control"; data: { workspaceId: string } }
  | { type: "unsubscribed_workspace"; data: { workspaceId: string } }
  | { type: "subscribed_thread"; data: { threadId: string } }
  | { type: "unsubscribed_thread"; data: { threadId: string } }
  | { type: "typing:start"; data: { threadId: string; userId: string } }
  | { type: "typing:stop"; data: { threadId: string; userId: string } }
  | { type: "session.revoked"; data: { reason: string } }
  | { type: "auth_error"; data: { error: string } }
  | { type: string; data: unknown };

@WebSocketGateway()
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  static readonly STRUCTURED_PROMPT_BRIDGE_CAPABILITY =
    "claude.cli.structured_prompt";
  static readonly CLAWCHAT_ATTACHMENT_BRIDGE_CAPABILITY =
    "clawchat.attachments.local_media";

  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();
  private socketUsers: Map<string, string> = new Map();
  private socketKinds: Map<string, SocketKind> = new Map();
  private socketSessionIds: Map<string, string> = new Map();
  private socketScopedWorkspaces: Map<string, string> = new Map();
  private socketBridgeDeviceIds: Map<string, string> = new Map();
  private socketBridgeRuntimeTypes: Map<string, BridgeRuntimeType> = new Map();
  private socketBridgeCapabilities: Map<string, Set<string>> = new Map();
  private workspaceSubscriptions: Map<string, Set<string>> = new Map();
  private threadSubscriptions: Map<string, Set<string>> = new Map();
  private bridgeControlSubscriptions: Map<string, Set<string>> = new Map();
  private socketBridgeControls: Map<string, Set<string>> = new Map();
  private bridgeAgentSubscriptions: Map<string, Set<string>> = new Map();
  private socketBridgeAgents: Map<string, Set<string>> = new Map();
  private hermesBridgeAgentSubscriptions: Map<string, Set<string>> = new Map();
  private socketHermesBridgeAgents: Map<string, Set<string>> = new Map();
  private socketAuthDeadlines: Map<string, NodeJS.Timeout> = new Map();
  private socketRateLimitTrackers: Map<string, string> = new Map();
  private socketConnectionOrigins: Map<string, string | null> = new Map();
  private socketInboundQueues: Map<string, Promise<void>> = new Map();
  private clients: Map<string, WebSocket> = new Map();
  private readonly gatewayInstanceId = randomUUID();
  private socketIdCounter = 0;
  private runtimeDispatchService?: RuntimeDispatchService;
  private runtimeBindingService?: RuntimeBindingService;
  private runtimeDispatchCoordinator?: RuntimeDispatchCoordinator;
  private runtimeEventService?: RuntimeEventService;
  private runtimeThreadSessionService?: RuntimeThreadSessionService;
  private agentOpsService?: AgentOpsService;
  private cloudCommercialService?: CloudCommercialService;
  private readonly realtimeAuthPolicy: RealtimeAuthPolicy;

  constructor(
    private readonly moduleRef: ModuleRef,
    jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly bridgeControlCoordinator: BridgeControlCoordinatorService,
    private readonly bridgeControlBus: BridgeControlBusService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly auditLogService: AuditLogService,
    private readonly websocketTickets: WebsocketTicketReplayService,
    private readonly rateLimits: DistributedRateLimitService,
    @InjectRepository(WebSessionEntity)
    private readonly webSessionRepository: Repository<WebSessionEntity>,
    @InjectRepository(MobileSessionEntity)
    private readonly mobileSessionRepository: Repository<MobileSessionEntity>,
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    @InjectRepository(BridgeDeviceEntity)
    private readonly bridgeDeviceRepository: Repository<BridgeDeviceEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
  ) {
    this.realtimeAuthPolicy = new RealtimeAuthPolicy(jwtService, configService);
  }

  afterInit() {
    this.logger.log("WebSocket Gateway initialized");
    this.bridgeControlBus.registerPresenceHandler(
      (workspaceId, capability, targetBridgeDeviceId, runtimeType) =>
        this.hasBridgeControlSubscribers(
          workspaceId,
          capability,
          targetBridgeDeviceId,
          runtimeType,
        ),
    );
    this.bridgeControlBus.registerControlRequestHandler((message) =>
      this.emitToLocalBridgeControls(
        message.workspaceId,
        message.eventType,
        message.data,
        message.capability,
        message.targetBridgeDeviceId,
        message.runtimeType,
      ),
    );
    this.bridgeControlBus.registerResponseHandler((message) => {
      this.bridgeControlCoordinator.resolveFromBridgeMessage(message, {
        workspaceId: message.workspaceId,
        runtimeType: message.runtimeType,
        targetBridgeDeviceId: message.bridgeDeviceId ?? null,
      });
    });
  }

  handleConnection(
    client: WebSocket & { socketId?: string },
    request: IncomingMessage,
  ) {
    const hasCredentialQuery = requestContainsCredentialQuery(request);
    const origin = readRealtimeOriginHeader(request.headers.origin);
    const originRejection = getRealtimeOriginRejectionReason(
      {
        origin,
        hasTicket: hasCredentialQuery,
        userAgent:
          typeof request.headers["user-agent"] === "string"
            ? request.headers["user-agent"]
            : null,
      },
      this.configService,
    );
    if (originRejection) {
      client.close(1008, originRejection);
      return;
    }
    if (hasCredentialQuery) {
      client.close(1008, "WebSocket credentials are not allowed in URLs");
      return;
    }

    const socketId = `ws_${this.gatewayInstanceId}_${++this.socketIdCounter}_${Date.now()}`;
    client.socketId = socketId;
    this.clients.set(socketId, client);
    this.socketRateLimitTrackers.set(socketId, getRateLimitTracker(request));
    this.socketConnectionOrigins.set(socketId, origin);
    this.logger.log(`Client connected: ${socketId}`);
    this.scheduleSocketAuthDeadline(socketId);

    client.on("message", (data: RawData) => {
      this.enqueueInboundFrame(socketId, data);
    });

    client.on("error", (err) => {
      this.logger.error(`WS error for ${socketId}: ${err.message}`);
    });
  }

  handleDisconnect(client: WebSocket & { socketId?: string }) {
    const socketId = client.socketId;
    if (!socketId) return;

    this.logger.log(`Client disconnected: ${socketId}`);
    const kind = this.socketKinds.get(socketId);
    const userId = this.socketUsers.get(socketId);
    const scopedWorkspaceId = this.socketScopedWorkspaces.get(socketId);
    const bridgeDeviceId = this.socketBridgeDeviceIds.get(socketId);
    const tracker = this.socketRateLimitTrackers.get(socketId) ?? "unknown";
    this.logWebsocketDisconnect({
      socketId,
      kind,
      authenticated: Boolean(userId),
      scopedWorkspaceId,
      bridgeDeviceId,
      tracker,
    });

    this.clients.delete(socketId);
    this.clearSocketAuthDeadline(socketId);
    this.socketRateLimitTrackers.delete(socketId);
    this.socketConnectionOrigins.delete(socketId);
    this.socketInboundQueues.delete(socketId);

    if (userId) {
      this.socketUsers.delete(socketId);
      this.socketKinds.delete(socketId);
      this.socketSessionIds.delete(socketId);
      this.socketScopedWorkspaces.delete(socketId);
      this.socketBridgeDeviceIds.delete(socketId);
      this.socketBridgeRuntimeTypes.delete(socketId);
      this.socketBridgeCapabilities.delete(socketId);
      const userSet = this.userSockets.get(userId);
      if (userSet) {
        userSet.delete(socketId);
        if (userSet.size === 0) this.userSockets.delete(userId);
      }
    }

    for (const [workspaceId, sockets] of this.workspaceSubscriptions) {
      sockets.delete(socketId);
      if (sockets.size === 0) this.workspaceSubscriptions.delete(workspaceId);
    }

    for (const [threadId, sockets] of this.threadSubscriptions) {
      sockets.delete(socketId);
      if (sockets.size === 0) this.threadSubscriptions.delete(threadId);
    }

    for (const workspaceId of this.socketBridgeControls.get(socketId) ?? []) {
      const sockets = this.bridgeControlSubscriptions.get(workspaceId);
      sockets?.delete(socketId);
      if (sockets?.size === 0) {
        this.bridgeControlSubscriptions.delete(workspaceId);
      }
    }
    this.socketBridgeControls.delete(socketId);

    for (const externalAgentId of this.socketBridgeAgents.get(socketId) ?? []) {
      const key = this.buildBridgeAgentKey(scopedWorkspaceId, externalAgentId);
      if (!key) continue;
      const sockets = this.bridgeAgentSubscriptions.get(key);
      sockets?.delete(socketId);
      if (sockets?.size === 0) {
        this.bridgeAgentSubscriptions.delete(key);
      }
    }
    this.socketBridgeAgents.delete(socketId);

    for (const externalAgentId of this.socketHermesBridgeAgents.get(socketId) ??
      []) {
      const key = this.buildHermesBridgeAgentKey(
        scopedWorkspaceId,
        externalAgentId,
      );
      if (!key) continue;
      const sockets = this.hermesBridgeAgentSubscriptions.get(key);
      sockets?.delete(socketId);
      if (sockets?.size === 0) {
        this.hermesBridgeAgentSubscriptions.delete(key);
        void this.emitHermesBridgeAgentHealth(
          scopedWorkspaceId,
          externalAgentId,
          "offline",
          "Hermes bridge agent disconnected",
        );
      }
    }
    this.socketHermesBridgeAgents.delete(socketId);
  }

  private async handleMessage(socketId: string, message: RealtimeInboundEvent) {
    if (
      message.type !== "authenticate" &&
      this.socketKinds.get(socketId) === "bridge" &&
      !(await this.bridgeEntitlementIsWritable(socketId))
    ) {
      this.sendToSocket(socketId, {
        type: "auth_error",
        data: { error: RELAY_CLOUD_ENTITLEMENT_REQUIRED },
      });
      this.closeSocket(socketId, 4003, RELAY_CLOUD_ENTITLEMENT_REQUIRED);
      return;
    }
    switch (message.type) {
      case "authenticate":
        await this.handleAuthenticate(
          socketId,
          (message as { token: string }).token,
          (message as { capabilities?: string[] }).capabilities,
        );
        break;
      case "subscribe_workspace":
        await this.handleSubscribeWorkspace(
          socketId,
          (message as { workspaceId: string }).workspaceId,
        );
        break;
      case "unsubscribe_workspace":
        this.handleUnsubscribeWorkspace(
          socketId,
          (message as { workspaceId: string }).workspaceId,
        );
        break;
      case "subscribe_thread":
        await this.handleSubscribeThread(
          socketId,
          (message as { threadId: string }).threadId,
        );
        break;
      case "unsubscribe_thread":
        this.handleUnsubscribeThread(
          socketId,
          (message as { threadId: string }).threadId,
        );
        break;
      case "request_pending_dispatches":
        await this.handleReplayPendingDispatches(
          socketId,
          (message as { threadId: string }).threadId,
        );
        break;
      case "request_agent_ops_live_state":
        await this.handleReplayAgentOpsLiveState(
          socketId,
          (message as { workspaceId: string; agentIds?: string[] }).workspaceId,
          (message as { workspaceId: string; agentIds?: string[] }).agentIds ??
            [],
        );
        break;
      case "subscribe_bridge_control":
        await this.handleSubscribeBridgeControl(
          socketId,
          (message as { workspaceId: string }).workspaceId,
          (message as { capabilities?: string[] }).capabilities,
        );
        break;
      case "unsubscribe_bridge_control":
        this.handleUnsubscribeBridgeControl(
          socketId,
          (message as { workspaceId: string }).workspaceId,
        );
        break;
      case "register_bridge_agent":
        {
          const externalAgentId = (message as { externalAgentId: string })
            .externalAgentId;
          const accepted = await this.handleRegisterBridgeAgent(
            socketId,
            externalAgentId,
            (message as { capabilities?: string[] }).capabilities,
          );
          this.sendBridgeAgentRegistrationResult(
            socketId,
            externalAgentId,
            accepted,
          );
        }
        break;
      case "unregister_bridge_agent":
        this.handleUnregisterBridgeAgent(
          socketId,
          (message as { externalAgentId: string }).externalAgentId,
        );
        break;
      case "register_hermes_agent":
        {
          const externalAgentId = (message as { externalAgentId: string })
            .externalAgentId;
          const accepted = await this.handleRegisterHermesAgent(
            socketId,
            externalAgentId,
            (message as { capabilities?: string[] }).capabilities,
          );
          this.sendBridgeAgentRegistrationResult(
            socketId,
            externalAgentId,
            accepted,
          );
        }
        break;
      case "unregister_hermes_agent":
        this.handleUnregisterHermesAgent(
          socketId,
          (message as { externalAgentId: string }).externalAgentId,
        );
        break;
      case "hermes_runtime_event":
        this.logHermesRuntimeEventFrame(socketId, message);
        await this.handleHermesRuntimeEvent(
          socketId,
          (message as { event: HermesBridgeInboundEvent }).event,
        );
        break;
      case "typing_start":
        this.handleTyping(
          socketId,
          (message as { threadId: string }).threadId,
          true,
        );
        break;
      case "typing_stop":
        this.handleTyping(
          socketId,
          (message as { threadId: string }).threadId,
          false,
        );
        break;
      default: {
        const responder = this.getBridgeControlResponder(socketId);
        if (
          responder &&
          this.bridgeControlCoordinator.resolveFromBridgeMessage(message, {
            workspaceId: responder.workspaceId,
            runtimeType: responder.runtimeType,
            targetBridgeDeviceId: responder.bridgeDeviceId,
          })
        ) {
          return;
        }
        if (
          responder &&
          (await this.bridgeControlBus.publishBridgeResponseFromMessage(
            message,
            responder,
          ))
        ) {
          return;
        }
        this.logger.warn(
          `Unknown WS message type: ${(message as { type: string }).type}`,
        );
      }
    }
  }

  private getBridgeControlResponder(socketId: string): {
    workspaceId: string;
    runtimeType: BridgeRuntimeType;
    bridgeDeviceId: string;
  } | null {
    if (this.socketKinds.get(socketId) !== "bridge") return null;
    const workspaceId = this.socketScopedWorkspaces.get(socketId);
    const runtimeType = this.socketBridgeRuntimeTypes.get(socketId);
    const bridgeDeviceId = this.socketBridgeDeviceIds.get(socketId);
    if (!workspaceId || !runtimeType || !bridgeDeviceId) return null;
    return { workspaceId, runtimeType, bridgeDeviceId };
  }

  private async handleAuthenticate(
    socketId: string,
    token: string,
    liveCapabilities?: string[],
  ) {
    try {
      if (this.socketConnectionOrigins.get(socketId)) {
        await this.authenticateWithTicket(socketId, token);
        return;
      }
      const auth = this.realtimeAuthPolicy.verifyFrame(token);

      if (auth.family === "bridge") {
        const payload = auth.payload;
        const device = await this.bridgeDeviceRepository.findOne({
          where: { id: payload.did },
          select: [
            "id",
            "devicePublicId",
            "workspaceId",
            "status",
            "revokedAt",
            "capabilities",
            "credentialVersion",
            "runtimeType",
          ],
        });
        if (
          !device ||
          device.status !== BridgeDeviceStatus.ACTIVE ||
          device.revokedAt
        ) {
          throw new Error("Bridge device revoked");
        }
        if (
          device.id !== payload.sub ||
          device.devicePublicId !== payload.dpid ||
          device.workspaceId !== payload.workspaceId
        ) {
          throw new Error("Bridge device token scope mismatch");
        }
        if (payload.cv !== device.credentialVersion) {
          throw new Error("Bridge device credential rotated");
        }
        const runtimeType = BRIDGE_RUNTIME_TYPES.find(
          (candidate) => candidate === device.runtimeType,
        );
        if (!runtimeType) {
          throw new Error("Bridge device runtime identity is unsupported");
        }
        const entitlement =
          await this.getCloudCommercialService().entitlementPayload(
            device.workspaceId,
          );
        if (entitlement.mode !== "read_write") {
          throw new Error(RELAY_CLOUD_ENTITLEMENT_REQUIRED);
        }

        this.registerAuthenticatedSocket(
          socketId,
          device.id,
          "bridge",
          undefined,
          device.workspaceId,
          device.id,
          runtimeType,
        );
        this.socketBridgeCapabilities.set(
          socketId,
          this.mergeBridgeCapabilities(device.capabilities, liveCapabilities),
        );
        await this.bridgeDeviceRepository.update(device.id, {
          lastSeenAt: new Date(),
        });
        this.sendToSocket(socketId, {
          type: "authenticated",
          data: {
            userId: device.id,
            kind: "bridge",
            workspaceId: device.workspaceId,
          },
        });
        this.logger.log(
          `Socket ${socketId} authenticated as bridge device ${device.devicePublicId} capabilities=[${Array.from(
            this.socketBridgeCapabilities.get(socketId) ?? [],
          ).join(",")}]`,
        );
        return;
      }

      const payload = auth.payload;
      const session = await this.mobileSessionRepository.findOne({
        where: { id: payload.sid, userId: payload.sub, revokedAt: IsNull() },
        select: ["id"],
      });
      if (!session) {
        throw new Error("Mobile session revoked");
      }

      this.registerAuthenticatedSocket(
        socketId,
        payload.sub,
        "mobile",
        payload.sid,
      );
      this.sendToSocket(socketId, {
        type: "authenticated",
        data: { userId: payload.sub, kind: "mobile" },
      });
      this.logger.log(
        `Socket ${socketId} authenticated as mobile ${payload.sub}`,
      );
    } catch (err) {
      const error = err as Error;
      const publicError =
        error.message === RELAY_CLOUD_ENTITLEMENT_REQUIRED
          ? RELAY_CLOUD_ENTITLEMENT_REQUIRED
          : "Invalid token";
      this.sendToSocket(socketId, {
        type: "auth_error",
        data: { error: publicError },
      });
      this.logger.warn(`Auth failed for socket ${socketId}: ${error.message}`);
      this.closeSocket(socketId, 4001, publicError);
    }
  }

  private async handleSubscribeWorkspace(
    socketId: string,
    workspaceId: string,
  ) {
    if (!workspaceId) return;
    const userId = this.socketUsers.get(socketId);
    if (!userId || this.socketKinds.get(socketId) === "bridge") {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "workspace",
      );
      return;
    }

    const scopedWorkspaceId = this.socketScopedWorkspaces.get(socketId);
    if (scopedWorkspaceId && scopedWorkspaceId !== workspaceId) {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "workspace",
      );
      return;
    }

    try {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        workspaceId,
        userId,
      );
    } catch {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "workspace",
      );
      return;
    }

    if (!this.workspaceSubscriptions.has(workspaceId)) {
      this.workspaceSubscriptions.set(workspaceId, new Set());
    }
    this.workspaceSubscriptions.get(workspaceId)?.add(socketId);
    this.sendToSocket(socketId, {
      type: "subscribed_workspace",
      data: { workspaceId },
    });
  }

  private handleUnsubscribeWorkspace(socketId: string, workspaceId: string) {
    const sockets = this.workspaceSubscriptions.get(workspaceId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.workspaceSubscriptions.delete(workspaceId);
    }
    this.sendToSocket(socketId, {
      type: "unsubscribed_workspace",
      data: { workspaceId },
    });
  }

  private async handleSubscribeThread(socketId: string, threadId: string) {
    if (!threadId) return;
    const userId = this.socketUsers.get(socketId);
    if (!userId || this.socketKinds.get(socketId) === "bridge") {
      await this.auditUnauthorizedSubscription(
        socketId,
        null,
        threadId,
        "thread",
      );
      return;
    }

    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
    });
    if (!thread) {
      return;
    }

    const scopedWorkspaceId = this.socketScopedWorkspaces.get(socketId);
    if (scopedWorkspaceId && scopedWorkspaceId !== thread.workspaceId) {
      await this.auditUnauthorizedSubscription(
        socketId,
        thread.workspaceId,
        threadId,
        "thread",
      );
      return;
    }

    try {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        thread.workspaceId,
        userId,
      );
    } catch {
      await this.auditUnauthorizedSubscription(
        socketId,
        thread.workspaceId,
        threadId,
        "thread",
      );
      return;
    }

    if (!this.threadSubscriptions.has(threadId)) {
      this.threadSubscriptions.set(threadId, new Set());
    }
    this.threadSubscriptions.get(threadId)?.add(socketId);
    this.sendToSocket(socketId, {
      type: "subscribed_thread",
      data: { threadId },
    });
    await this.replayRuntimeDispatchesToSocket(
      socketId,
      thread.id,
      thread.activeSessionId ?? null,
    );
  }

  private handleUnsubscribeThread(socketId: string, threadId: string) {
    const sockets = this.threadSubscriptions.get(threadId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.threadSubscriptions.delete(threadId);
    }
    this.sendToSocket(socketId, {
      type: "unsubscribed_thread",
      data: { threadId },
    });
  }

  private async handleRegisterBridgeAgent(
    socketId: string,
    externalAgentId: string,
    liveCapabilities?: string[],
  ) {
    if (!externalAgentId || this.socketKinds.get(socketId) !== "bridge") {
      return false;
    }
    const workspaceId = this.socketScopedWorkspaces.get(socketId);
    const runtimeType = this.socketBridgeRuntimeTypes.get(socketId);
    if (
      !workspaceId ||
      (runtimeType !== "openclaw" && runtimeType !== "claude_code")
    ) {
      return false;
    }

    const agent =
      (await this.agentRepository.findOne({
        where: {
          workspaceId,
          externalId: externalAgentId,
          source: runtimeType,
        } as any,
        select: ["id"],
      })) ??
      (await this.agentRepository
        .createQueryBuilder("agent")
        .select(["agent.id"])
        .where("agent.workspaceId = :workspaceId", { workspaceId })
        .andWhere("agent.source = :runtimeType", { runtimeType })
        .andWhere("agent.description LIKE :pattern", {
          pattern: `%External ID: ${externalAgentId}`,
        })
        .getOne());
    if (!agent) {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "bridge_agent",
      );
      return false;
    }

    const key = this.buildBridgeAgentKey(workspaceId, externalAgentId);
    if (!key) return false;

    if (!this.bridgeAgentSubscriptions.has(key)) {
      this.bridgeAgentSubscriptions.set(key, new Set());
    }
    this.bridgeAgentSubscriptions.get(key)?.add(socketId);

    if (!this.socketBridgeAgents.has(socketId)) {
      this.socketBridgeAgents.set(socketId, new Set());
    }
    this.socketBridgeAgents.get(socketId)?.add(externalAgentId);

    if (runtimeType === "openclaw") {
      await this.persistOpenClawBridgeRuntimeCapabilities(
        workspaceId,
        agent.id,
        socketId,
        liveCapabilities,
      );
    }
    return true;
  }

  private async persistOpenClawBridgeRuntimeCapabilities(
    workspaceId: string,
    agentId: string,
    socketId: string,
    liveCapabilities?: string[],
  ) {
    const capabilities = this.mergeBridgeCapabilities(
      Array.from(this.socketBridgeCapabilities.get(socketId) ?? []),
      liveCapabilities,
    );
    const capabilityRecord = Array.from(capabilities).reduce<
      Record<string, true>
    >((record, capability) => {
      record[capability] = true;
      return record;
    }, {});
    await this.getRuntimeBindingService().upsertByAgentId(agentId, {
      workspaceId,
      runtimeType: "openclaw",
      adapterKind: "bridge_ws",
      routingMode: "default_target",
      isEnabled: true,
      healthStatus: "ready",
      capabilities: {
        bridgeBacked: true,
        requiresExternalRuntimePresence: true,
        ...capabilityRecord,
      },
      configMetadata: {
        compatibilitySource: "openclaw_bridge_registration",
      },
    });
  }

  private handleUnregisterBridgeAgent(
    socketId: string,
    externalAgentId: string,
  ) {
    const externalIds = this.socketBridgeAgents.get(socketId);
    externalIds?.delete(externalAgentId);
    if (externalIds?.size === 0) {
      this.socketBridgeAgents.delete(socketId);
    }

    const workspaceId = this.socketScopedWorkspaces.get(socketId);
    const key = this.buildBridgeAgentKey(workspaceId, externalAgentId);
    if (!key) return;

    const sockets = this.bridgeAgentSubscriptions.get(key);
    sockets?.delete(socketId);
    if (sockets?.size === 0) {
      this.bridgeAgentSubscriptions.delete(key);
    }
  }

  private async handleRegisterHermesAgent(
    socketId: string,
    externalAgentId: string,
    liveCapabilities?: string[],
  ) {
    if (!externalAgentId || this.socketKinds.get(socketId) !== "bridge") {
      return false;
    }
    if (this.socketBridgeRuntimeTypes.get(socketId) !== "hermes") return false;
    if (!this.hasHermesBridgeCapability(socketId)) return false;
    const workspaceId = this.socketScopedWorkspaces.get(socketId);
    if (!workspaceId) return false;

    const agent = await this.agentRepository.findOne({
      where: {
        workspaceId,
        externalId: externalAgentId,
        source: "hermes",
      } as any,
      select: ["id"],
    });
    if (!agent) {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "hermes_bridge_agent",
      );
      return false;
    }

    const key = this.buildHermesBridgeAgentKey(workspaceId, externalAgentId);
    if (!key) return false;
    if (!this.hermesBridgeAgentSubscriptions.has(key)) {
      this.hermesBridgeAgentSubscriptions.set(key, new Set());
    }
    this.hermesBridgeAgentSubscriptions.get(key)?.add(socketId);

    if (!this.socketHermesBridgeAgents.has(socketId)) {
      this.socketHermesBridgeAgents.set(socketId, new Set());
    }
    this.socketHermesBridgeAgents.get(socketId)?.add(externalAgentId);

    await this.persistHermesBridgeRuntimeCapabilities(
      workspaceId,
      agent.id,
      socketId,
      liveCapabilities,
    );

    this.emitToWorkspace(workspaceId, "runtime.participant.health", {
      workspaceId,
      agentId: agent.id,
      runtimeType: "hermes",
      status: "ready",
      message: "Hermes bridge agent connected",
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  private sendBridgeAgentRegistrationResult(
    socketId: string,
    externalAgentId: string,
    accepted: boolean,
  ) {
    const runtimeType = this.socketBridgeRuntimeTypes.get(socketId);
    if (!runtimeType) return;
    this.sendToSocket(socketId, {
      type: "bridge_agent_registration",
      data: { accepted, externalAgentId, runtimeType },
    });
  }

  private async persistHermesBridgeRuntimeCapabilities(
    workspaceId: string,
    agentId: string,
    socketId: string,
    liveCapabilities?: string[],
  ) {
    const capabilities = this.mergeBridgeCapabilities(
      Array.from(this.socketBridgeCapabilities.get(socketId) ?? []),
      liveCapabilities,
    );
    const capabilityRecord = Array.from(capabilities).reduce<
      Record<string, true>
    >((record, capability) => {
      record[capability] = true;
      return record;
    }, {});
    const browserSupport = true;
    const runtimeBindingService = this.getRuntimeBindingService();
    const existingBinding = await runtimeBindingService.findByAgentId(agentId);
    const bridgeDeviceId =
      this.socketBridgeDeviceIds.get(socketId) ??
      existingBinding?.configMetadata?.bridgeDeviceId ??
      null;
    await runtimeBindingService.upsertByAgentId(agentId, {
      workspaceId,
      runtimeType: "hermes",
      adapterKind: "hermes_bridge",
      routingMode: "default_target",
      isEnabled: true,
      healthStatus: "ready",
      capabilities: {
        bridgeBacked: true,
        requiresExternalRuntimePresence: true,
        ...capabilityRecord,
        browserSupport,
        browserTools: browserSupport ? [...HERMES_BROWSER_TOOLS] : [],
      },
      configMetadata: {
        ...(existingBinding?.configMetadata ?? {}),
        compatibilitySource: "hermes_bridge_registration",
        bridgeDeviceId,
      },
    });
  }

  private handleUnregisterHermesAgent(
    socketId: string,
    externalAgentId: string,
  ) {
    const workspaceId = this.socketScopedWorkspaces.get(socketId);
    const externalIds = this.socketHermesBridgeAgents.get(socketId);
    externalIds?.delete(externalAgentId);
    if (externalIds?.size === 0) {
      this.socketHermesBridgeAgents.delete(socketId);
    }

    const key = this.buildHermesBridgeAgentKey(workspaceId, externalAgentId);
    if (!key) return;
    const sockets = this.hermesBridgeAgentSubscriptions.get(key);
    sockets?.delete(socketId);
    if (sockets?.size === 0) {
      this.hermesBridgeAgentSubscriptions.delete(key);
      void this.emitHermesBridgeAgentHealth(
        workspaceId,
        externalAgentId,
        "offline",
        "Hermes bridge agent disconnected",
      );
    }
  }

  private async handleHermesRuntimeEvent(
    socketId: string,
    event: HermesBridgeInboundEvent,
  ) {
    const kind = this.socketKinds.get(socketId);
    if (kind !== "bridge") {
      this.logger.warn(
        `Ignoring Hermes runtime event from non-bridge socket socketId=${socketId} kind=${kind ?? "unauthenticated"}`,
      );
      return;
    }
    if (this.socketBridgeRuntimeTypes.get(socketId) !== "hermes") {
      this.logger.warn(
        `Ignoring Hermes runtime event from non-Hermes bridge socketId=${socketId}`,
      );
      return;
    }
    if (!this.hasHermesBridgeCapability(socketId)) {
      this.logger.warn(
        `Ignoring Hermes runtime event from bridge without Hermes capability socketId=${socketId} capabilities=[${Array.from(
          this.socketBridgeCapabilities.get(socketId) ?? [],
        ).join(",")}]`,
      );
      return;
    }
    const workspaceId = this.socketScopedWorkspaces.get(socketId);
    if (!workspaceId || !this.isHermesBridgeRuntimeEvent(event)) {
      this.logger.warn(
        `Ignoring invalid Hermes runtime event socketId=${socketId} workspaceId=${workspaceId ?? "none"} eventType=${this.describeInboundEventType(event)} dispatchId=${this.describeInboundDispatchId(event)}`,
      );
      return;
    }

    const runtimeService = this.getHermesBridgeRuntimeService();
    const eventId =
      typeof (event as Record<string, unknown>).eventId === "string"
        ? ((event as Record<string, unknown>).eventId as string)
        : null;
    const isTerminalEvent =
      event.type === "run.completed" ||
      event.type === "run.failed" ||
      event.type === "run.cancelled";
    if (isTerminalEvent) {
      this.logger.log(
        `Received Hermes terminal event dispatchId=${event.dispatchId} type=${event.type} eventId=${eventId ?? "none"}`,
      );
    }
    if (
      !(await runtimeService.isDispatchInWorkspace(
        event.dispatchId,
        workspaceId,
      ))
    ) {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "hermes_runtime_event",
      );
      return;
    }

    const accepted = await runtimeService.acceptBridgeEvent({
      workspaceId,
      event,
    });
    if (!accepted) {
      if (
        isTerminalEvent &&
        (await this.recoverHermesTerminalEventFromDatabase({
          workspaceId,
          event,
        }))
      ) {
        this.logger.log(
          `Recovered Hermes terminal event dispatchId=${event.dispatchId} type=${event.type} eventId=${eventId ?? "none"} sending ack`,
        );
        this.sendHermesRuntimeEventAck(socketId, event, true);
        return;
      }
      this.logger.warn(
        `Hermes runtime event was not accepted dispatchId=${event.dispatchId} type=${event.type}`,
      );
      return;
    }

    if (isTerminalEvent) {
      this.logger.log(
        `Accepted Hermes terminal event dispatchId=${event.dispatchId} type=${event.type} eventId=${eventId ?? "none"} sending ack`,
      );
    }
    this.sendHermesRuntimeEventAck(socketId, event, true);
  }

  private logHermesRuntimeEventFrame(
    socketId: string,
    message: RealtimeInboundEvent,
  ) {
    const record = message as Record<string, unknown>;
    const event = record.event as Record<string, unknown> | undefined;
    const topEventId =
      typeof record.eventId === "string" ? record.eventId : null;
    const nestedEventId =
      event && typeof event.eventId === "string" ? event.eventId : null;
    const requiresAck =
      typeof record.requiresAck === "boolean"
        ? String(record.requiresAck)
        : "none";
    this.logger.log(
      `Received Hermes runtime event frame socketId=${socketId} kind=${this.socketKinds.get(socketId) ?? "unauthenticated"} workspaceId=${this.socketScopedWorkspaces.get(socketId) ?? "none"} hasEvent=${Boolean(
        event,
      )} eventType=${this.describeInboundEventType(event)} dispatchId=${this.describeInboundDispatchId(
        event,
      )} topEventId=${topEventId ?? "none"} nestedEventId=${nestedEventId ?? "none"} requiresAck=${requiresAck}`,
    );
  }

  private describeInboundEventType(event: unknown) {
    return this.describeStringProperty(event, "type");
  }

  private describeInboundDispatchId(event: unknown) {
    return this.describeStringProperty(event, "dispatchId");
  }

  private describeStringProperty(event: unknown, property: string) {
    if (!event || typeof event !== "object") return "none";
    const value = (event as Record<string, unknown>)[property];
    return typeof value === "string" && value.length > 0 ? value : "none";
  }

  private async recoverHermesTerminalEventFromDatabase(input: {
    workspaceId: string;
    event: HermesBridgeInboundEvent;
  }): Promise<boolean> {
    const { event, workspaceId } = input;
    if (
      event.type !== "run.completed" &&
      event.type !== "run.failed" &&
      event.type !== "run.cancelled"
    ) {
      return false;
    }

    const runtimeDispatchService = this.getRuntimeDispatchService();
    const dispatch = await runtimeDispatchService.findById(event.dispatchId);
    if (!dispatch || dispatch.workspaceId !== workspaceId) return false;

    if (dispatch.status === "completed" && dispatch.postedMessageId) {
      return true;
    }
    if (["failed", "cancelled"].includes(dispatch.status)) {
      this.logger.log(
        `Acking Hermes terminal event for already-terminal dispatchId=${dispatch.id} status=${dispatch.status} eventType=${event.type}`,
      );
      return true;
    }

    if (event.type === "run.failed") {
      const coordinator = this.getRuntimeDispatchCoordinator();
      const failed = await coordinator.failDispatchById({
        dispatchId: dispatch.id,
        code: event.code,
        message: event.message,
        retryable: event.retryable,
      });
      return Boolean(failed);
    }

    if (event.type === "run.cancelled") {
      const coordinator = this.getRuntimeDispatchCoordinator();
      const cancelled = await coordinator.cancelDispatch(dispatch.id);
      return cancelled.cancelled || true;
    }

    const agent = await this.agentRepository.findOne({
      where: { id: dispatch.agentId },
    });
    if (!agent) return false;

    const runtimeBinding = await this.getRuntimeBindingService().findById(
      dispatch.runtimeBindingId,
    );
    const finalText =
      typeof event.finalText === "string" && event.finalText.trim()
        ? event.finalText
        : "(No response generated)";
    const prepared = prepareAgentReplyForStorage({
      rawContent: finalText,
      responsePresentation: agent.responsePresentation,
    });
    const saved = await this.messageRepository.save(
      this.messageRepository.create({
        threadId: dispatch.threadId,
        threadSessionId: dispatch.threadSessionId,
        senderId: agent.id,
        senderName: agent.name,
        senderAvatarUrl: agent.avatarUrl ?? null,
        content: prepared.content,
        contentFormat:
          prepared.contentFormat ?? MESSAGE_CONTENT_FORMAT_MARKDOWN,
        type: "text",
        provenance: MessageProvenance.AGENT,
        isFromUser: false,
        metadata: {
          runtimeType: runtimeBinding?.runtimeType ?? "hermes",
          runtimeDispatchId: dispatch.id,
          hermesBridgeRecovered: true,
          ...prepared.metadata,
          ...(event.metadata ?? {}),
        },
        attachments: [],
      }),
    );
    await this.threadRepository.update(dispatch.threadId, {
      lastMessage: {
        id: saved.id,
        content: this.buildMessagePreview(saved.content),
        senderId: saved.senderId,
        senderName: saved.senderName,
        createdAt: saved.createdAt,
        provenance: saved.provenance,
      },
      updatedAt: new Date(),
    });
    this.emitToScopes(
      {
        workspaceId: dispatch.workspaceId,
        threadId: dispatch.threadId,
      },
      "message.new",
      saved,
    );
    const updatedThread = await this.threadRepository.findOne({
      where: { id: dispatch.threadId },
    });
    if (updatedThread) {
      this.emitToScopes(
        {
          workspaceId: dispatch.workspaceId,
          threadId: dispatch.threadId,
        },
        "thread.update",
        updatedThread,
      );
    }
    this.emitAgentTyping(dispatch.threadId, [agent.id], false);

    await runtimeDispatchService.markCompleted(dispatch.id, {
      postedMessageId: saved.id,
      resultSummary: finalText.slice(0, 500),
      resultMetadata: event.metadata ?? {},
    });
    await this.getRuntimeThreadSessionService().touch(
      dispatch.runtimeThreadSessionId,
      {
        lastDispatchedMessageId: dispatch.messageId,
        lastRunFinishedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    );
    await this.getRuntimeEventService().emitDispatchCompleted({
      workspaceId: dispatch.workspaceId,
      threadId: dispatch.threadId,
      threadSessionId: dispatch.threadSessionId,
      dispatchId: dispatch.id,
      agentId: dispatch.agentId,
      runtimeType: runtimeBinding?.runtimeType ?? "hermes",
      runtimeBindingId: dispatch.runtimeBindingId,
      runtimeThreadSessionId: dispatch.runtimeThreadSessionId,
      timestamp: new Date().toISOString(),
      postedMessageId: saved.id,
      metadata: event.metadata ?? {},
    });

    return true;
  }

  private sendHermesRuntimeEventAck(
    socketId: string,
    event: HermesBridgeInboundEvent,
    accepted: boolean,
  ) {
    const eventId =
      typeof (event as Record<string, unknown>).eventId === "string"
        ? ((event as Record<string, unknown>).eventId as string)
        : null;
    this.sendToSocket(socketId, {
      type: "hermes_runtime_event_ack",
      data: {
        eventId,
        dispatchId: event.dispatchId,
        eventType: event.type,
        accepted,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private async handleSubscribeBridgeControl(
    socketId: string,
    workspaceId: string,
    liveCapabilities?: string[],
  ) {
    if (!workspaceId) return;
    if (this.socketKinds.get(socketId) !== "bridge") {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "bridge_control",
      );
      return;
    }
    if (this.socketScopedWorkspaces.get(socketId) !== workspaceId) {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "bridge_control",
      );
      return;
    }

    if (!this.bridgeControlSubscriptions.has(workspaceId)) {
      this.bridgeControlSubscriptions.set(workspaceId, new Set());
    }
    this.bridgeControlSubscriptions.get(workspaceId)?.add(socketId);

    if (!this.socketBridgeControls.has(socketId)) {
      this.socketBridgeControls.set(socketId, new Set());
    }
    this.socketBridgeControls.get(socketId)?.add(workspaceId);
    if (Array.isArray(liveCapabilities) && liveCapabilities.length) {
      this.socketBridgeCapabilities.set(
        socketId,
        this.mergeBridgeCapabilities(
          Array.from(this.socketBridgeCapabilities.get(socketId) ?? []),
          liveCapabilities,
        ),
      );
    }
    this.logger.log(
      `Socket ${socketId} subscribed to bridge control for workspace ${workspaceId} capabilities=[${Array.from(
        this.socketBridgeCapabilities.get(socketId) ?? [],
      ).join(",")}]`,
    );
    this.sendToSocket(socketId, {
      type: "subscribed_bridge_control",
      data: { workspaceId },
    });
  }

  private mergeBridgeCapabilities(
    storedCapabilities?: string[] | null,
    liveCapabilities?: string[] | null,
  ) {
    return mergeServerAuthorizedBridgeCapabilities(
      storedCapabilities,
      liveCapabilities,
    );
  }

  private handleUnsubscribeBridgeControl(
    socketId: string,
    workspaceId: string,
  ) {
    const workspaceIds = this.socketBridgeControls.get(socketId);
    workspaceIds?.delete(workspaceId);
    if (workspaceIds?.size === 0) {
      this.socketBridgeControls.delete(socketId);
    }

    const sockets = this.bridgeControlSubscriptions.get(workspaceId);
    sockets?.delete(socketId);
    if (sockets?.size === 0) {
      this.bridgeControlSubscriptions.delete(workspaceId);
    }
  }

  private handleTyping(socketId: string, threadId: string, isTyping: boolean) {
    const userId = this.socketUsers.get(socketId);
    if (!threadId || !userId) return;

    const eventType = isTyping ? "typing:start" : "typing:stop";
    const sockets = this.threadSubscriptions.get(threadId);
    if (!sockets) return;

    for (const subscribedSocketId of sockets) {
      if (subscribedSocketId !== socketId) {
        this.sendToSocket(subscribedSocketId, {
          type: eventType,
          data: { threadId, userId },
        });
      }
    }
  }

  private sendToSocket(socketId: string, data: RealtimeOutboundEvent) {
    const client = this.clients.get(socketId);
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(data));
      } catch (err) {
        const error = err as Error;
        this.logger.error(
          `Failed to send to socket ${socketId}: ${error.message}`,
        );
      }
    }
  }

  emitToWorkspace(workspaceId: string, event: string, data: unknown): void {
    this.emitToSocketSet(
      this.workspaceSubscriptions.get(workspaceId),
      event,
      data,
      "workspace",
    );
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.emitToSocketSet(this.userSockets.get(userId), event, data, "user");
  }

  emitAgentTyping(
    threadId: string,
    agentIds: string[],
    isTyping: boolean,
  ): void {
    const event = isTyping ? "typing:start" : "typing:stop";
    const sockets = this.threadSubscriptions.get(threadId);
    if (!sockets) return;
    for (const agentId of agentIds) {
      const payload = JSON.stringify({
        type: event,
        data: { threadId, userId: agentId },
      });
      for (const socketId of sockets) {
        const client = this.clients.get(socketId);
        if (client && client.readyState === WebSocket.OPEN) {
          try {
            client.send(payload);
          } catch {}
        }
      }
    }
  }

  emitToBridgeAgents(
    workspaceId: string,
    externalAgentIds: string[],
    event: string,
    data: unknown,
    runtimeType: "openclaw" | "claude_code" = "openclaw",
  ): void {
    const workspace = workspaceId?.trim();
    if (!workspace) return;
    for (const externalAgentId of Array.from(
      new Set(externalAgentIds.filter(Boolean)),
    )) {
      const key = this.buildBridgeAgentKey(workspace, externalAgentId);
      if (!key) continue;
      const payload = {
        ...(data as Record<string, unknown>),
        workspaceId: workspace,
        externalAgentId,
      };
      const runtimeSockets = new Set(
        Array.from(this.bridgeAgentSubscriptions.get(key) ?? []).filter(
          (socketId) =>
            this.socketBridgeRuntimeTypes.get(socketId) === runtimeType,
        ),
      );
      this.emitToSocketSet(runtimeSockets, event, payload, "bridge-agent");
    }
  }

  emitToHermesBridgeAgents(
    workspaceId: string,
    externalAgentIds: string[],
    event: string,
    data: unknown,
  ): void {
    for (const externalAgentId of Array.from(
      new Set(externalAgentIds.filter(Boolean)),
    )) {
      const key = this.buildHermesBridgeAgentKey(workspaceId, externalAgentId);
      if (!key) continue;
      const payload = {
        ...(data as Record<string, unknown>),
        workspaceId,
        externalAgentId,
      };
      const runtimeSockets = new Set(
        Array.from(this.hermesBridgeAgentSubscriptions.get(key) ?? []).filter(
          (socketId) =>
            this.socketBridgeRuntimeTypes.get(socketId) === "hermes",
        ),
      );
      this.emitToSocketSet(
        runtimeSockets,
        event,
        payload,
        "hermes-bridge-agent",
      );
    }
  }

  emitToHermesBridgeWorkspace(
    workspaceId: string,
    event: string,
    data: unknown,
    capability?: string | null,
    targetBridgeDeviceId?: string | null,
  ): void {
    const normalizedCapability = capability?.trim() || null;
    const socketIds = new Set<string>();
    for (const [socketId, kind] of this.socketKinds.entries()) {
      if (kind !== "bridge") continue;
      if (this.socketScopedWorkspaces.get(socketId) !== workspaceId) continue;
      if (this.socketBridgeRuntimeTypes.get(socketId) !== "hermes") continue;
      if (!this.hasHermesBridgeCapability(socketId)) continue;
      if (
        targetBridgeDeviceId &&
        this.socketBridgeDeviceIds.get(socketId) !== targetBridgeDeviceId
      ) {
        continue;
      }
      if (
        normalizedCapability &&
        !this.socketBridgeCapabilities.get(socketId)?.has(normalizedCapability)
      ) {
        continue;
      }
      socketIds.add(socketId);
    }

    this.emitToSocketSet(
      socketIds,
      event,
      { ...(data as Record<string, unknown>), workspaceId },
      "hermes-bridge-agent",
    );
  }

  emitToBridgeControls(
    workspaceId: string,
    event: string,
    data: unknown,
    capability?: string | null,
    targetBridgeDeviceId?: string | null,
    runtimeType: BridgeRuntimeType = "openclaw",
  ): void {
    this.emitToLocalBridgeControls(
      workspaceId,
      event,
      data,
      capability,
      targetBridgeDeviceId,
      runtimeType,
    );
  }

  private emitToLocalBridgeControls(
    workspaceId: string,
    event: string,
    data: unknown,
    capability?: string | null,
    targetBridgeDeviceId?: string | null,
    runtimeType: BridgeRuntimeType = "openclaw",
  ): boolean {
    const sockets = this.bridgeControlSubscriptions.get(workspaceId);
    if (!sockets?.size) {
      return false;
    }

    const normalizedCapability = capability?.trim() || null;
    const runtimeSockets = Array.from(sockets).filter(
      (socketId) => this.socketBridgeRuntimeTypes.get(socketId) === runtimeType,
    );
    const targetSockets = normalizedCapability
      ? runtimeSockets.filter((socketId) =>
          this.socketBridgeCapabilities
            .get(socketId)
            ?.has(normalizedCapability),
        )
      : runtimeSockets;
    const deviceScopedSockets = targetBridgeDeviceId
      ? targetSockets.filter(
          (socketId) =>
            this.socketBridgeDeviceIds.get(socketId) === targetBridgeDeviceId,
        )
      : targetSockets;

    if (!deviceScopedSockets.length) {
      return false;
    }

    for (const socketId of deviceScopedSockets) {
      this.sendToSocket(socketId, {
        type: event,
        data: {
          ...(data as Record<string, unknown>),
          bridgeDeviceId: this.socketBridgeDeviceIds.get(socketId) ?? null,
        },
      });
    }
    return true;
  }

  emitToWorkspaceBridgeDevices(
    workspaceId: string,
    event: string,
    data: unknown,
  ): void {
    const socketIds = new Set<string>();

    for (const [socketId, kind] of this.socketKinds.entries()) {
      if (kind !== "bridge") continue;
      if (this.socketScopedWorkspaces.get(socketId) !== workspaceId) continue;
      socketIds.add(socketId);
    }

    this.emitToSocketSet(socketIds, event, data, "bridge-workspace");
  }

  hasBridgeControlSubscribers(
    workspaceId: string,
    capability?: string | null,
    targetBridgeDeviceId?: string | null,
    runtimeType: BridgeRuntimeType = "openclaw",
  ): boolean {
    const sockets = this.bridgeControlSubscriptions.get(workspaceId);
    if (!sockets?.size) {
      return false;
    }

    const runtimeSockets = Array.from(sockets).filter(
      (socketId) => this.socketBridgeRuntimeTypes.get(socketId) === runtimeType,
    );
    if (!runtimeSockets.length) return false;

    const normalizedCapability = capability?.trim() || null;
    if (!normalizedCapability) {
      if (!targetBridgeDeviceId) return true;
      return runtimeSockets.some(
        (socketId) =>
          this.socketBridgeDeviceIds.get(socketId) === targetBridgeDeviceId,
      );
    }

    return runtimeSockets.some((socketId) => {
      if (
        targetBridgeDeviceId &&
        this.socketBridgeDeviceIds.get(socketId) !== targetBridgeDeviceId
      ) {
        return false;
      }
      return this.socketBridgeCapabilities
        .get(socketId)
        ?.has(normalizedCapability);
    });
  }

  async requestBridgeControl<T extends Record<string, unknown>>(input: {
    workspaceId: string;
    eventType: string;
    data: Record<string, unknown>;
    resultType: string;
    errorType: string;
    capability: string;
    targetBridgeDeviceId?: string | null;
    timeoutMs?: number;
    runtimeType?: BridgeRuntimeType;
  }): Promise<T> {
    const timeoutMs = input.timeoutMs ?? 30_000;
    const runtimeType = input.runtimeType ?? "openclaw";
    const hasLocalSubscriber = this.hasBridgeControlSubscribers(
      input.workspaceId,
      input.capability,
      input.targetBridgeDeviceId,
      runtimeType,
    );
    const remoteInstanceId = hasLocalSubscriber
      ? null
      : await this.bridgeControlBus.resolveRemoteSubscriber({
          workspaceId: input.workspaceId,
          capability: input.capability,
          targetBridgeDeviceId: input.targetBridgeDeviceId,
          runtimeType,
        });
    if (!hasLocalSubscriber && !remoteInstanceId) {
      throw new ServiceUnavailableException(
        "No paired runtime host with the required capability is connected",
      );
    }

    const requestId = randomUUID();
    const pending = this.bridgeControlCoordinator.registerRequest<T>(
      requestId,
      [input.resultType, input.errorType],
      timeoutMs,
      {
        workspaceId: input.workspaceId,
        runtimeType,
        targetBridgeDeviceId: input.targetBridgeDeviceId ?? null,
      },
    );
    const data = { requestId, ...input.data };
    if (hasLocalSubscriber) {
      this.emitToBridgeControls(
        input.workspaceId,
        input.eventType,
        data,
        input.capability,
        input.targetBridgeDeviceId,
        runtimeType,
      );
    } else {
      await this.bridgeControlBus.publishControlRequest({
        targetInstanceId: remoteInstanceId!,
        requestId,
        workspaceId: input.workspaceId,
        eventType: input.eventType,
        data,
        capability: input.capability,
        targetBridgeDeviceId: input.targetBridgeDeviceId ?? null,
        runtimeType,
        timeoutMs,
      });
    }
    const response = await pending;
    return response.data;
  }

  getConnectedBridgeDeviceIds(workspaceId: string) {
    const deviceIds = new Set<string>();
    for (const [socketId, kind] of this.socketKinds.entries()) {
      if (kind !== "bridge") continue;
      if (this.socketScopedWorkspaces.get(socketId) !== workspaceId) continue;
      const bridgeDeviceId = this.socketBridgeDeviceIds.get(socketId);
      if (bridgeDeviceId) deviceIds.add(bridgeDeviceId);
    }
    return deviceIds;
  }

  getBridgeDeviceRuntimeType(
    workspaceId: string,
    bridgeDeviceId: string,
  ): BridgeRuntimeType | null {
    for (const [socketId, kind] of this.socketKinds.entries()) {
      if (kind !== "bridge") continue;
      if (this.socketScopedWorkspaces.get(socketId) !== workspaceId) continue;
      if (this.socketBridgeDeviceIds.get(socketId) !== bridgeDeviceId) continue;
      return this.socketBridgeRuntimeTypes.get(socketId) ?? null;
    }
    return null;
  }

  isBridgeDeviceRegisteredForExternalAgent(input: {
    workspaceId?: string | null;
    bridgeDeviceId?: string | null;
    externalAgentId?: string | null;
    runtimeType?: string | null;
  }): boolean {
    const workspaceId = input.workspaceId?.trim();
    const bridgeDeviceId = input.bridgeDeviceId?.trim();
    const externalAgentId = input.externalAgentId?.trim();
    if (!workspaceId || !bridgeDeviceId || !externalAgentId) return false;

    const runtimeType = input.runtimeType?.trim().toLowerCase() ?? null;
    if (!BRIDGE_RUNTIME_TYPES.includes(runtimeType as BridgeRuntimeType)) {
      return false;
    }
    for (const [socketId, kind] of this.socketKinds.entries()) {
      if (kind !== "bridge") continue;
      if (this.socketScopedWorkspaces.get(socketId) !== workspaceId) continue;
      if (this.socketBridgeDeviceIds.get(socketId) !== bridgeDeviceId) {
        continue;
      }
      if (this.socketBridgeRuntimeTypes.get(socketId) !== runtimeType) {
        continue;
      }

      if (runtimeType === "hermes") {
        if (!this.hasHermesBridgeCapability(socketId)) continue;
        if (this.socketHermesBridgeAgents.get(socketId)?.has(externalAgentId)) {
          return true;
        }
        continue;
      }

      if (runtimeType === "openclaw" || runtimeType === "claude_code") {
        if (this.socketBridgeAgents.get(socketId)?.has(externalAgentId)) {
          return true;
        }
        continue;
      }
    }

    return false;
  }

  getBridgeDeviceIdForExternalAgent(input: {
    workspaceId: string;
    externalAgentId: string;
    runtimeType?: string | null;
  }): string | null {
    const runtimeType = input.runtimeType?.trim().toLowerCase();
    if (!BRIDGE_RUNTIME_TYPES.includes(runtimeType as BridgeRuntimeType)) {
      return null;
    }
    for (const [socketId, kind] of this.socketKinds.entries()) {
      if (kind !== "bridge") continue;
      if (this.socketScopedWorkspaces.get(socketId) !== input.workspaceId)
        continue;
      if (this.socketBridgeRuntimeTypes.get(socketId) !== runtimeType) continue;
      const registered =
        runtimeType === "hermes"
          ? this.socketHermesBridgeAgents
              .get(socketId)
              ?.has(input.externalAgentId)
          : this.socketBridgeAgents.get(socketId)?.has(input.externalAgentId);
      if (!registered) continue;
      const deviceId = this.socketBridgeDeviceIds.get(socketId);
      if (deviceId) return deviceId;
    }
    return null;
  }

  getWorkspaceBridgeRuntime(
    workspaceId: string,
    runtimeType: "openclaw" | "claude_code" = "openclaw",
  ) {
    const connectedBridgeDeviceIds = new Set<string>();
    const liveRegisteredExternalAgentIds = new Set<string>();

    for (const [socketId, kind] of this.socketKinds.entries()) {
      if (kind !== "bridge") continue;
      if (this.socketScopedWorkspaces.get(socketId) !== workspaceId) continue;
      if (this.socketBridgeRuntimeTypes.get(socketId) !== runtimeType) continue;

      const bridgeDeviceId = this.socketBridgeDeviceIds.get(socketId);
      if (bridgeDeviceId) {
        connectedBridgeDeviceIds.add(bridgeDeviceId);
      }

      for (const externalAgentId of this.socketBridgeAgents.get(socketId) ??
        []) {
        if (externalAgentId) {
          liveRegisteredExternalAgentIds.add(externalAgentId);
        }
      }
    }

    return {
      connectedBridgeDeviceCount: connectedBridgeDeviceIds.size,
      bridgeControlSubscriberCount: Array.from(
        this.bridgeControlSubscriptions.get(workspaceId) ?? [],
      ).filter(
        (socketId) =>
          this.socketBridgeRuntimeTypes.get(socketId) === runtimeType,
      ).length,
      structuredPromptBridgeControlSubscriberCount: Array.from(
        this.bridgeControlSubscriptions.get(workspaceId) ?? [],
      ).filter(
        (socketId) =>
          this.socketBridgeRuntimeTypes.get(socketId) === runtimeType &&
          this.socketBridgeCapabilities
            .get(socketId)
            ?.has(EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY),
      ).length,
      attachmentBridgeControlSubscriberCount: Array.from(
        this.bridgeControlSubscriptions.get(workspaceId) ?? [],
      ).filter(
        (socketId) =>
          this.socketBridgeRuntimeTypes.get(socketId) === runtimeType &&
          this.socketBridgeCapabilities
            .get(socketId)
            ?.has(EventsGateway.CLAWCHAT_ATTACHMENT_BRIDGE_CAPABILITY),
      ).length,
      liveRegisteredAgentCount: liveRegisteredExternalAgentIds.size,
      liveRegisteredExternalAgentIds: [...liveRegisteredExternalAgentIds],
    };
  }

  getWorkspaceHermesBridgeRuntime(workspaceId: string) {
    const connectedBridgeDeviceIds = new Set<string>();
    const liveRegisteredExternalAgentIds = new Set<string>();

    for (const [socketId, kind] of this.socketKinds.entries()) {
      if (kind !== "bridge") continue;
      if (this.socketScopedWorkspaces.get(socketId) !== workspaceId) continue;
      if (this.socketBridgeRuntimeTypes.get(socketId) !== "hermes") continue;
      if (!this.hasHermesBridgeCapability(socketId)) continue;

      const bridgeDeviceId = this.socketBridgeDeviceIds.get(socketId);
      if (bridgeDeviceId) {
        connectedBridgeDeviceIds.add(bridgeDeviceId);
      }

      for (const externalAgentId of this.socketHermesBridgeAgents.get(
        socketId,
      ) ?? []) {
        if (externalAgentId) {
          liveRegisteredExternalAgentIds.add(externalAgentId);
        }
      }
    }

    return {
      connectedBridgeDeviceCount: connectedBridgeDeviceIds.size,
      liveRegisteredAgentCount: liveRegisteredExternalAgentIds.size,
      liveRegisteredExternalAgentIds: [...liveRegisteredExternalAgentIds],
    };
  }

  hasHermesBridgeWorkspaceCapability(
    workspaceId: string,
    capability: string,
    targetBridgeDeviceId?: string | null,
  ): boolean {
    const normalizedCapability = capability.trim();
    if (!normalizedCapability) return false;
    for (const [socketId, kind] of this.socketKinds.entries()) {
      if (kind !== "bridge") continue;
      if (this.socketScopedWorkspaces.get(socketId) !== workspaceId) continue;
      if (this.socketBridgeRuntimeTypes.get(socketId) !== "hermes") continue;
      if (!this.hasHermesBridgeCapability(socketId)) continue;
      if (
        targetBridgeDeviceId &&
        this.socketBridgeDeviceIds.get(socketId) !== targetBridgeDeviceId
      ) {
        continue;
      }
      if (
        this.socketBridgeCapabilities.get(socketId)?.has(normalizedCapability)
      ) {
        return true;
      }
    }
    return false;
  }

  emitToThread(threadId: string, event: string, data: unknown): void {
    this.emitToSocketSet(
      this.threadSubscriptions.get(threadId),
      event,
      data,
      "thread",
    );
  }

  emitToScopes(
    scopes: {
      workspaceId?: string | null;
      threadId?: string | null;
      userId?: string | null;
    },
    event: string,
    data: unknown,
  ): void {
    const socketIds = new Set<string>();

    if (scopes.workspaceId) {
      for (const socketId of this.workspaceSubscriptions.get(
        scopes.workspaceId,
      ) ?? []) {
        socketIds.add(socketId);
      }
    }

    if (scopes.threadId) {
      for (const socketId of this.threadSubscriptions.get(scopes.threadId) ??
        []) {
        socketIds.add(socketId);
      }
    }

    if (scopes.userId) {
      for (const socketId of this.userSockets.get(scopes.userId) ?? []) {
        socketIds.add(socketId);
      }
    }

    this.emitToSocketSet(socketIds, event, data, "scoped");
    if (event === "message.new") {
      const message = data as Partial<MessageEntity>;
      if (message.senderId && message.threadId) {
        void this.emitAgentOpsLiveStateUpdateForAgent(
          scopes.workspaceId,
          message.senderId,
        );
      }
    }
  }

  async emitAgentOpsLiveStateUpdateForAgent(
    workspaceId: string | null | undefined,
    agentId: string | null | undefined,
  ) {
    if (!workspaceId || !agentId) return;
    const agentOpsService = this.getAgentOpsService();
    if (!agentOpsService) return;
    const snapshot = await agentOpsService.resolveLiveStateSnapshot({
      workspaceId,
      agentIds: [agentId],
    });
    const state = snapshot.agents[0];
    if (!state) return;
    this.emitToWorkspace(workspaceId, "agent_ops.live_state.updated", state);
  }

  disconnectWebSession(userId: string, sessionId: string): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    for (const socketId of [...sockets]) {
      if (this.socketKinds.get(socketId) !== "web") continue;
      if (this.socketSessionIds.get(socketId) !== sessionId) continue;

      this.sendToSocket(socketId, {
        type: "session.revoked",
        data: { reason: "logout" },
      });
      const client = this.clients.get(socketId);
      try {
        client?.close(4002, "Session revoked");
      } catch {}
    }
  }

  disconnectMobileSession(
    userId: string,
    sessionId?: string | null,
    reason = "mobile_session_revoked",
  ): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    for (const socketId of [...sockets]) {
      if (this.socketKinds.get(socketId) !== "mobile") continue;
      const mappedSessionId = this.socketSessionIds.get(socketId);
      if (sessionId ? mappedSessionId !== sessionId : mappedSessionId) continue;

      this.sendToSocket(socketId, {
        type: "session.revoked",
        data: { reason },
      });
      const client = this.clients.get(socketId);
      try {
        client?.close(4002, "Session revoked");
      } catch {}
    }
  }

  disconnectUserSessions(
    userId: string,
    reason = "account_security_event",
  ): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    for (const socketId of [...sockets]) {
      this.sendToSocket(socketId, {
        type: "session.revoked",
        data: { reason },
      });
      const client = this.clients.get(socketId);
      try {
        client?.close(4002, "Session revoked");
      } catch {}
    }
  }

  disconnectBridgeDevice(deviceId: string): void {
    for (const [
      socketId,
      mappedDeviceId,
    ] of this.socketBridgeDeviceIds.entries()) {
      if (mappedDeviceId !== deviceId) continue;

      this.sendToSocket(socketId, {
        type: "session.revoked",
        data: { reason: "bridge_device_revoked" },
      });
      const client = this.clients.get(socketId);
      try {
        client?.close(4003, "Bridge device revoked");
      } catch {}
    }
  }

  private registerAuthenticatedSocket(
    socketId: string,
    userId: string,
    kind: SocketKind,
    sessionId?: string,
    scopedWorkspaceId?: string,
    bridgeDeviceId?: string,
    bridgeRuntimeType?: BridgeRuntimeType,
  ) {
    this.socketUsers.set(socketId, userId);
    this.socketKinds.set(socketId, kind);
    if (sessionId) {
      this.socketSessionIds.set(socketId, sessionId);
    }
    if (scopedWorkspaceId) {
      this.socketScopedWorkspaces.set(socketId, scopedWorkspaceId);
    }
    if (bridgeDeviceId) {
      if (!bridgeRuntimeType) {
        throw new Error("Bridge runtime identity is required");
      }
      this.socketBridgeDeviceIds.set(socketId, bridgeDeviceId);
      this.socketBridgeRuntimeTypes.set(socketId, bridgeRuntimeType);
    }
    this.clearSocketAuthDeadline(socketId);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(socketId);
  }

  private async authenticateWithTicket(socketId: string, ticket: string) {
    const payload = await this.realtimeAuthPolicy.verifyBrowserTicket(ticket);
    await this.websocketTickets.consume({
      jti: payload.jti,
      userId: payload.sub,
      sessionId: payload.sid,
      workspaceId: payload.workspaceId,
    });

    const session = await this.webSessionRepository.findOne({
      where: { id: payload.sid, userId: payload.sub, revokedAt: IsNull() },
      select: ["id", "userId"],
    });
    if (!session) {
      throw new Error("Web session revoked");
    }

    if (payload.workspaceId) {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        payload.workspaceId,
        session.userId,
      );
    }

    this.registerAuthenticatedSocket(
      socketId,
      session.userId,
      "web",
      payload.sid,
      payload.workspaceId,
    );
    this.sendToSocket(socketId, {
      type: "authenticated",
      data: {
        userId: session.userId,
        kind: "web",
        workspaceId: payload.workspaceId,
      },
    });
  }

  private async auditUnauthorizedSubscription(
    socketId: string,
    workspaceId: string | null,
    threadId: string | null,
    scope: string,
  ) {
    await this.auditLogService.record({
      actorType:
        this.socketKinds.get(socketId) === "bridge" ? "bridge_device" : "user",
      actorId:
        this.socketBridgeDeviceIds.get(socketId) ??
        this.socketUsers.get(socketId) ??
        null,
      workspaceId:
        workspaceId ?? this.socketScopedWorkspaces.get(socketId) ?? null,
      eventType: "security.cross_workspace_access.denied",
      resourceType: scope,
      resourceId: threadId ?? workspaceId,
      metadata: {
        socketId,
        requestedWorkspaceId: workspaceId,
        requestedThreadId: threadId,
        scope,
      },
    });
  }

  private scheduleSocketAuthDeadline(socketId: string) {
    this.clearSocketAuthDeadline(socketId);
    const timeout = setTimeout(
      () => {
        if (this.socketUsers.has(socketId)) return;
        this.sendToSocket(socketId, {
          type: "auth_error",
          data: { error: "Authentication required" },
        });
        this.closeSocket(socketId, 4000, "Authentication required");
      },
      getPositiveConfigInt(
        this.configService,
        "WS_AUTH_DEADLINE_MS",
        DEFAULT_WS_AUTH_DEADLINE_MS,
      ),
    );
    timeout.unref?.();
    this.socketAuthDeadlines.set(socketId, timeout);
  }

  private clearSocketAuthDeadline(socketId: string) {
    const timeout = this.socketAuthDeadlines.get(socketId);
    if (timeout) {
      clearTimeout(timeout);
      this.socketAuthDeadlines.delete(socketId);
    }
  }

  private enqueueInboundFrame(socketId: string, data: RawData): void {
    const previous =
      this.socketInboundQueues.get(socketId) ?? Promise.resolve();
    const next = previous
      .then(() => this.processInboundFrame(socketId, data))
      .catch((error: Error) => {
        this.logger.error(
          `Failed to process WS frame from ${socketId}: ${error.message}`,
        );
        this.closeSocket(socketId, 1011, "Message processing failed");
      })
      .finally(() => {
        if (this.socketInboundQueues.get(socketId) === next) {
          this.socketInboundQueues.delete(socketId);
        }
      });
    this.socketInboundQueues.set(socketId, next);
  }

  private async processInboundFrame(
    socketId: string,
    data: RawData,
  ): Promise<void> {
    if (!(await this.acceptInboundFrame(socketId, data))) return;
    let message: RealtimeInboundEvent;
    try {
      message = JSON.parse(
        rawWebsocketDataToString(data),
      ) as RealtimeInboundEvent;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to parse WS message: ${error.message}`);
      this.closeSocket(socketId, 1007, "Invalid JSON");
      return;
    }
    if (this.rejectUnauthenticatedMessage(socketId, message)) return;
    try {
      await this.handleMessage(socketId, message);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to handle WS message ${message.type} from ${socketId}: ${err.message}`,
        err.stack,
      );
    }
  }

  private async acceptInboundFrame(
    socketId: string,
    data: RawData,
  ): Promise<boolean> {
    const frameBytes = getRawWebsocketDataByteLength(data);
    const maxFrameBytes = this.socketUsers.has(socketId)
      ? getPositiveConfigInt(
          this.configService,
          "WS_MAX_AUTHENTICATED_FRAME_BYTES",
          DEFAULT_WS_MAX_AUTHENTICATED_FRAME_BYTES,
        )
      : getPositiveConfigInt(
          this.configService,
          "WS_MAX_UNAUTHENTICATED_FRAME_BYTES",
          DEFAULT_WS_MAX_UNAUTHENTICATED_FRAME_BYTES,
        );
    if (frameBytes > maxFrameBytes) {
      this.closeSocket(socketId, 1009, "Frame too large");
      return false;
    }

    const rateLimitDecision =
      await this.getWebsocketRateLimitDecision(socketId);
    if (rateLimitDecision.limited) {
      this.logWebsocketRateLimitExceeded(socketId, rateLimitDecision);
      this.closeSocket(socketId, 4008, "Rate limit exceeded");
      return false;
    }
    return true;
  }

  private rejectUnauthenticatedMessage(
    socketId: string,
    message: RealtimeInboundEvent,
  ): boolean {
    if (this.socketUsers.has(socketId)) return false;
    if (message?.type === "authenticate") return false;
    this.sendToSocket(socketId, {
      type: "auth_error",
      data: { error: "Authentication required" },
    });
    this.closeSocket(socketId, 4000, "Authentication required");
    return true;
  }

  private async getWebsocketRateLimitDecision(
    socketId: string,
  ): Promise<WebsocketRateLimitDecision> {
    const windowMs = getPositiveConfigInt(
      this.configService,
      "WS_RATE_WINDOW_MS",
      DEFAULT_WS_RATE_WINDOW_MS,
    );
    const socketLimit = getPositiveConfigInt(
      this.configService,
      "WS_SOCKET_MESSAGE_LIMIT",
      DEFAULT_WS_SOCKET_MESSAGE_LIMIT,
    );
    const ipLimit = getPositiveConfigInt(
      this.configService,
      "WS_IP_MESSAGE_LIMIT",
      DEFAULT_WS_IP_MESSAGE_LIMIT,
    );
    const tracker = this.socketRateLimitTrackers.get(socketId) ?? "unknown";
    const [socketBucket, trackerBucket] = await Promise.all([
      this.rateLimits.incrementNamed("ws-socket", socketId, windowMs),
      this.rateLimits.incrementNamed("ws-client", tracker, windowMs),
    ]);
    const socketLimited = socketBucket.totalHits > socketLimit;
    const trackerLimited = trackerBucket.totalHits > ipLimit;
    return {
      limited: socketLimited || trackerLimited,
      socketLimited,
      trackerLimited,
      tracker,
      windowMs,
      socketLimit,
      trackerLimit: ipLimit,
    };
  }

  private logWebsocketRateLimitExceeded(
    socketId: string,
    decision: WebsocketRateLimitDecision,
  ) {
    this.logger.warn(
      JSON.stringify({
        event: "websocket.rate_limit.exceeded",
        socketId,
        kind: this.socketKinds.get(socketId) ?? null,
        authenticated: this.socketUsers.has(socketId),
        workspaceId: this.socketScopedWorkspaces.get(socketId) ?? null,
        trackerHash: hashRealtimeTelemetryValue(decision.tracker),
        socketLimited: decision.socketLimited,
        trackerLimited: decision.trackerLimited,
        windowMs: decision.windowMs,
        socketLimit: decision.socketLimit,
        trackerLimit: decision.trackerLimit,
      }),
    );
  }

  private logWebsocketDisconnect(input: {
    socketId: string;
    kind?: SocketKind;
    authenticated: boolean;
    scopedWorkspaceId?: string;
    bridgeDeviceId?: string;
    tracker: string;
  }) {
    this.logger.log(
      JSON.stringify({
        event: "websocket.client.disconnected",
        socketId: input.socketId,
        kind: input.kind ?? null,
        authenticated: input.authenticated,
        workspaceId: input.scopedWorkspaceId ?? null,
        bridgeDeviceId: input.bridgeDeviceId ?? null,
        trackerHash: hashRealtimeTelemetryValue(input.tracker),
      }),
    );
  }

  private closeSocket(socketId: string, code: number, reason: string) {
    const client = this.clients.get(socketId);
    if (!client) return;
    try {
      this.clearSocketAuthDeadline(socketId);
      client.close(code, reason);
    } catch (error) {
      this.logger.warn(
        `Failed to close socket ${socketId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async handleReplayPendingDispatches(
    socketId: string,
    threadId: string,
  ) {
    if (!threadId) return;
    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
      select: ["id", "workspaceId", "activeSessionId"],
    });
    if (!thread) {
      return;
    }

    const userId = this.socketUsers.get(socketId);
    if (!userId || this.socketKinds.get(socketId) === "bridge") {
      await this.auditUnauthorizedSubscription(
        socketId,
        thread.workspaceId,
        threadId,
        "thread",
      );
      return;
    }

    try {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        thread.workspaceId,
        userId,
      );
    } catch {
      await this.auditUnauthorizedSubscription(
        socketId,
        thread.workspaceId,
        threadId,
        "thread",
      );
      return;
    }

    await this.replayRuntimeDispatchesToSocket(
      socketId,
      thread.id,
      thread.activeSessionId ?? null,
    );
  }

  private async handleReplayAgentOpsLiveState(
    socketId: string,
    workspaceId: string,
    agentIds: string[],
  ) {
    if (!workspaceId) return;
    const userId = this.socketUsers.get(socketId);
    if (!userId || this.socketKinds.get(socketId) === "bridge") {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "workspace",
      );
      return;
    }

    const scopedWorkspaceId = this.socketScopedWorkspaces.get(socketId);
    if (scopedWorkspaceId && scopedWorkspaceId !== workspaceId) {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "workspace",
      );
      return;
    }

    try {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        workspaceId,
        userId,
      );
    } catch {
      await this.auditUnauthorizedSubscription(
        socketId,
        workspaceId,
        null,
        "workspace",
      );
      return;
    }

    const agentOpsService = this.getAgentOpsService();
    if (!agentOpsService) return;
    const snapshot = await agentOpsService.resolveLiveStateSnapshot({
      workspaceId,
      agentIds,
    });
    this.sendToSocket(socketId, {
      type: "agent_ops.live_state.snapshot",
      data: snapshot,
    });
  }

  private async replayRuntimeDispatchesToSocket(
    socketId: string,
    threadId: string,
    threadSessionId?: string | null,
  ) {
    const runtimeDispatchService = this.getRuntimeDispatchService();
    const runtimeBindingService = this.getRuntimeBindingService();
    if (!runtimeDispatchService || !runtimeBindingService) {
      return;
    }

    const dispatches = await runtimeDispatchService.findReplayableByThread({
      threadId,
      threadSessionId,
    });
    if (!dispatches.length) {
      return;
    }

    const now = Date.now();
    const expiredDispatches = dispatches.filter(
      (dispatch) =>
        ["queued", "started"].includes(dispatch.status) &&
        dispatch.timeoutAt &&
        dispatch.timeoutAt.getTime() <= now,
    );
    if (expiredDispatches.length) {
      const runtimeDispatchCoordinator = this.getRuntimeDispatchCoordinator();
      if (runtimeDispatchCoordinator) {
        await Promise.all(
          expiredDispatches.map((dispatch) =>
            runtimeDispatchCoordinator.failDispatchById({
              dispatchId: dispatch.id,
              code: "timeout",
              message:
                "Runtime dispatch timed out before the agent posted a reply.",
              retryable: true,
            }),
          ),
        );
      }
    }

    const replayDispatches = expiredDispatches.length
      ? await runtimeDispatchService.findReplayableByThread({
          threadId,
          threadSessionId,
        })
      : dispatches;
    if (!replayDispatches.length) {
      return;
    }

    const bindingIds = Array.from(
      new Set(replayDispatches.map((dispatch) => dispatch.runtimeBindingId)),
    );
    const bindings = await Promise.all(
      bindingIds.map((bindingId) => runtimeBindingService.findById(bindingId)),
    );
    const runtimeTypeByBindingId = new Map(
      bindings
        .filter((binding): binding is NonNullable<typeof binding> =>
          Boolean(binding),
        )
        .map((binding) => [binding.id, binding.runtimeType]),
    );

    for (const dispatch of replayDispatches) {
      const runtimeType =
        runtimeTypeByBindingId.get(dispatch.runtimeBindingId) ?? "openclaw";
      const timestamp =
        dispatch.completedAt?.toISOString() ??
        dispatch.startedAt?.toISOString() ??
        dispatch.updatedAt.toISOString();
      const runtimeStreamDraft = runtimeDispatchService.readRuntimeStreamDraft(
        dispatch.resultMetadata,
      );

      if (dispatch.status === "failed") {
        this.sendToSocket(socketId, {
          type: "runtime.dispatch.failed",
          data: {
            workspaceId: dispatch.workspaceId,
            threadId: dispatch.threadId,
            threadSessionId: dispatch.threadSessionId,
            dispatchId: dispatch.id,
            agentId: dispatch.agentId,
            runtimeType,
            runtimeBindingId: dispatch.runtimeBindingId,
            runtimeThreadSessionId: dispatch.runtimeThreadSessionId,
            code: dispatch.errorCode ?? "runtime_error",
            message:
              dispatch.errorMessage ??
              "Runtime dispatch failed before replying.",
            retryable:
              dispatch.resultMetadata?.retryable === true ||
              dispatch.errorCode === "timeout",
            timestamp,
          },
        });
        continue;
      }

      if (dispatch.status === "cancelled") {
        this.sendToSocket(socketId, {
          type: "runtime.dispatch.cancelled",
          data: {
            workspaceId: dispatch.workspaceId,
            threadId: dispatch.threadId,
            threadSessionId: dispatch.threadSessionId,
            dispatchId: dispatch.id,
            agentId: dispatch.agentId,
            runtimeType,
            runtimeBindingId: dispatch.runtimeBindingId,
            runtimeThreadSessionId: dispatch.runtimeThreadSessionId,
            timestamp,
          },
        });
        continue;
      }

      this.sendToSocket(socketId, {
        type:
          dispatch.status === "queued"
            ? "runtime.dispatch.queued"
            : "runtime.dispatch.started",
        data: {
          workspaceId: dispatch.workspaceId,
          threadId: dispatch.threadId,
          threadSessionId: dispatch.threadSessionId,
          dispatchId: dispatch.id,
          messageId: dispatch.messageId,
          agentId: dispatch.agentId,
          runtimeType,
          runtimeBindingId: dispatch.runtimeBindingId,
          runtimeThreadSessionId: dispatch.runtimeThreadSessionId,
          timestamp: runtimeStreamDraft?.updatedAt ?? timestamp,
          draftText: runtimeStreamDraft?.text,
          draftSeq: runtimeStreamDraft?.latestSeq,
        },
      });
    }
  }

  private getRuntimeDispatchService() {
    if (!this.runtimeDispatchService) {
      this.runtimeDispatchService = this.moduleRef.get(RuntimeDispatchService, {
        strict: false,
      });
    }
    return this.runtimeDispatchService;
  }

  private getAgentOpsService() {
    if (!this.agentOpsService) {
      this.agentOpsService = this.moduleRef.get(AgentOpsService, {
        strict: false,
      });
    }
    return this.agentOpsService;
  }

  private getCloudCommercialService() {
    if (!this.cloudCommercialService) {
      this.cloudCommercialService = this.moduleRef.get(CloudCommercialService, {
        strict: false,
      });
    }
    return this.cloudCommercialService;
  }

  private async bridgeEntitlementIsWritable(socketId: string) {
    const workspaceId = this.socketScopedWorkspaces.get(socketId);
    if (!workspaceId) return false;
    const entitlement =
      await this.getCloudCommercialService().entitlementPayload(workspaceId);
    return entitlement.mode === "read_write";
  }

  private getRuntimeBindingService() {
    if (!this.runtimeBindingService) {
      this.runtimeBindingService = this.moduleRef.get(RuntimeBindingService, {
        strict: false,
      });
    }
    return this.runtimeBindingService;
  }

  private getRuntimeDispatchCoordinator() {
    if (!this.runtimeDispatchCoordinator) {
      this.runtimeDispatchCoordinator = this.moduleRef.get(
        RuntimeDispatchCoordinator,
        {
          strict: false,
        },
      );
    }
    return this.runtimeDispatchCoordinator;
  }

  private getRuntimeEventService() {
    if (!this.runtimeEventService) {
      this.runtimeEventService = this.moduleRef.get(RuntimeEventService, {
        strict: false,
      });
    }
    return this.runtimeEventService;
  }

  private getRuntimeThreadSessionService() {
    if (!this.runtimeThreadSessionService) {
      this.runtimeThreadSessionService = this.moduleRef.get(
        RuntimeThreadSessionService,
        {
          strict: false,
        },
      );
    }
    return this.runtimeThreadSessionService;
  }

  private buildMessagePreview(content: string) {
    return content
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
  }

  private getHermesBridgeRuntimeService() {
    return this.moduleRef.get(HermesBridgeRuntimeService, {
      strict: false,
    });
  }

  private buildBridgeAgentKey(
    workspaceId?: string | null,
    externalAgentId?: string | null,
  ) {
    const workspace = workspaceId?.trim();
    const externalId = externalAgentId?.trim();
    return workspace && externalId ? `${workspace}:${externalId}` : null;
  }

  private buildHermesBridgeAgentKey(
    workspaceId?: string | null,
    externalAgentId?: string | null,
  ) {
    return this.buildBridgeAgentKey(workspaceId, externalAgentId);
  }

  private hasHermesBridgeCapability(socketId: string) {
    const capabilities = this.socketBridgeCapabilities.get(socketId);
    return Boolean(
      capabilities?.has("clawchat.runtime.hermes") ||
      capabilities?.has("hermes") ||
      capabilities?.has("hermes_bridge"),
    );
  }

  private async emitHermesBridgeAgentHealth(
    workspaceId: string | null | undefined,
    externalAgentId: string,
    status: "ready" | "offline",
    message: string,
  ) {
    if (!workspaceId || !externalAgentId) return;
    const agent = await this.agentRepository.findOne({
      where: {
        workspaceId,
        externalId: externalAgentId,
        source: "hermes",
      } as any,
      select: ["id"],
    });
    if (!agent) return;
    this.emitToWorkspace(workspaceId, "runtime.participant.health", {
      workspaceId,
      agentId: agent.id,
      runtimeType: "hermes",
      status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private isHermesBridgeRuntimeEvent(
    value: unknown,
  ): value is HermesBridgeInboundEvent {
    if (!value || typeof value !== "object") return false;
    const event = value as Record<string, unknown>;
    if (typeof event.dispatchId !== "string" || !event.dispatchId.trim()) {
      return false;
    }
    switch (event.type) {
      case "run.started":
      case "run.cancelled":
        return true;
      case "run.delta":
        return typeof event.seq === "number" && typeof event.text === "string";
      case "run.thinking":
        return (
          typeof event.seq === "number" && typeof event.thinking === "string"
        );
      case "run.status":
        return (
          typeof event.code === "string" && typeof event.message === "string"
        );
      case "run.tool":
        return (
          typeof event.toolName === "string" && typeof event.phase === "string"
        );
      case "run.context":
        return (
          typeof event.level === "string" && typeof event.fresh === "boolean"
        );
      case "run.completed":
        return (
          event.finalText === undefined || typeof event.finalText === "string"
        );
      case "run.failed":
        return (
          typeof event.code === "string" &&
          typeof event.message === "string" &&
          typeof event.retryable === "boolean"
        );
      default:
        return false;
    }
  }

  private emitToSocketSet(
    socketIds: Iterable<string> | undefined,
    event: string,
    data: unknown,
    scope:
      | "workspace"
      | "thread"
      | "user"
      | "scoped"
      | "bridge-agent"
      | "bridge-control"
      | "bridge-workspace"
      | "hermes-bridge-agent",
  ): void {
    if (!socketIds) return;

    const payload = JSON.stringify({ type: event, data });
    for (const socketId of socketIds) {
      const client = this.clients.get(socketId);
      if (!client || client.readyState !== WebSocket.OPEN) continue;

      try {
        client.send(payload);
      } catch {
        this.logger.error(
          `Failed to emit ${event} to ${scope} socket ${socketId}`,
        );
      }
    }
  }
}
