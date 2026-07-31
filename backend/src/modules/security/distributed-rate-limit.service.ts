import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ThrottlerStorage } from "@nestjs/throttler";
import { createHash } from "crypto";
import { createClient, RedisClientType } from "redis";

interface LocalRateBucket {
  totalHits: number;
  expiresAt: number;
}

interface RateLimitRecord {
  totalHits: number;
  timeToExpire: number;
}

const INCREMENT_SCRIPT = `
local total = redis.call("INCR", KEYS[1])
if total == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
local remaining = redis.call("PTTL", KEYS[1])
if remaining < 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  remaining = tonumber(ARGV[1])
end
return {total, remaining}
`;

@Injectable()
export class DistributedRateLimitService
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(DistributedRateLimitService.name);
  private readonly fallback = new Map<string, LocalRateBucket>();
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType> | null = null;
  private lastFailureLogAt = 0;

  constructor(private readonly config: ConfigService) {}

  increment(key: string, ttl: number): Promise<RateLimitRecord> {
    return this.incrementNamed("http", key, ttl);
  }

  async incrementNamed(
    namespace: string,
    key: string,
    ttl: number,
  ): Promise<RateLimitRecord> {
    const boundedTtl = Math.max(1, Math.floor(ttl));
    const redisKey = this.redisKey(namespace, key);
    try {
      const client = await this.redisClient();
      const result = (await client.eval(INCREMENT_SCRIPT, {
        keys: [redisKey],
        arguments: [String(boundedTtl)],
      })) as [number | string, number | string];
      return {
        totalHits: Number(result[0]),
        timeToExpire: Math.max(1, Math.ceil(Number(result[1]) / 1000)),
      };
    } catch {
      this.logFallback();
      return this.incrementFallback(redisKey, boundedTtl);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connecting = null;
    this.fallback.clear();
    if (!client) return;
    try {
      await client.quit();
    } catch {
      try {
        client.disconnect();
      } catch {}
    }
  }

  private incrementFallback(key: string, ttl: number): RateLimitRecord {
    const now = Date.now();
    const existing = this.fallback.get(key);
    if (existing && existing.expiresAt > now) {
      existing.totalHits += 1;
      return {
        totalHits: existing.totalHits,
        timeToExpire: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
      };
    }
    if (existing) this.fallback.delete(key);
    this.pruneFallback(now);
    this.fallback.set(key, { totalHits: 1, expiresAt: now + ttl });
    return { totalHits: 1, timeToExpire: Math.max(1, Math.ceil(ttl / 1000)) };
  }

  private pruneFallback(now: number): void {
    for (const [key, bucket] of this.fallback) {
      if (bucket.expiresAt <= now) this.fallback.delete(key);
    }
    const capacity = this.positiveConfig(
      "RATE_LIMIT_FALLBACK_CAPACITY",
      10_000,
    );
    while (this.fallback.size >= capacity) {
      const oldest = this.fallback.keys().next().value as string | undefined;
      if (!oldest) break;
      this.fallback.delete(oldest);
    }
  }

  private async redisClient(): Promise<RedisClientType> {
    if (this.client?.isReady) return this.client;
    if (this.connecting) return this.connecting;
    const options = this.redisOptions();
    if (!options) throw new Error("RATE_LIMIT_REDIS_NOT_CONFIGURED");
    const client: RedisClientType =
      this.client ?? (createClient(options) as RedisClientType);
    this.client = client;
    client.on("error", () => this.logFallback());
    this.connecting = client
      .connect()
      .then(() => client)
      .catch(() => {
        this.client = null;
        try {
          client.disconnect();
        } catch {}
        throw new Error("RATE_LIMIT_REDIS_UNAVAILABLE");
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
    if (url?.trim()) {
      return {
        url,
        socket: { connectTimeout: 500, reconnectStrategy: false },
      };
    }
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
        connectTimeout: 500,
        reconnectStrategy: false,
      },
      username:
        this.config.get<string>("REDIS_USER") ||
        this.config.get<string>("REDISUSER") ||
        undefined,
      password,
    };
  }

  private redisKey(namespace: string, key: string): string {
    const digest = createHash("sha256")
      .update(`${namespace}\0${key}`)
      .digest("hex");
    return `clawchat:rate:${namespace}:${digest}`;
  }

  private positiveConfig(key: string, fallback: number): number {
    const value = Number(this.config.get<string | number>(key));
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }

  private logFallback(): void {
    const now = Date.now();
    if (now - this.lastFailureLogAt < 5_000) return;
    this.lastFailureLogAt = now;
    this.logger.error(
      "Distributed rate-limit Redis unavailable; using bounded local enforcement",
    );
  }
}
