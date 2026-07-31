import { DistributedRateLimitService } from "./distributed-rate-limit.service";

function config(values: Record<string, string | number> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

function attachClient(
  service: DistributedRateLimitService,
  client: Record<string, unknown>,
) {
  (service as any).client = { isReady: true, ...client };
}

describe("DistributedRateLimitService", () => {
  it("shares an atomic Redis counter across service instances", async () => {
    const totals = new Map<string, number>();
    const client = {
      eval: jest.fn(async (_script, input: { keys: string[] }) => {
        const key = input.keys[0];
        const total = (totals.get(key) ?? 0) + 1;
        totals.set(key, total);
        return [total, 60_000];
      }),
    };
    const first = new DistributedRateLimitService(config() as any);
    const second = new DistributedRateLimitService(config() as any);
    attachClient(first, client);
    attachClient(second, client);

    expect(
      (await first.increment("same-route-and-client", 60_000)).totalHits,
    ).toBe(1);
    expect(
      (await second.increment("same-route-and-client", 60_000)).totalHits,
    ).toBe(2);
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("PEXPIRE", KEYS[1], ARGV[1])'),
      expect.objectContaining({ arguments: ["60000"] }),
    );
  });

  it("separates namespaces and hashes caller-controlled keys", async () => {
    const keys: string[] = [];
    const client = {
      eval: jest.fn(async (_script, input: { keys: string[] }) => {
        keys.push(input.keys[0]);
        return [1, 10_000];
      }),
    };
    const service = new DistributedRateLimitService(config() as any);
    attachClient(service, client);

    await service.incrementNamed("ws-client", "203.0.113.8", 10_000);
    await service.incrementNamed("ws-socket", "203.0.113.8", 10_000);

    expect(keys[0]).toMatch(/^clawchat:rate:ws-client:[a-f0-9]{64}$/);
    expect(keys[1]).toMatch(/^clawchat:rate:ws-socket:[a-f0-9]{64}$/);
    expect(keys[0]).not.toContain("203.0.113.8");
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("uses an expiring bounded fallback when Redis is unavailable", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-27T12:00:00Z"));
    const service = new DistributedRateLimitService(
      config({ RATE_LIMIT_FALLBACK_CAPACITY: 2 }) as any,
    );

    expect((await service.increment("a", 1_000)).totalHits).toBe(1);
    expect((await service.increment("a", 1_000)).totalHits).toBe(2);
    await service.increment("b", 1_000);
    await service.increment("c", 1_000);
    expect((service as any).fallback.size).toBe(2);

    jest.advanceTimersByTime(1_001);
    expect((await service.increment("a", 1_000)).totalHits).toBe(1);
    expect((service as any).fallback.size).toBeLessThanOrEqual(2);
    jest.useRealTimers();
  });

  it("falls back safely when an established Redis command fails", async () => {
    const service = new DistributedRateLimitService(config() as any);
    attachClient(service, {
      eval: jest.fn().mockRejectedValue(new Error("redis unavailable")),
    });

    expect(
      (await service.increment("credential-route", 60_000)).totalHits,
    ).toBe(1);
    expect(
      (await service.increment("credential-route", 60_000)).totalHits,
    ).toBe(2);
  });
});
