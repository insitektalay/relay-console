import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { IsNull } from "typeorm";
import { WebSocket } from "ws";
import { EventsGateway } from "./events.gateway";
import { BridgeControlCoordinatorService } from "./bridge-control-coordinator.service";
import { BridgeControlBusService } from "./bridge-control-bus.service";
import { WorkspaceMembershipService } from "../modules/workspace-membership/workspace-membership.service";
import { AuditLogService } from "../modules/audit-log/audit-log.service";
import { WebSessionEntity } from "../entities/web-session.entity";
import { ThreadEntity } from "../entities/thread.entity";
import { AgentEntity } from "../entities/agent.entity";
import {
  BridgeDeviceEntity,
  BridgeDeviceStatus,
} from "../entities/bridge-device.entity";
import { MessageEntity } from "../entities/message.entity";
import { MobileSessionEntity } from "../entities/mobile-session.entity";
import { CloudCommercialService } from "../modules/cloud-commercial/cloud-commercial.service";
import { WebsocketTicketReplayService } from "./websocket-ticket-replay.service";
import { DistributedRateLimitService } from "../modules/security/distributed-rate-limit.service";

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function buildGateway() {
  const jwtService = { verify: jest.fn(), verifyAsync: jest.fn() };
  const workspaceMembershipService = {
    ensureWorkspaceAccess: jest
      .fn()
      .mockRejectedValue(new ForbiddenException()),
  };
  const auditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const configService = {
    get: jest.fn((key: string): string =>
      key === "CORS_ORIGINS" ? "" : "secret",
    ),
  };

  const threadRepository = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: "thread-b",
      workspaceId: "ws-b",
    }),
  });
  const agentRepository = makeRepoMock();
  const webSessionRepository = makeRepoMock();
  const mobileSessionRepository = makeRepoMock();
  const bridgeDeviceRepository = makeRepoMock();
  const bridgeControlCoordinator = {
    resolveFromBridgeMessage: jest.fn().mockReturnValue(false),
    registerRequest: jest.fn(),
  };
  const bridgeControlBus = {
    registerPresenceHandler: jest.fn(),
    registerControlRequestHandler: jest.fn(),
    registerResponseHandler: jest.fn(),
    publishBridgeResponseFromMessage: jest.fn().mockResolvedValue(false),
    resolveRemoteSubscriber: jest.fn().mockResolvedValue(null),
    publishControlRequest: jest.fn().mockResolvedValue(true),
  };
  const cloudCommercialService = {
    entitlementPayload: jest.fn().mockResolvedValue({
      status: "active",
      mode: "read_write",
    }),
  };
  const websocketTickets = {
    register: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const rateBuckets = new Map<string, number>();
  const rateLimits = {
    incrementNamed: jest.fn(
      async (namespace: string, key: string, ttl: number) => {
        const bucketKey = `${namespace}:${key}`;
        const totalHits = (rateBuckets.get(bucketKey) ?? 0) + 1;
        rateBuckets.set(bucketKey, totalHits);
        return { totalHits, timeToExpire: Math.ceil(ttl / 1000) };
      },
    ),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EventsGateway,
      {
        provide: JwtService,
        useValue: jwtService,
      },
      {
        provide: ConfigService,
        useValue: configService,
      },
      {
        provide: BridgeControlCoordinatorService,
        useValue: bridgeControlCoordinator,
      },
      {
        provide: BridgeControlBusService,
        useValue: bridgeControlBus,
      },
      {
        provide: WorkspaceMembershipService,
        useValue: workspaceMembershipService,
      },
      {
        provide: CloudCommercialService,
        useValue: cloudCommercialService,
      },
      {
        provide: WebsocketTicketReplayService,
        useValue: websocketTickets,
      },
      {
        provide: DistributedRateLimitService,
        useValue: rateLimits,
      },
      { provide: AuditLogService, useValue: auditLogService },
      {
        provide: getRepositoryToken(WebSessionEntity),
        useValue: webSessionRepository,
      },
      {
        provide: getRepositoryToken(MobileSessionEntity),
        useValue: mobileSessionRepository,
      },
      { provide: getRepositoryToken(ThreadEntity), useValue: threadRepository },
      { provide: getRepositoryToken(AgentEntity), useValue: agentRepository },
      {
        provide: getRepositoryToken(BridgeDeviceEntity),
        useValue: bridgeDeviceRepository,
      },
      {
        provide: getRepositoryToken(MessageEntity),
        useValue: makeRepoMock(),
      },
    ],
  }).compile();

  const gateway = module.get(EventsGateway) as any;
  gateway.clients.set("socket-1", {
    readyState: WebSocket.OPEN,
    send: jest.fn(),
  });

  gateway.registerAuthenticatedSocket(
    "socket-1",
    "user-a",
    "web",
    "session-1",
    "ws-a",
  );

  return {
    gateway,
    auditLogService,
    jwtService,
    workspaceMembershipService,
    webSessionRepository,
    mobileSessionRepository,
    threadRepository,
    agentRepository,
    bridgeDeviceRepository,
    configService,
    bridgeControlCoordinator,
    bridgeControlBus,
    cloudCommercialService,
    websocketTickets,
    rateLimits,
  };
}

function makeWsClient() {
  const handlers = new Map<string, (...args: any[]) => void>();
  const client = {
    readyState: WebSocket.OPEN,
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler);
      return client;
    }),
  } as any;
  return { client, handlers };
}

function makeRequest(
  remoteAddress = "203.0.113.10",
  origin?: string,
  url = "/socket",
  userAgent?: string,
  extraHeaders: Record<string, string> = {},
) {
  const headers: Record<string, string> = { ...extraHeaders };
  if (origin) headers.origin = origin;
  if (userAgent) headers["user-agent"] = userAgent;
  return {
    headers,
    url,
    socket: { remoteAddress },
  } as any;
}

function flushPromises() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

describe("EventsGateway", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("correlates capability-gated paired-host requests before returning acknowledgement", async () => {
    const { gateway, bridgeControlCoordinator } = await buildGateway();
    jest.spyOn(gateway, "hasBridgeControlSubscribers").mockReturnValue(true);
    const emit = jest.spyOn(gateway, "emitToBridgeControls");
    bridgeControlCoordinator.registerRequest.mockImplementation(
      (requestId: string) =>
        Promise.resolve({
          type: "clawchat.host.scheduler.maintain.result",
          data: { requestId, acknowledged: true },
        }),
    );

    const result = await gateway.requestBridgeControl({
      workspaceId: "ws-a",
      eventType: "clawchat.host.scheduler.maintain",
      data: { externalAgentId: "agent-a", jobId: "daily" },
      resultType: "clawchat.host.scheduler.maintain.result",
      errorType: "clawchat.host.scheduler.maintain.error",
      capability: "clawchat.host.scheduler_maintenance",
    });

    expect(result.acknowledged).toBe(true);
    expect(emit).toHaveBeenCalledWith(
      "ws-a",
      "clawchat.host.scheduler.maintain",
      expect.objectContaining({
        requestId: expect.any(String),
        externalAgentId: "agent-a",
        jobId: "daily",
      }),
      "clawchat.host.scheduler_maintenance",
      undefined,
      "openclaw",
    );
  });

  it("propagates runtime identity through distributed bridge control routing", async () => {
    const { gateway, bridgeControlCoordinator, bridgeControlBus } =
      await buildGateway();
    jest.spyOn(gateway, "hasBridgeControlSubscribers").mockReturnValue(false);
    bridgeControlBus.resolveRemoteSubscriber.mockResolvedValue(
      "remote-instance",
    );
    bridgeControlCoordinator.registerRequest.mockImplementation(
      (requestId: string) =>
        Promise.resolve({
          type: "claude.cli.structured_prompt.result",
          data: { requestId, acknowledged: true },
        }),
    );

    await gateway.requestBridgeControl({
      workspaceId: "ws-a",
      eventType: "claude.cli.structured_prompt",
      data: { prompt: "private" },
      resultType: "claude.cli.structured_prompt.result",
      errorType: "claude.cli.structured_prompt.error",
      capability: EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY,
      runtimeType: "claude_code",
    });

    expect(bridgeControlBus.resolveRemoteSubscriber).toHaveBeenCalledWith({
      workspaceId: "ws-a",
      capability: EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY,
      targetBridgeDeviceId: undefined,
      runtimeType: "claude_code",
    });
    expect(bridgeControlBus.publishControlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        targetInstanceId: "remote-instance",
        workspaceId: "ws-a",
        runtimeType: "claude_code",
      }),
    );
  });

  it("closes sockets that do not authenticate before the websocket auth deadline", async () => {
    jest.useFakeTimers();
    const { gateway, configService } = await buildGateway();
    configService.get.mockImplementation((key: string) =>
      key === "WS_AUTH_DEADLINE_MS"
        ? "25"
        : key === "CORS_ORIGINS"
          ? ""
          : "secret",
    );
    const { client } = makeWsClient();

    gateway.handleConnection(client, makeRequest());
    jest.advanceTimersByTime(26);

    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "auth_error",
        data: { error: "Authentication required" },
      }),
    );
    expect(client.close).toHaveBeenCalledWith(4000, "Authentication required");
  });

  it("requires an allowed Origin for ticket-authenticated browser sockets", async () => {
    const { gateway, jwtService } = await buildGateway();
    const { client } = makeWsClient();

    gateway.handleConnection(
      client,
      makeRequest("203.0.113.10", undefined, "/socket?ticket=ticket-1"),
    );

    expect(client.close).toHaveBeenCalledWith(1008, "Origin required");
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(client.socketId).toBeUndefined();
  });

  it("rejects websocket credentials in URLs even from allowed Origins", async () => {
    const { gateway, configService, jwtService } = await buildGateway();
    configService.get.mockImplementation((key: string) =>
      key === "CORS_ORIGINS" ? "https://app.clawchat.test" : "secret",
    );
    const { client } = makeWsClient();

    gateway.handleConnection(
      client,
      makeRequest(
        "203.0.113.10",
        "https://app.clawchat.test",
        "/socket?ticket=must-not-leak",
      ),
    );

    expect(client.close).toHaveBeenCalledWith(
      1008,
      "WebSocket credentials are not allowed in URLs",
    );
    expect(client.socketId).toBeUndefined();
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it("rejects websocket connections from disallowed Origins", async () => {
    const { gateway, configService } = await buildGateway();
    configService.get.mockImplementation((key: string) =>
      key === "CORS_ORIGINS" ? "https://app.clawchat.test" : "secret",
    );
    const { client } = makeWsClient();

    gateway.handleConnection(
      client,
      makeRequest("203.0.113.10", "https://evil.example"),
    );

    expect(client.close).toHaveBeenCalledWith(1008, "Origin not allowed");
    expect(client.socketId).toBeUndefined();
  });

  it("rejects browser-like websocket connections that omit Origin", async () => {
    const { gateway } = await buildGateway();
    const { client } = makeWsClient();

    gateway.handleConnection(
      client,
      makeRequest(
        "203.0.113.10",
        undefined,
        "/socket",
        "Mozilla/5.0 Safari/605.1.15",
      ),
    );

    expect(client.close).toHaveBeenCalledWith(1008, "Origin required");
    expect(client.socketId).toBeUndefined();
  });

  it("accepts ticket-authenticated browser sockets from allowed Origins", async () => {
    const {
      gateway,
      configService,
      jwtService,
      webSessionRepository,
      workspaceMembershipService,
      websocketTickets,
    } = await buildGateway();
    configService.get.mockImplementation((key: string) => {
      if (key === "CORS_ORIGINS") return "https://app.clawchat.test";
      if (key === "JWT_WS_SECRET" || key === "JWT_SECRET") return "secret";
      return "secret";
    });
    jwtService.verifyAsync.mockResolvedValue({
      kind: "ws_ticket",
      sid: "session-1",
      sub: "user-a",
      workspaceId: "ws-a",
      jti: "ticket-id-1",
      aud: "relay-browser-websocket",
    });
    webSessionRepository.findOne.mockResolvedValue({
      id: "session-1",
      userId: "user-a",
    });
    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(true);
    const { client, handlers } = makeWsClient();

    gateway.handleConnection(
      client,
      makeRequest("203.0.113.10", "https://app.clawchat.test", "/socket"),
    );
    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "ticket-1" })),
    );
    await flushPromises();

    expect(websocketTickets.consume).toHaveBeenCalledWith({
      jti: "ticket-id-1",
      userId: "user-a",
      sessionId: "session-1",
      workspaceId: "ws-a",
    });
    expect(gateway.socketKinds.get(client.socketId)).toBe("web");
    expect(gateway.socketScopedWorkspaces.get(client.socketId)).toBe("ws-a");
    expect(webSessionRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-a",
        revokedAt: expect.anything(),
      },
      select: ["id", "userId"],
    });
    expect(
      webSessionRepository.findOne.mock.calls[0][0].where.revokedAt,
    ).toEqual(IsNull());
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "authenticated",
        data: { userId: "user-a", kind: "web", workspaceId: "ws-a" },
      }),
    );
  });

  it("rejects websocket tickets with a revoked web session predicate miss", async () => {
    const { gateway, configService, jwtService, webSessionRepository } =
      await buildGateway();
    configService.get.mockImplementation((key: string) => {
      if (key === "CORS_ORIGINS") return "https://app.clawchat.test";
      if (key === "JWT_WS_SECRET" || key === "JWT_SECRET") return "secret";
      return "secret";
    });
    jwtService.verifyAsync.mockResolvedValue({
      kind: "ws_ticket",
      sid: "revoked-session",
      sub: "user-a",
      workspaceId: "ws-a",
      jti: "ticket-id-revoked",
      aud: "relay-browser-websocket",
    });
    webSessionRepository.findOne.mockResolvedValue(null);
    const { client, handlers } = makeWsClient();

    gateway.handleConnection(
      client,
      makeRequest("203.0.113.10", "https://app.clawchat.test", "/socket"),
    );
    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "ticket-1" })),
    );
    await flushPromises();

    expect(
      webSessionRepository.findOne.mock.calls[0][0].where.revokedAt,
    ).toEqual(IsNull());
    expect(client.close).toHaveBeenCalledWith(4001, "Invalid token");
    expect(gateway.socketUsers.get(client.socketId)).toBeUndefined();
  });

  it("fails closed before session lookup when ticket replay state is unavailable", async () => {
    const {
      gateway,
      configService,
      jwtService,
      webSessionRepository,
      websocketTickets,
    } = await buildGateway();
    configService.get.mockImplementation((key: string) => {
      if (key === "CORS_ORIGINS") return "https://app.clawchat.test";
      if (key === "JWT_WS_SECRET") return "websocket-secret";
      return "secret";
    });
    jwtService.verifyAsync.mockResolvedValue({
      kind: "ws_ticket",
      sid: "session-1",
      sub: "user-a",
      workspaceId: "ws-a",
      jti: "consumed-ticket",
      aud: "relay-browser-websocket",
    });
    websocketTickets.consume.mockRejectedValue(
      new Error("WEBSOCKET_TICKET_REPLAYED_OR_EXPIRED"),
    );
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(
      client,
      makeRequest("203.0.113.10", "https://app.clawchat.test"),
    );

    handlers.get("message")?.(
      Buffer.from(
        JSON.stringify({ type: "authenticate", token: "replayed-ticket" }),
      ),
    );
    await flushPromises();

    expect(webSessionRepository.findOne).not.toHaveBeenCalled();
    expect(client.close).toHaveBeenCalledWith(4001, "Invalid token");
    expect(gateway.socketUsers.get(client.socketId)).toBeUndefined();
  });

  it("preserves no-Origin non-browser websocket connections for explicit authenticate", async () => {
    const { gateway } = await buildGateway();
    const { client, handlers } = makeWsClient();

    gateway.handleConnection(client, makeRequest());

    expect(client.close).not.toHaveBeenCalledWith(1008, expect.any(String));
    expect(client.socketId).toBeDefined();
    expect(handlers.get("message")).toBeDefined();
  });

  it("clears the websocket auth deadline after successful authentication", async () => {
    jest.useFakeTimers();
    const { gateway, configService } = await buildGateway();
    configService.get.mockImplementation((key: string) =>
      key === "WS_AUTH_DEADLINE_MS"
        ? "25"
        : key === "CORS_ORIGINS"
          ? ""
          : "secret",
    );
    const { client } = makeWsClient();

    gateway.handleConnection(client, makeRequest());
    gateway.registerAuthenticatedSocket(
      client.socketId,
      "user-authenticated",
      "web",
      "session-2",
      "ws-a",
    );
    jest.advanceTimersByTime(26);

    expect(client.close).not.toHaveBeenCalled();
  });

  it("closes unauthenticated sockets that send non-auth messages", async () => {
    const { gateway } = await buildGateway();
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(
        JSON.stringify({ type: "subscribe_workspace", workspaceId: "ws-a" }),
      ),
    );
    await flushPromises();

    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "auth_error",
        data: { error: "Authentication required" },
      }),
    );
    expect(client.close).toHaveBeenCalledWith(4000, "Authentication required");
  });

  it("closes sockets that exceed the unauthenticated frame-size limit", async () => {
    const { gateway, configService } = await buildGateway();
    configService.get.mockImplementation((key: string) =>
      key === "WS_MAX_UNAUTHENTICATED_FRAME_BYTES"
        ? "32"
        : key === "CORS_ORIGINS"
          ? ""
          : "secret",
    );
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(Buffer.alloc(33));
    await flushPromises();

    expect(client.close).toHaveBeenCalledWith(1009, "Frame too large");
  });

  it("closes authenticated sockets that exceed the per-socket message rate", async () => {
    const { gateway, configService } = await buildGateway();
    configService.get.mockImplementation((key: string) => {
      if (key === "WS_SOCKET_MESSAGE_LIMIT") return "1";
      if (key === "WS_IP_MESSAGE_LIMIT") return "100";
      if (key === "WS_RATE_WINDOW_MS") return "60000";
      return key === "CORS_ORIGINS" ? "" : "secret";
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());
    gateway.registerAuthenticatedSocket(
      client.socketId,
      "user-authenticated",
      "web",
      "session-2",
      "ws-a",
    );

    const frame = Buffer.from(JSON.stringify({ type: "unknown" }));
    handlers.get("message")?.(frame);
    handlers.get("message")?.(frame);
    await flushPromises();

    expect(client.close).toHaveBeenCalledWith(4008, "Rate limit exceeded");
  });

  it("closes sockets that exceed the per-IP websocket message rate", async () => {
    const { gateway, configService } = await buildGateway();
    configService.get.mockImplementation((key: string) => {
      if (key === "WS_SOCKET_MESSAGE_LIMIT") return "100";
      if (key === "WS_IP_MESSAGE_LIMIT") return "1";
      if (key === "WS_RATE_WINDOW_MS") return "60000";
      return key === "CORS_ORIGINS" ? "" : "secret";
    });
    const first = makeWsClient();
    const second = makeWsClient();
    gateway.handleConnection(first.client, makeRequest("203.0.113.77"));
    gateway.handleConnection(second.client, makeRequest("203.0.113.77"));
    gateway.registerAuthenticatedSocket(
      first.client.socketId,
      "user-a",
      "web",
      "session-a",
      "ws-a",
    );
    gateway.registerAuthenticatedSocket(
      second.client.socketId,
      "user-b",
      "web",
      "session-b",
      "ws-b",
    );

    const frame = Buffer.from(JSON.stringify({ type: "unknown" }));
    first.handlers.get("message")?.(frame);
    second.handlers.get("message")?.(frame);
    await flushPromises();

    expect(second.client.close).toHaveBeenCalledWith(
      4008,
      "Rate limit exceeded",
    );
  });

  it("uses Railway trusted client IP for websocket message throttling", async () => {
    const { gateway, configService } = await buildGateway();
    configService.get.mockImplementation((key: string) => {
      if (key === "WS_SOCKET_MESSAGE_LIMIT") return "100";
      if (key === "WS_IP_MESSAGE_LIMIT") return "1";
      if (key === "WS_RATE_WINDOW_MS") return "60000";
      return key === "CORS_ORIGINS" ? "" : "secret";
    });
    const first = makeWsClient();
    const second = makeWsClient();
    gateway.handleConnection(
      first.client,
      makeRequest("10.0.0.11", undefined, "/socket", undefined, {
        "x-real-ip": "203.0.113.88",
        "x-forwarded-for": "198.51.100.250",
      }),
    );
    gateway.handleConnection(
      second.client,
      makeRequest("10.0.0.12", undefined, "/socket", undefined, {
        "x-real-ip": "203.0.113.88",
        "x-forwarded-for": "198.51.100.251",
      }),
    );
    gateway.registerAuthenticatedSocket(
      first.client.socketId,
      "user-a",
      "web",
      "session-a",
      "ws-a",
    );
    gateway.registerAuthenticatedSocket(
      second.client.socketId,
      "user-b",
      "web",
      "session-b",
      "ws-b",
    );

    const frame = Buffer.from(JSON.stringify({ type: "unknown" }));
    first.handlers.get("message")?.(frame);
    second.handlers.get("message")?.(frame);
    await flushPromises();

    expect(gateway.socketRateLimitTrackers.get(first.client.socketId)).toBe(
      "203.0.113.88",
    );
    expect(gateway.socketRateLimitTrackers.get(second.client.socketId)).toBe(
      "203.0.113.88",
    );
    expect(second.client.close).toHaveBeenCalledWith(
      4008,
      "Rate limit exceeded",
    );
  });

  it("logs websocket rate-limit telemetry without raw client IPs", async () => {
    const { gateway, configService } = await buildGateway();
    const warnSpy = jest
      .spyOn(gateway.logger, "warn")
      .mockImplementation(() => undefined);
    configService.get.mockImplementation((key: string) => {
      if (key === "WS_SOCKET_MESSAGE_LIMIT") return "1";
      if (key === "WS_IP_MESSAGE_LIMIT") return "100";
      if (key === "WS_RATE_WINDOW_MS") return "60000";
      return key === "CORS_ORIGINS" ? "" : "secret";
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(
      client,
      makeRequest("10.0.0.11", undefined, "/socket", undefined, {
        "x-real-ip": "203.0.113.89",
      }),
    );
    gateway.registerAuthenticatedSocket(
      client.socketId,
      "user-a",
      "web",
      "session-a",
      "ws-a",
    );

    const frame = Buffer.from(JSON.stringify({ type: "unknown" }));
    handlers.get("message")?.(frame);
    handlers.get("message")?.(frame);
    await flushPromises();

    const payload = JSON.parse(
      warnSpy.mock.calls.find((call) =>
        String(call[0]).includes("websocket.rate_limit.exceeded"),
      )?.[0] as string,
    );
    expect(payload).toEqual(
      expect.objectContaining({
        event: "websocket.rate_limit.exceeded",
        socketId: client.socketId,
        kind: "web",
        authenticated: true,
        workspaceId: "ws-a",
        trackerHash: expect.any(String),
        socketLimited: true,
        trackerLimited: false,
        socketLimit: 1,
        trackerLimit: 100,
      }),
    );
    expect(JSON.stringify(payload)).not.toContain("203.0.113.89");
  });

  it("logs websocket disconnect telemetry and clears socket tracking", async () => {
    const { gateway } = await buildGateway();
    const logSpy = jest
      .spyOn(gateway.logger, "log")
      .mockImplementation(() => undefined);
    const { client } = makeWsClient();
    gateway.handleConnection(
      client,
      makeRequest("10.0.0.11", undefined, "/socket", undefined, {
        "x-real-ip": "203.0.113.90",
      }),
    );
    gateway.registerAuthenticatedSocket(
      client.socketId,
      "user-a",
      "web",
      "session-a",
      "ws-a",
    );
    logSpy.mockClear();

    gateway.handleDisconnect(client);

    const payload = JSON.parse(
      logSpy.mock.calls.find((call) =>
        String(call[0]).includes("websocket.client.disconnected"),
      )?.[0] as string,
    );
    expect(payload).toEqual(
      expect.objectContaining({
        event: "websocket.client.disconnected",
        socketId: client.socketId,
        kind: "web",
        authenticated: true,
        workspaceId: "ws-a",
        trackerHash: expect.any(String),
      }),
    );
    expect(JSON.stringify(payload)).not.toContain("203.0.113.90");
    expect(gateway.socketRateLimitTrackers.has(client.socketId)).toBe(false);
  });

  it("rejects browser-origin legacy user token websocket authentication", async () => {
    const { gateway, configService, jwtService } = await buildGateway();
    configService.get.mockImplementation((key: string) => {
      if (key === "CORS_ORIGINS") return "https://app.clawchat.test";
      if (key === "JWT_SECRET" || key === "JWT_WS_SECRET") return "secret";
      return "secret";
    });
    jwtService.verify.mockReturnValue({
      sub: "user-a",
      email: "alex@clawchat.io",
      kind: "mobile",
      sid: "mobile-session-1",
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(
      client,
      makeRequest("203.0.113.10", "https://app.clawchat.test"),
    );

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "jwt" })),
    );
    await flushPromises();

    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "auth_error",
        data: { error: "Invalid token" },
      }),
    );
    expect(client.close).toHaveBeenCalledWith(4001, "Invalid token");
    expect(gateway.socketUsers.get(client.socketId)).toBeUndefined();
  });

  it("enforces the websocket token kind and signing-secret matrix", async () => {
    const { gateway, configService, jwtService } = await buildGateway();
    configService.get.mockImplementation((key: string) => {
      if (key === "JWT_SECRET") return "mobile-secret";
      if (key === "JWT_WS_SECRET") return "websocket-secret";
      return "";
    });

    const signedTokens: Record<
      string,
      { secret: string; payload: Record<string, unknown> }
    > = {
      mobile: {
        secret: "mobile-secret",
        payload: {
          sub: "user-a",
          kind: "mobile",
          sid: "mobile-session-a",
          aud: "relay-mobile-api",
        },
      },
      web: {
        secret: "mobile-secret",
        payload: {
          sub: "user-a",
          kind: "web",
          sid: "web-session-a",
        },
      },
      "bridge-access": {
        secret: "mobile-secret",
        payload: {
          sub: "bridge-a",
          did: "bridge-a",
          dpid: "bridge-public-a",
          workspaceId: "workspace-a",
          kind: "bridge_device",
          role: "bridge_device",
          tokenUse: "bridge_access",
          jti: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          cv: 1,
        },
      },
      bridge: {
        secret: "websocket-secret",
        payload: {
          sub: "bridge-a",
          did: "bridge-a",
          dpid: "bridge-public-a",
          workspaceId: "workspace-a",
          kind: "bridge_device",
          role: "bridge_device",
          tokenUse: "bridge_websocket",
          aud: "relay-bridge-websocket",
          jti: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          cv: 1,
        },
      },
      ticket: {
        secret: "websocket-secret",
        payload: {
          sub: "user-a",
          kind: "ws_ticket",
          sid: "web-session-a",
          workspaceId: "workspace-a",
        },
      },
      "mobile-with-ws-key": {
        secret: "websocket-secret",
        payload: {
          sub: "user-a",
          kind: "mobile",
          sid: "mobile-session-a",
        },
      },
      unknown: {
        secret: "mobile-secret",
        payload: {
          sub: "user-a",
          kind: "unknown",
          sid: "mobile-session-a",
        },
      },
    };
    jwtService.verify.mockImplementation(
      (token: string, options: { secret: string }) => {
        const signed = signedTokens[token];
        if (!signed || signed.secret !== options.secret) {
          throw new Error("invalid signature");
        }
        return signed.payload;
      },
    );

    expect(gateway.realtimeAuthPolicy.verifyFrame("mobile")).toEqual({
      family: "mobile",
      payload: signedTokens.mobile.payload,
    });
    expect(gateway.realtimeAuthPolicy.verifyFrame("bridge")).toEqual({
      family: "bridge",
      payload: signedTokens.bridge.payload,
    });

    for (const rejectedToken of [
      "web",
      "bridge-access",
      "ticket",
      "mobile-with-ws-key",
      "unknown",
    ]) {
      expect(() =>
        gateway.realtimeAuthPolicy.verifyFrame(rejectedToken),
      ).toThrow("Invalid realtime authentication token");
    }

    expect(jwtService.verify).toHaveBeenCalledWith("bridge", {
      secret: "websocket-secret",
      issuer: "https://api.relayconsole.work/api/v1",
      audience: "relay-bridge-websocket",
      algorithms: ["HS256"],
    });
    expect(jwtService.verify).toHaveBeenCalledWith("mobile", {
      secret: "mobile-secret",
      issuer: "https://api.relayconsole.work/api/v1",
      audience: "relay-mobile-api",
      algorithms: ["HS256"],
    });
  });

  it("rejects multi-audience JWTs at mobile, bridge, and browser realtime boundaries", async () => {
    const { gateway, jwtService, websocketTickets } = await buildGateway();

    jwtService.verify.mockReturnValue({
      sub: "user-a",
      kind: "mobile",
      sid: "mobile-session-a",
      aud: ["relay-mobile-api"],
    });
    expect(() =>
      gateway.realtimeAuthPolicy.verifyFrame("mobile-array-audience"),
    ).toThrow("Invalid realtime authentication token");

    jwtService.verify.mockReturnValue({
      sub: "bridge-a",
      did: "bridge-a",
      dpid: "bridge-public-a",
      workspaceId: "workspace-a",
      kind: "bridge_device",
      role: "bridge_device",
      tokenUse: "bridge_websocket",
      jti: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cv: 1,
      aud: ["relay-bridge-websocket"],
    });
    expect(() =>
      gateway.realtimeAuthPolicy.verifyFrame("bridge-array-audience"),
    ).toThrow("Invalid realtime authentication token");

    jwtService.verifyAsync.mockResolvedValue({
      kind: "ws_ticket",
      sid: "web-session-a",
      sub: "user-a",
      workspaceId: "workspace-a",
      jti: "ticket-array-audience",
      aud: ["relay-browser-websocket"],
    });
    await expect(
      gateway.authenticateWithTicket("missing-socket", "ticket-array-audience"),
    ).rejects.toThrow("Invalid ticket payload");
    expect(websocketTickets.consume).not.toHaveBeenCalled();
  });

  it("requires active session identity in mobile websocket tokens", async () => {
    const { gateway, jwtService, mobileSessionRepository } =
      await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "user-a",
      kind: "mobile",
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "jwt" })),
    );
    await flushPromises();

    expect(mobileSessionRepository.findOne).not.toHaveBeenCalled();
    expect(client.close).toHaveBeenCalledWith(4001, "Invalid token");
    expect(gateway.socketUsers.get(client.socketId)).toBeUndefined();
  });

  it("preserves bridge-device websocket authentication through authenticate", async () => {
    const {
      gateway,
      jwtService,
      bridgeDeviceRepository,
      cloudCommercialService,
    } = await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "bridge-device-1",
      did: "bridge-device-1",
      dpid: "bridge-public-1",
      workspaceId: "ws-a",
      kind: "bridge_device",
      role: "bridge_device",
      tokenUse: "bridge_websocket",
      aud: "relay-bridge-websocket",
      jti: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cv: 1,
    });
    bridgeDeviceRepository.findOne.mockResolvedValue({
      id: "bridge-device-1",
      devicePublicId: "bridge-public-1",
      workspaceId: "ws-a",
      status: BridgeDeviceStatus.ACTIVE,
      revokedAt: null,
      capabilities: ["clawchat.runtime.hermes"],
      credentialVersion: 1,
      runtimeType: "hermes",
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "jwt" })),
    );
    await flushPromises();

    expect(cloudCommercialService.entitlementPayload).toHaveBeenCalledWith(
      "ws-a",
    );
    expect(gateway.socketKinds.get(client.socketId)).toBe("bridge");
    expect(gateway.socketScopedWorkspaces.get(client.socketId)).toBe("ws-a");
    expect(gateway.socketBridgeRuntimeTypes.get(client.socketId)).toBe(
      "hermes",
    );
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "authenticated",
        data: {
          userId: "bridge-device-1",
          kind: "bridge",
          workspaceId: "ws-a",
        },
      }),
    );
    expect(client.close).not.toHaveBeenCalledWith(4001, "Invalid token");
  });

  it("rejects bridge websocket authentication without a supported persisted runtime identity", async () => {
    const { gateway, jwtService, bridgeDeviceRepository } =
      await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "bridge-device-1",
      did: "bridge-device-1",
      dpid: "bridge-public-1",
      workspaceId: "ws-a",
      kind: "bridge_device",
      role: "bridge_device",
      tokenUse: "bridge_websocket",
      aud: "relay-bridge-websocket",
      jti: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cv: 1,
    });
    bridgeDeviceRepository.findOne.mockResolvedValue({
      id: "bridge-device-1",
      devicePublicId: "bridge-public-1",
      workspaceId: "ws-a",
      status: BridgeDeviceStatus.ACTIVE,
      revokedAt: null,
      capabilities: [],
      credentialVersion: 1,
      runtimeType: "legacy-runtime",
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "jwt" })),
    );
    await flushPromises();

    expect(client.close).toHaveBeenCalledWith(4001, "Invalid token");
    expect(gateway.socketKinds.get(client.socketId)).toBeUndefined();
    expect(
      gateway.socketBridgeRuntimeTypes.get(client.socketId),
    ).toBeUndefined();
  });

  it("rejects bridge websocket authentication when Relay Cloud is read-only", async () => {
    const {
      gateway,
      jwtService,
      bridgeDeviceRepository,
      cloudCommercialService,
    } = await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "bridge-device-1",
      did: "bridge-device-1",
      dpid: "bridge-public-1",
      workspaceId: "ws-a",
      kind: "bridge_device",
      role: "bridge_device",
      tokenUse: "bridge_websocket",
      aud: "relay-bridge-websocket",
      jti: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cv: 1,
    });
    bridgeDeviceRepository.findOne.mockResolvedValue({
      id: "bridge-device-1",
      devicePublicId: "bridge-public-1",
      workspaceId: "ws-a",
      status: BridgeDeviceStatus.ACTIVE,
      revokedAt: null,
      capabilities: ["clawchat.runtime.hermes"],
      credentialVersion: 1,
      runtimeType: "hermes",
    });
    cloudCommercialService.entitlementPayload.mockResolvedValue({
      status: "subscription_required",
      mode: "read_only",
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "jwt" })),
    );
    await flushPromises();

    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "auth_error",
        data: { error: "Relay subscription required" },
      }),
    );
    expect(client.close).toHaveBeenCalledWith(
      4001,
      "Relay subscription required",
    );
    expect(gateway.socketKinds.get(client.socketId)).toBeUndefined();
  });

  it("closes an already connected bridge when its entitlement becomes read-only", async () => {
    const { gateway, cloudCommercialService } = await buildGateway();
    const client = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
    };
    gateway.clients.set("bridge-socket", client);
    gateway.registerAuthenticatedSocket(
      "bridge-socket",
      "bridge-device-1",
      "bridge",
      undefined,
      "ws-a",
      "bridge-device-1",
      "openclaw",
    );
    cloudCommercialService.entitlementPayload.mockResolvedValue({
      status: "read_only",
      mode: "read_only",
    });

    await gateway.handleMessage("bridge-socket", {
      type: "register_bridge_agent",
      externalAgentId: "agent-1",
    });

    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "auth_error",
        data: { error: "Relay subscription required" },
      }),
    );
    expect(client.close).toHaveBeenCalledWith(
      4003,
      "Relay subscription required",
    );
    expect(gateway.socketBridgeAgents.get("bridge-socket")).toBeUndefined();
  });

  it("filters bridge websocket live capabilities through the server policy", async () => {
    const { gateway, jwtService, bridgeDeviceRepository } =
      await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "bridge-device-1",
      did: "bridge-device-1",
      dpid: "bridge-public-1",
      workspaceId: "ws-a",
      kind: "bridge_device",
      role: "bridge_device",
      tokenUse: "bridge_websocket",
      aud: "relay-bridge-websocket",
      jti: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cv: 1,
    });
    bridgeDeviceRepository.findOne.mockResolvedValue({
      id: "bridge-device-1",
      devicePublicId: "bridge-public-1",
      workspaceId: "ws-a",
      status: BridgeDeviceStatus.ACTIVE,
      revokedAt: null,
      capabilities: ["clawchat.runtime.hermes", "unapproved.stored"],
      credentialVersion: 1,
      runtimeType: "hermes",
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(
        JSON.stringify({
          type: "authenticate",
          token: "jwt",
          capabilities: [
            "clawchat.marketplace.tools",
            "unapproved.live",
            "clawchat.marketplace.tools",
          ],
        }),
      ),
    );
    await flushPromises();

    expect(gateway.socketBridgeCapabilities.get(client.socketId)).toEqual(
      new Set(["clawchat.runtime.hermes", "clawchat.marketplace.tools"]),
    );
  });

  it("rejects a websocket ticket minted before bridge credential rotation", async () => {
    const { gateway, jwtService, bridgeDeviceRepository } =
      await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "bridge-device-1",
      did: "bridge-device-1",
      dpid: "bridge-public-1",
      workspaceId: "ws-a",
      kind: "bridge_device",
      role: "bridge_device",
      tokenUse: "bridge_websocket",
      aud: "relay-bridge-websocket",
      jti: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cv: 1,
    });
    bridgeDeviceRepository.findOne.mockResolvedValue({
      id: "bridge-device-1",
      devicePublicId: "bridge-public-1",
      workspaceId: "ws-a",
      status: BridgeDeviceStatus.ACTIVE,
      revokedAt: null,
      capabilities: [],
      credentialVersion: 2,
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "old-jwt" })),
    );
    await flushPromises();

    expect(client.close).toHaveBeenCalledWith(4001, "Invalid token");
    expect(gateway.socketKinds.get(client.socketId)).toBeUndefined();
  });

  it("rejects bridge websocket tokens whose stored device scope differs", async () => {
    const { gateway, jwtService, bridgeDeviceRepository } =
      await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "bridge-device-1",
      did: "bridge-device-1",
      dpid: "bridge-public-1",
      workspaceId: "ws-attacker",
      kind: "bridge_device",
      role: "bridge_device",
      tokenUse: "bridge_websocket",
      aud: "relay-bridge-websocket",
      jti: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cv: 1,
    });
    bridgeDeviceRepository.findOne.mockResolvedValue({
      id: "bridge-device-1",
      devicePublicId: "bridge-public-1",
      workspaceId: "ws-a",
      status: BridgeDeviceStatus.ACTIVE,
      revokedAt: null,
      capabilities: [],
      credentialVersion: 1,
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "jwt" })),
    );
    await flushPromises();

    expect(client.close).toHaveBeenCalledWith(4001, "Invalid token");
    expect(gateway.socketKinds.get(client.socketId)).toBeUndefined();
  });

  it("verifies bridge device registration against the exact runtime family", async () => {
    const { gateway } = await buildGateway();
    gateway.registerAuthenticatedSocket(
      "openclaw-socket",
      "openclaw-device",
      "bridge",
      undefined,
      "ws-a",
      "openclaw-device",
      "openclaw",
    );
    gateway.registerAuthenticatedSocket(
      "hermes-socket",
      "hermes-device",
      "bridge",
      undefined,
      "ws-a",
      "hermes-device",
      "hermes",
    );
    gateway.socketBridgeAgents.set(
      "openclaw-socket",
      new Set(["openclaw_external"]),
    );
    gateway.socketHermesBridgeAgents.set(
      "hermes-socket",
      new Set(["hermes_external"]),
    );
    gateway.socketBridgeCapabilities.set(
      "hermes-socket",
      new Set(["clawchat.runtime.hermes"]),
    );

    expect(
      gateway.isBridgeDeviceRegisteredForExternalAgent({
        workspaceId: "ws-a",
        bridgeDeviceId: "openclaw-device",
        externalAgentId: "openclaw_external",
        runtimeType: "openclaw",
      }),
    ).toBe(true);
    expect(
      gateway.isBridgeDeviceRegisteredForExternalAgent({
        workspaceId: "ws-a",
        bridgeDeviceId: "hermes-device",
        externalAgentId: "hermes_external",
        runtimeType: "hermes",
      }),
    ).toBe(true);
    expect(
      gateway.isBridgeDeviceRegisteredForExternalAgent({
        workspaceId: "ws-a",
        bridgeDeviceId: "other-device",
        externalAgentId: "openclaw_external",
        runtimeType: "openclaw",
      }),
    ).toBe(false);
    expect(
      gateway.isBridgeDeviceRegisteredForExternalAgent({
        workspaceId: "ws-b",
        bridgeDeviceId: "openclaw-device",
        externalAgentId: "openclaw_external",
        runtimeType: "openclaw",
      }),
    ).toBe(false);
    expect(
      gateway.isBridgeDeviceRegisteredForExternalAgent({
        workspaceId: "ws-a",
        bridgeDeviceId: "hermes-device",
        externalAgentId: "hermes_external",
        runtimeType: "openclaw",
      }),
    ).toBe(false);
    expect(gateway.getBridgeDeviceRuntimeType("ws-a", "openclaw-device")).toBe(
      "openclaw",
    );
    expect(gateway.getBridgeDeviceRuntimeType("ws-b", "openclaw-device")).toBe(
      null,
    );
  });

  it("rejects browser access tokens on the explicit authentication frame", async () => {
    const { gateway, jwtService, webSessionRepository } = await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "user-a",
      email: "alex@clawchat.io",
      kind: "web",
      sid: "revoked-web-session",
    });
    webSessionRepository.findOne.mockResolvedValue(null);
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "jwt" })),
    );
    await flushPromises();

    expect(webSessionRepository.findOne).not.toHaveBeenCalled();
    expect(client.close).toHaveBeenCalledWith(4001, "Invalid token");
    expect(gateway.socketUsers.get(client.socketId)).toBeUndefined();
  });

  it("rejects replayed websocket auth with a revoked mobile session token", async () => {
    const { gateway, jwtService, mobileSessionRepository } =
      await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "user-a",
      email: "alex@clawchat.io",
      kind: "mobile",
      sid: "revoked-mobile-session",
      aud: "relay-mobile-api",
    });
    mobileSessionRepository.findOne.mockResolvedValue(null);
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "jwt" })),
    );
    await flushPromises();

    expect(mobileSessionRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: "revoked-mobile-session",
        userId: "user-a",
        revokedAt: expect.anything(),
      },
      select: ["id"],
    });
    expect(client.close).toHaveBeenCalledWith(4001, "Invalid token");
    expect(gateway.socketUsers.get(client.socketId)).toBeUndefined();
  });

  it("binds an active mobile session to its socket and disconnects it on revocation", async () => {
    const { gateway, jwtService, mobileSessionRepository } =
      await buildGateway();
    jwtService.verify.mockReturnValue({
      sub: "user-a",
      email: "alex@clawchat.io",
      kind: "mobile",
      sid: "active-mobile-session",
      aud: "relay-mobile-api",
    });
    mobileSessionRepository.findOne.mockResolvedValue({
      id: "active-mobile-session",
    });
    const { client, handlers } = makeWsClient();
    gateway.handleConnection(client, makeRequest());

    handlers.get("message")?.(
      Buffer.from(JSON.stringify({ type: "authenticate", token: "jwt" })),
    );
    await flushPromises();

    expect(gateway.socketUsers.get(client.socketId)).toBe("user-a");
    expect(gateway.socketKinds.get(client.socketId)).toBe("mobile");
    expect(gateway.socketSessionIds.get(client.socketId)).toBe(
      "active-mobile-session",
    );
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "authenticated",
        data: { userId: "user-a", kind: "mobile" },
      }),
    );

    gateway.disconnectMobileSession(
      "user-a",
      "active-mobile-session",
      "manual_revoke",
    );
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "session.revoked",
        data: { reason: "manual_revoke" },
      }),
    );
    expect(client.close).toHaveBeenCalledWith(4002, "Session revoked");
  });

  it("disconnects only the established socket for a revoked bridge device", async () => {
    const { gateway } = await buildGateway();
    const revokedBridge = makeWsClient().client;
    const otherBridge = makeWsClient().client;
    gateway.clients.set("revoked-bridge-socket", revokedBridge);
    gateway.clients.set("other-bridge-socket", otherBridge);
    gateway.registerAuthenticatedSocket(
      "revoked-bridge-socket",
      "bridge-device-revoked",
      "bridge",
      undefined,
      "ws-a",
      "bridge-device-revoked",
      "openclaw",
    );
    gateway.registerAuthenticatedSocket(
      "other-bridge-socket",
      "bridge-device-other",
      "bridge",
      undefined,
      "ws-a",
      "bridge-device-other",
      "openclaw",
    );

    gateway.disconnectBridgeDevice("bridge-device-revoked");

    expect(revokedBridge.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "session.revoked",
        data: { reason: "bridge_device_revoked" },
      }),
    );
    expect(revokedBridge.close).toHaveBeenCalledWith(
      4003,
      "Bridge device revoked",
    );
    expect(otherBridge.send).not.toHaveBeenCalled();
    expect(otherBridge.close).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace websocket subscriptions", async () => {
    const { gateway, auditLogService } = await buildGateway();

    await gateway.handleSubscribeWorkspace("socket-1", "ws-b");

    expect(gateway.workspaceSubscriptions.get("ws-b")).toBeUndefined();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "security.cross_workspace_access.denied",
        resourceType: "workspace",
      }),
    );
  });

  it("rejects cross-thread websocket subscriptions outside the authenticated workspace", async () => {
    const { gateway, auditLogService } = await buildGateway();

    await gateway.handleSubscribeThread("socket-1", "thread-b");

    expect(gateway.threadSubscriptions.get("thread-b")).toBeUndefined();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "security.cross_workspace_access.denied",
        resourceType: "thread",
      }),
    );
  });

  it("rejects websocket tickets scoped to a workspace the web session cannot access", async () => {
    const {
      gateway,
      jwtService,
      webSessionRepository,
      workspaceMembershipService,
    } = await buildGateway();
    gateway.clients.set("socket-ticket", {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    });
    jwtService.verifyAsync.mockResolvedValue({
      kind: "ws_ticket",
      sid: "session-1",
      sub: "user-a",
      workspaceId: "ws-b",
      jti: "ticket-id-workspace-b",
      aud: "relay-browser-websocket",
    });
    webSessionRepository.findOne.mockResolvedValue({
      id: "session-1",
      userId: "user-a",
    });
    workspaceMembershipService.ensureWorkspaceAccess.mockRejectedValue(
      new ForbiddenException("You do not have access to this workspace"),
    );

    await expect(
      gateway.authenticateWithTicket("socket-ticket", "ticket"),
    ).rejects.toThrow(ForbiddenException);
    expect(
      webSessionRepository.findOne.mock.calls[0][0].where.revokedAt,
    ).toEqual(IsNull());
    expect(gateway.socketUsers.get("socket-ticket")).toBeUndefined();
    expect(gateway.socketScopedWorkspaces.get("socket-ticket")).toBeUndefined();
  });

  it("fails closed instead of verifying a websocket ticket with the main JWT secret", async () => {
    const { gateway, configService, jwtService } = await buildGateway();
    configService.get.mockImplementation((key: string) =>
      key === "JWT_SECRET" ? "main-jwt-secret" : "",
    );

    await expect(
      gateway.authenticateWithTicket("socket-ticket", "ticket"),
    ).rejects.toThrow("JWT_WS_SECRET_MISSING");
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it("rejects browser websocket bridge-control subscriptions", async () => {
    const { gateway, auditLogService } = await buildGateway();

    await gateway.handleSubscribeBridgeControl("socket-1", "ws-a");

    expect(gateway.bridgeControlSubscriptions.get("ws-a")).toBeUndefined();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "security.cross_workspace_access.denied",
        resourceType: "bridge_control",
      }),
    );
  });

  it("rejects bridge-control subscriptions outside the bridge device workspace", async () => {
    const { gateway, auditLogService } = await buildGateway();
    gateway.clients.set("bridge-socket", {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    });
    gateway.registerAuthenticatedSocket(
      "bridge-socket",
      "bridge-device-1",
      "bridge",
      undefined,
      "ws-a",
      "bridge-device-1",
      "openclaw",
    );

    await gateway.handleSubscribeBridgeControl("bridge-socket", "ws-b");

    expect(gateway.bridgeControlSubscriptions.get("ws-b")).toBeUndefined();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "security.cross_workspace_access.denied",
        resourceType: "bridge_control",
        resourceId: "ws-b",
      }),
    );
  });

  it("tracks structured-prompt-capable bridge control subscribers separately", async () => {
    const { gateway } = await buildGateway();

    gateway.bridgeControlSubscriptions.set("ws-a", new Set(["socket-1"]));
    gateway.socketBridgeRuntimeTypes.set("socket-1", "openclaw");
    gateway.socketBridgeCapabilities.set(
      "socket-1",
      new Set([EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY]),
    );

    expect(gateway.hasBridgeControlSubscribers("ws-a")).toBe(true);
    expect(
      gateway.hasBridgeControlSubscribers(
        "ws-a",
        EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY,
      ),
    ).toBe(true);
    expect(
      gateway.hasBridgeControlSubscribers("ws-a", "unsupported.capability"),
    ).toBe(false);
  });

  it("registers Hermes bridge agents as Hermes runtime bindings", async () => {
    const { gateway, agentRepository } = await buildGateway();
    const bridgeSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    };
    gateway.clients.set("bridge-socket", bridgeSocket);
    gateway.registerAuthenticatedSocket(
      "bridge-socket",
      "bridge-device-1",
      "bridge",
      undefined,
      "ws-a",
      "bridge-device-1",
      "hermes",
    );
    gateway.socketBridgeCapabilities.set(
      "bridge-socket",
      new Set(["clawchat.runtime.hermes", "clawchat.marketplace.tools"]),
    );
    agentRepository.findOne.mockResolvedValue({ id: "agent-hermes" });
    gateway.runtimeBindingService = {
      findByAgentId: jest.fn().mockResolvedValue({
        configMetadata: {
          sendRecentMessagesToHermesBridge: true,
        },
      }),
      upsertByAgentId: jest.fn().mockResolvedValue(undefined),
    };

    await gateway.handleSubscribeBridgeControl("bridge-socket", "ws-a");
    await gateway.handleMessage("bridge-socket", {
      type: "register_hermes_agent",
      externalAgentId: "social_hermes",
    });

    expect(agentRepository.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-a",
        externalId: "social_hermes",
        source: "hermes",
      },
      select: ["id"],
    });
    expect(gateway.runtimeBindingService.upsertByAgentId).toHaveBeenCalledWith(
      "agent-hermes",
      expect.objectContaining({
        workspaceId: "ws-a",
        runtimeType: "hermes",
        adapterKind: "hermes_bridge",
        routingMode: "default_target",
        healthStatus: "ready",
        capabilities: expect.objectContaining({
          bridgeBacked: true,
          requiresExternalRuntimePresence: true,
          "clawchat.runtime.hermes": true,
          "clawchat.marketplace.tools": true,
        }),
        configMetadata: {
          sendRecentMessagesToHermesBridge: true,
          compatibilitySource: "hermes_bridge_registration",
          bridgeDeviceId: "bridge-device-1",
        },
      }),
    );
    expect(gateway.getWorkspaceHermesBridgeRuntime("ws-a")).toEqual({
      connectedBridgeDeviceCount: 1,
      liveRegisteredAgentCount: 1,
      liveRegisteredExternalAgentIds: ["social_hermes"],
    });
    expect(bridgeSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "subscribed_bridge_control",
        data: { workspaceId: "ws-a" },
      }),
    );
    expect(bridgeSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "bridge_agent_registration",
        data: {
          accepted: true,
          externalAgentId: "social_hermes",
          runtimeType: "hermes",
        },
      }),
    );
  });

  it("registers Claude agents without rewriting their runtime binding", async () => {
    const { gateway, agentRepository } = await buildGateway();
    gateway.registerAuthenticatedSocket(
      "claude-socket",
      "claude-device",
      "bridge",
      undefined,
      "ws-a",
      "claude-device",
      "claude_code",
    );
    agentRepository.findOne.mockResolvedValue({ id: "agent-claude" });
    gateway.runtimeBindingService = {
      upsertByAgentId: jest.fn().mockResolvedValue(undefined),
    };

    await gateway.handleRegisterBridgeAgent("claude-socket", "claude_external");

    expect(agentRepository.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-a",
        externalId: "claude_external",
        source: "claude_code",
      },
      select: ["id"],
    });
    expect(
      gateway.runtimeBindingService.upsertByAgentId,
    ).not.toHaveBeenCalled();
    expect(
      gateway.getWorkspaceBridgeRuntime("ws-a", "claude_code")
        .liveRegisteredExternalAgentIds,
    ).toEqual(["claude_external"]);
    expect(
      gateway.getWorkspaceBridgeRuntime("ws-a", "openclaw")
        .liveRegisteredExternalAgentIds,
    ).toEqual([]);
  });

  it("rejects a bridge agent registration from a different runtime family", async () => {
    const { gateway, agentRepository, auditLogService } = await buildGateway();
    const bridgeSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    };
    gateway.clients.set("claude-socket", bridgeSocket);
    gateway.registerAuthenticatedSocket(
      "claude-socket",
      "claude-device",
      "bridge",
      undefined,
      "ws-a",
      "claude-device",
      "claude_code",
    );
    agentRepository.findOne.mockResolvedValue(null);
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    (agentRepository as any).createQueryBuilder = jest
      .fn()
      .mockReturnValue(queryBuilder);

    await gateway.handleMessage("claude-socket", {
      type: "register_bridge_agent",
      externalAgentId: "openclaw_external",
    });

    expect(agentRepository.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-a",
        externalId: "openclaw_external",
        source: "claude_code",
      },
      select: ["id"],
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "agent.source = :runtimeType",
      { runtimeType: "claude_code" },
    );
    expect(gateway.socketBridgeAgents.get("claude-socket")).toBeUndefined();
    expect(bridgeSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "bridge_agent_registration",
        data: {
          accepted: false,
          externalAgentId: "openclaw_external",
          runtimeType: "claude_code",
        },
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "bridge_agent" }),
    );
  });

  it("isolates bridge dispatch and control delivery by runtime family", async () => {
    const { gateway } = await buildGateway();
    const openClawSend = jest.fn();
    const claudeSend = jest.fn();
    gateway.clients.set("openclaw-socket", {
      readyState: WebSocket.OPEN,
      send: openClawSend,
    });
    gateway.clients.set("claude-socket", {
      readyState: WebSocket.OPEN,
      send: claudeSend,
    });
    gateway.registerAuthenticatedSocket(
      "openclaw-socket",
      "openclaw-device",
      "bridge",
      undefined,
      "ws-a",
      "openclaw-device",
      "openclaw",
    );
    gateway.registerAuthenticatedSocket(
      "claude-socket",
      "claude-device",
      "bridge",
      undefined,
      "ws-a",
      "claude-device",
      "claude_code",
    );
    const key = gateway.buildBridgeAgentKey("ws-a", "shared_external");
    gateway.bridgeAgentSubscriptions.set(
      key,
      new Set(["openclaw-socket", "claude-socket"]),
    );
    gateway.bridgeControlSubscriptions.set(
      "ws-a",
      new Set(["openclaw-socket", "claude-socket"]),
    );
    gateway.socketBridgeCapabilities.set(
      "openclaw-socket",
      new Set([EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY]),
    );
    gateway.socketBridgeCapabilities.set(
      "claude-socket",
      new Set([EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY]),
    );

    gateway.emitToBridgeAgents(
      "ws-a",
      ["shared_external"],
      "agent.dispatch",
      { secret: "claude-only" },
      "claude_code",
    );
    gateway.emitToBridgeControls(
      "ws-a",
      "claude.cli.structured_prompt",
      { prompt: "private" },
      EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY,
      null,
      "claude_code",
    );

    expect(claudeSend).toHaveBeenCalledTimes(2);
    expect(openClawSend).not.toHaveBeenCalled();
  });

  it("scopes OpenClaw bridge dispatch subscriptions by workspace", async () => {
    const { gateway, agentRepository } = await buildGateway();
    const sendA = jest.fn();
    const sendB = jest.fn();
    gateway.clients.set("bridge-a", {
      readyState: WebSocket.OPEN,
      send: sendA,
    });
    gateway.clients.set("bridge-b", {
      readyState: WebSocket.OPEN,
      send: sendB,
    });
    gateway.registerAuthenticatedSocket(
      "bridge-a",
      "bridge-device-a",
      "bridge",
      undefined,
      "ws-a",
      "bridge-device-a",
      "openclaw",
    );
    gateway.registerAuthenticatedSocket(
      "bridge-b",
      "bridge-device-b",
      "bridge",
      undefined,
      "ws-b",
      "bridge-device-b",
      "openclaw",
    );
    agentRepository.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: `agent-${where.workspaceId}` }),
    );
    gateway.runtimeBindingService = {
      upsertByAgentId: jest.fn().mockResolvedValue(undefined),
    };

    await gateway.handleRegisterBridgeAgent("bridge-a", "shared_external_id");
    await gateway.handleRegisterBridgeAgent("bridge-b", "shared_external_id");

    gateway.emitToBridgeAgents(
      "ws-a",
      ["shared_external_id"],
      "agent.dispatch",
      {
        threadId: "thread-a",
        workspaceId: "ws-a",
        content: "hello workspace a",
      },
    );

    expect(sendA).toHaveBeenCalledWith(
      JSON.stringify({
        type: "agent.dispatch",
        data: {
          threadId: "thread-a",
          workspaceId: "ws-a",
          content: "hello workspace a",
          externalAgentId: "shared_external_id",
        },
      }),
    );
    expect(sendB).not.toHaveBeenCalled();
  });

  it("replays active runtime dispatches when a thread is subscribed", async () => {
    const { gateway, workspaceMembershipService, threadRepository } =
      await buildGateway();

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValueOnce(
      true,
    );
    threadRepository.findOne.mockResolvedValueOnce({
      id: "thread-b",
      workspaceId: "ws-a",
      activeSessionId: "session-active",
    });

    const send = gateway.clients.get("socket-1")?.send as jest.Mock;
    gateway.runtimeDispatchService = {
      findReplayableByThread: jest.fn().mockResolvedValue([
        {
          id: "dispatch-1",
          workspaceId: "ws-a",
          threadId: "thread-b",
          threadSessionId: "session-active",
          messageId: "message-1",
          agentId: "agent-1",
          runtimeBindingId: "binding-1",
          runtimeThreadSessionId: "runtime-session-1",
          status: "started",
          startedAt: new Date("2026-04-23T15:00:00.000Z"),
          completedAt: null,
          updatedAt: new Date("2026-04-23T15:00:00.000Z"),
          resultMetadata: {
            runtimeStreamDraft: {
              version: 1,
              text: "Partial reply",
              latestSeq: 7,
              updatedAt: "2026-04-23T15:00:07.000Z",
              truncated: false,
            },
          },
        },
      ]),
      readRuntimeStreamDraft: jest.fn(
        (metadata) => metadata.runtimeStreamDraft,
      ),
    };
    gateway.runtimeBindingService = {
      findById: jest.fn().mockResolvedValue({
        id: "binding-1",
        runtimeType: "openclaw",
      }),
    };

    await gateway.handleSubscribeThread("socket-1", "thread-b");

    expect(send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "runtime.dispatch.started",
        data: {
          workspaceId: "ws-a",
          threadId: "thread-b",
          threadSessionId: "session-active",
          dispatchId: "dispatch-1",
          messageId: "message-1",
          agentId: "agent-1",
          runtimeType: "openclaw",
          runtimeBindingId: "binding-1",
          runtimeThreadSessionId: "runtime-session-1",
          timestamp: "2026-04-23T15:00:07.000Z",
          draftText: "Partial reply",
          draftSeq: 7,
        },
      }),
    );
  });

  it("replays AgentOps live state snapshots for selected agents", async () => {
    const { gateway, workspaceMembershipService } = await buildGateway();

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValueOnce(
      true,
    );
    gateway.agentOpsService = {
      resolveLiveStateSnapshot: jest.fn().mockResolvedValue({
        workspaceId: "ws-a",
        generatedAt: "2026-05-16T12:00:00.000Z",
        agents: [
          {
            agentId: "agent-1",
            realState: "working",
            confidence: "strong",
            source: "runtime_dispatch",
            reason: "Runtime dispatch is running.",
            updatedAt: "2026-05-16T12:00:00.000Z",
          },
        ],
      }),
    };

    await gateway.handleMessage("socket-1", {
      type: "request_agent_ops_live_state",
      workspaceId: "ws-a",
      agentIds: ["agent-1"],
    });

    const send = gateway.clients.get("socket-1")?.send as jest.Mock;
    expect(send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "agent_ops.live_state.snapshot",
        data: {
          workspaceId: "ws-a",
          generatedAt: "2026-05-16T12:00:00.000Z",
          agents: [
            {
              agentId: "agent-1",
              realState: "working",
              confidence: "strong",
              source: "runtime_dispatch",
              reason: "Runtime dispatch is running.",
              updatedAt: "2026-05-16T12:00:00.000Z",
            },
          ],
        },
      }),
    );
  });
});
