import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { createClient, RedisClientType } from "redis";
import {
  BRIDGE_RUNTIME_TYPES,
  BridgeRuntimeType,
} from "../modules/bridge/bridge-compatibility-policy";

type BridgeControlRequestMessage = {
  originInstanceId: string;
  targetInstanceId: string;
  requestId: string;
  workspaceId: string;
  eventType: string;
  data: Record<string, unknown>;
  capability?: string | null;
  targetBridgeDeviceId?: string | null;
  runtimeType: BridgeRuntimeType;
  timeoutMs: number;
};

type BridgeControlPresenceRequestMessage = {
  originInstanceId: string;
  presenceRequestId: string;
  workspaceId: string;
  capability?: string | null;
  targetBridgeDeviceId?: string | null;
  runtimeType: BridgeRuntimeType;
};

type BridgeControlPresenceResponseMessage = {
  originInstanceId: string;
  presenceRequestId: string;
  instanceId: string;
};

type BridgeControlResponseMessage = {
  originInstanceId: string;
  requestId: string;
  type: string;
  data?: Record<string, unknown> | null;
  workspaceId: string;
  runtimeType: BridgeRuntimeType;
  bridgeDeviceId?: string | null;
};

type PendingPresenceRequest = {
  resolve: (instanceId: string | null) => void;
  timeout: NodeJS.Timeout;
};

type ForwardedRequest = {
  originInstanceId: string;
  timeout: NodeJS.Timeout;
  workspaceId: string;
  runtimeType: BridgeRuntimeType;
  targetBridgeDeviceId?: string | null;
};

const REQUEST_CHANNEL = "clawchat:bridge-control:request";
const RESPONSE_CHANNEL = "clawchat:bridge-control:response";
const PRESENCE_REQUEST_CHANNEL = "clawchat:bridge-control:presence-request";
const PRESENCE_RESPONSE_CHANNEL = "clawchat:bridge-control:presence-response";

@Injectable()
export class BridgeControlBusService implements OnModuleInit, OnModuleDestroy {
  readonly instanceId = randomUUID();

  private readonly logger = new Logger(BridgeControlBusService.name);
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private pendingPresenceRequests = new Map<string, PendingPresenceRequest>();
  private forwardedRequests = new Map<string, ForwardedRequest>();
  private controlRequestHandler:
    | ((message: BridgeControlRequestMessage) => boolean)
    | null = null;
  private presenceHandler:
    | ((
        workspaceId: string,
        capability: string | null | undefined,
        targetBridgeDeviceId: string | null | undefined,
        runtimeType: BridgeRuntimeType,
      ) => boolean)
    | null = null;
  private responseHandler:
    | ((message: {
        type: string;
        data?: Record<string, unknown> | null;
        workspaceId: string;
        runtimeType: BridgeRuntimeType;
        bridgeDeviceId?: string | null;
      }) => void)
    | null = null;
  private lastRedisErrorLogAt = 0;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const options = this.buildRedisOptions();
    if (!options) {
      this.logger.warn(
        "Bridge control Redis bus disabled because Redis is not configured",
      );
      return;
    }

    // Redis is operationally important but must not hold the HTTP server's
    // liveness endpoint closed during an outage. node-redis keeps reconnecting
    // in the background and finishes subscriptions when Redis returns.
    void this.connectAndSubscribe(options);
  }

  private async connectAndSubscribe(
    options: ReturnType<BridgeControlBusService["buildRedisOptions"]>,
  ) {
    if (!options) return;
    try {
      this.publisher = createClient(options);
      this.subscriber = createClient(options);

      this.publisher.on("error", (error) => {
        this.logRedisError("publisher", error);
      });
      this.subscriber.on("error", (error) => {
        this.logRedisError("subscriber", error);
      });

      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      await Promise.all([
        this.subscriber.subscribe(REQUEST_CHANNEL, (raw) =>
          this.handleControlRequest(raw),
        ),
        this.subscriber.subscribe(RESPONSE_CHANNEL, (raw) =>
          this.handleControlResponse(raw),
        ),
        this.subscriber.subscribe(PRESENCE_REQUEST_CHANNEL, (raw) =>
          this.handlePresenceRequest(raw),
        ),
        this.subscriber.subscribe(PRESENCE_RESPONSE_CHANNEL, (raw) =>
          this.handlePresenceResponse(raw),
        ),
      ]);

      this.logger.log(
        `Bridge control Redis bus enabled for instance ${this.instanceId}`,
      );
    } catch (error) {
      this.logger.error(
        `Bridge control Redis bus failed to start: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.disconnectClients();
    }
  }

  async onModuleDestroy() {
    for (const pending of this.pendingPresenceRequests.values()) {
      clearTimeout(pending.timeout);
      pending.resolve(null);
    }
    this.pendingPresenceRequests.clear();

    for (const forwarded of this.forwardedRequests.values()) {
      clearTimeout(forwarded.timeout);
    }
    this.forwardedRequests.clear();

    await this.disconnectClients();
  }

  isEnabled() {
    return Boolean(this.publisher?.isReady && this.subscriber?.isReady);
  }

  registerControlRequestHandler(
    handler: (message: BridgeControlRequestMessage) => boolean,
  ) {
    this.controlRequestHandler = handler;
  }

  registerPresenceHandler(
    handler: (
      workspaceId: string,
      capability: string | null | undefined,
      targetBridgeDeviceId: string | null | undefined,
      runtimeType: BridgeRuntimeType,
    ) => boolean,
  ) {
    this.presenceHandler = handler;
  }

  registerResponseHandler(
    handler: (message: {
      type: string;
      data?: Record<string, unknown> | null;
      workspaceId: string;
      runtimeType: BridgeRuntimeType;
      bridgeDeviceId?: string | null;
    }) => void,
  ) {
    this.responseHandler = handler;
  }

  async resolveRemoteSubscriber(input: {
    workspaceId: string;
    capability?: string | null;
    targetBridgeDeviceId?: string | null;
    runtimeType: BridgeRuntimeType;
    timeoutMs?: number;
  }): Promise<string | null> {
    if (!this.publisher?.isReady) return null;

    const presenceRequestId = randomUUID();
    const timeoutMs = input.timeoutMs ?? 350;

    const pending = new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingPresenceRequests.delete(presenceRequestId);
        resolve(null);
      }, timeoutMs);

      this.pendingPresenceRequests.set(presenceRequestId, {
        resolve,
        timeout,
      });
    });

    await this.publisher.publish(
      PRESENCE_REQUEST_CHANNEL,
      JSON.stringify({
        originInstanceId: this.instanceId,
        presenceRequestId,
        workspaceId: input.workspaceId,
        capability: input.capability ?? null,
        targetBridgeDeviceId: input.targetBridgeDeviceId ?? null,
        runtimeType: input.runtimeType,
      } satisfies BridgeControlPresenceRequestMessage),
    );

    return pending;
  }

  async publishControlRequest(
    input: Omit<BridgeControlRequestMessage, "originInstanceId">,
  ) {
    if (!this.publisher?.isReady) return false;

    await this.publisher.publish(
      REQUEST_CHANNEL,
      JSON.stringify({
        ...input,
        originInstanceId: this.instanceId,
      } satisfies BridgeControlRequestMessage),
    );
    return true;
  }

  async publishBridgeResponseFromMessage(
    message: {
      type: string;
      data?: Record<string, unknown> | null;
    },
    responder: {
      workspaceId: string;
      runtimeType: BridgeRuntimeType;
      bridgeDeviceId?: string | null;
    },
  ) {
    if (!this.publisher?.isReady) return false;

    const requestId =
      typeof message.data?.requestId === "string"
        ? message.data.requestId
        : null;
    if (!requestId) return false;

    const forwarded = this.forwardedRequests.get(requestId);
    if (!forwarded) return false;
    if (
      responder.workspaceId !== forwarded.workspaceId ||
      responder.runtimeType !== forwarded.runtimeType ||
      (forwarded.targetBridgeDeviceId &&
        responder.bridgeDeviceId !== forwarded.targetBridgeDeviceId)
    ) {
      return false;
    }

    clearTimeout(forwarded.timeout);
    this.forwardedRequests.delete(requestId);

    await this.publisher.publish(
      RESPONSE_CHANNEL,
      JSON.stringify({
        originInstanceId: forwarded.originInstanceId,
        requestId,
        type: message.type,
        data: message.data ?? null,
        workspaceId: responder.workspaceId,
        runtimeType: responder.runtimeType,
        bridgeDeviceId: responder.bridgeDeviceId ?? null,
      } satisfies BridgeControlResponseMessage),
    );
    return true;
  }

  private async handleControlRequest(raw: string) {
    const message = this.parseJson<BridgeControlRequestMessage>(raw);
    if (!message) return;
    if (!this.isBridgeRuntimeType(message.runtimeType)) return;
    if (message.originInstanceId === this.instanceId) return;
    if (message.targetInstanceId !== this.instanceId) return;
    if (!this.controlRequestHandler) return;

    const delivered = this.controlRequestHandler(message);
    if (!delivered) return;

    const timeout = setTimeout(() => {
      this.forwardedRequests.delete(message.requestId);
    }, message.timeoutMs + 10_000);

    this.forwardedRequests.set(message.requestId, {
      originInstanceId: message.originInstanceId,
      timeout,
      workspaceId: message.workspaceId,
      runtimeType: message.runtimeType,
      targetBridgeDeviceId: message.targetBridgeDeviceId ?? null,
    });
  }

  private async handleControlResponse(raw: string) {
    const message = this.parseJson<BridgeControlResponseMessage>(raw);
    if (!message) return;
    if (message.originInstanceId !== this.instanceId) return;
    if (!this.isBridgeRuntimeType(message.runtimeType)) return;

    this.responseHandler?.({
      type: message.type,
      data: message.data ?? null,
      workspaceId: message.workspaceId,
      runtimeType: message.runtimeType,
      bridgeDeviceId: message.bridgeDeviceId ?? null,
    });
  }

  private async handlePresenceRequest(raw: string) {
    const message = this.parseJson<BridgeControlPresenceRequestMessage>(raw);
    if (!message || !this.publisher?.isReady) return;
    if (!this.isBridgeRuntimeType(message.runtimeType)) return;
    if (message.originInstanceId === this.instanceId) return;
    if (!this.presenceHandler) return;

    const hasSubscriber = this.presenceHandler(
      message.workspaceId,
      message.capability,
      message.targetBridgeDeviceId,
      message.runtimeType,
    );
    if (!hasSubscriber) return;

    await this.publisher.publish(
      PRESENCE_RESPONSE_CHANNEL,
      JSON.stringify({
        originInstanceId: message.originInstanceId,
        presenceRequestId: message.presenceRequestId,
        instanceId: this.instanceId,
      } satisfies BridgeControlPresenceResponseMessage),
    );
  }

  private handlePresenceResponse(raw: string) {
    const message = this.parseJson<BridgeControlPresenceResponseMessage>(raw);
    if (!message) return;
    if (message.originInstanceId !== this.instanceId) return;

    const pending = this.pendingPresenceRequests.get(message.presenceRequestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingPresenceRequests.delete(message.presenceRequestId);
    pending.resolve(message.instanceId);
  }

  private parseJson<T>(raw: string): T | null {
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `Ignoring malformed bridge control bus message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private isBridgeRuntimeType(value: unknown): value is BridgeRuntimeType {
    return BRIDGE_RUNTIME_TYPES.some((candidate) => candidate === value);
  }

  private buildRedisOptions() {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ||
      this.configService.get<string>("REDIS_PUBLIC_URL");

    if (redisUrl?.trim()) {
      return {
        url: redisUrl,
      };
    }

    const host =
      this.configService.get<string>("REDIS_HOST") ||
      this.configService.get<string>("REDISHOST");
    const password =
      this.configService.get<string>("REDIS_PASSWORD") ||
      this.configService.get<string>("REDISPASSWORD");

    if (!host?.trim() || !password?.trim()) {
      return null;
    }

    return {
      socket: {
        host,
        port:
          this.configService.get<number>("REDIS_PORT") ||
          Number(this.configService.get<string>("REDISPORT") || "6379"),
      },
      username:
        this.configService.get<string>("REDIS_USER") ||
        this.configService.get<string>("REDISUSER") ||
        undefined,
      password,
    };
  }

  private logRedisError(kind: "publisher" | "subscriber", error: Error) {
    const now = Date.now();
    if (now - this.lastRedisErrorLogAt < 5_000) return;
    this.lastRedisErrorLogAt = now;
    this.logger.error(`Bridge control Redis ${kind} error: ${error.message}`);
  }

  private async disconnectClients() {
    const clients = [this.subscriber, this.publisher].filter(
      (client): client is RedisClientType => Boolean(client),
    );
    this.subscriber = null;
    this.publisher = null;

    await Promise.all(
      clients.map(async (client) => {
        try {
          await client.quit();
        } catch {
          try {
            client.disconnect();
          } catch {
            // The client may already be closed after a failed connection.
          }
        }
      }),
    );
  }
}
