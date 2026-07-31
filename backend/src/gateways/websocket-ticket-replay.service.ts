import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { createClient, RedisClientType } from "redis";

export interface WebsocketTicketBinding {
  jti: string;
  userId: string;
  sessionId: string;
  workspaceId: string;
}

const KEY_PREFIX = "clawchat:ws-ticket:";
const CONSUME_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then return 0 end
if current ~= ARGV[1] then return -1 end
redis.call("DEL", KEYS[1])
return 1
`;

@Injectable()
export class WebsocketTicketReplayService implements OnModuleDestroy {
  private readonly logger = new Logger(WebsocketTicketReplayService.name);
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType> | null = null;

  constructor(private readonly config: ConfigService) {}

  async register(
    binding: WebsocketTicketBinding,
    expiresInSeconds: number,
  ): Promise<void> {
    const client = await this.requireClient();
    const result = await client.set(
      this.key(binding.jti),
      this.bindingDigest(binding),
      {
        EX: expiresInSeconds,
        NX: true,
      },
    );
    if (result !== "OK") {
      throw new Error("WEBSOCKET_TICKET_STATE_CONFLICT");
    }
  }

  async consume(binding: WebsocketTicketBinding): Promise<void> {
    const client = await this.requireClient();
    const result = Number(
      await client.eval(CONSUME_SCRIPT, {
        keys: [this.key(binding.jti)],
        arguments: [this.bindingDigest(binding)],
      }),
    );
    if (result !== 1) {
      throw new Error(
        result === -1
          ? "WEBSOCKET_TICKET_BINDING_MISMATCH"
          : "WEBSOCKET_TICKET_REPLAYED_OR_EXPIRED",
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connecting = null;
    if (!client) return;
    try {
      await client.quit();
    } catch {
      try {
        client.disconnect();
      } catch {
        // Already closed.
      }
    }
  }

  private async requireClient(): Promise<RedisClientType> {
    if (this.client?.isReady) return this.client;
    if (this.connecting) return this.connecting;

    const options = this.redisOptions();
    if (!options) {
      throw new Error("WEBSOCKET_TICKET_REDIS_REQUIRED");
    }

    const client: RedisClientType =
      this.client ?? (createClient(options) as RedisClientType);
    this.client = client;
    client.on("error", () => {
      this.logger.error("WebSocket ticket Redis unavailable");
    });
    this.connecting = client
      .connect()
      .then(() => client)
      .catch(() => {
        this.client = null;
        try {
          client.disconnect();
        } catch {}
        throw new Error("WEBSOCKET_TICKET_REDIS_UNAVAILABLE");
      })
      .finally(() => {
        this.connecting = null;
      });
    return this.connecting;
  }

  private redisOptions(): Parameters<typeof createClient>[0] {
    const url =
      this.config.get<string>("REDIS_URL") ||
      this.config.get<string>("REDIS_PUBLIC_URL");
    if (url?.trim()) return { url };

    const host =
      this.config.get<string>("REDIS_HOST") ||
      this.config.get<string>("REDISHOST");
    const password =
      this.config.get<string>("REDIS_PASSWORD") ||
      this.config.get<string>("REDISPASSWORD");
    if (!host?.trim() || !password?.trim()) return undefined;

    return {
      socket: {
        host,
        port:
          this.config.get<number>("REDIS_PORT") ||
          Number(this.config.get<string>("REDISPORT") || "6379"),
      },
      username:
        this.config.get<string>("REDIS_USER") ||
        this.config.get<string>("REDISUSER") ||
        undefined,
      password,
    };
  }

  private key(jti: string): string {
    return `${KEY_PREFIX}${jti}`;
  }

  private bindingDigest(binding: WebsocketTicketBinding): string {
    return createHash("sha256")
      .update(
        JSON.stringify([
          binding.jti,
          binding.userId,
          binding.sessionId,
          binding.workspaceId,
        ]),
      )
      .digest("hex");
  }
}
