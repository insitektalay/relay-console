import {
  isTransientMigrationStartupError,
  migrationStartupErrorSummary,
  runWithMigrationStartupRetry,
} from "./migration-startup-retry";

describe("migration startup retry", () => {
  it("retries PostgreSQL recovery errors and then succeeds", async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(
        Object.assign(new Error("the database system is in recovery mode"), {
          code: "57P03",
        }),
      )
      .mockResolvedValue("ready");
    const sleep = jest.fn<Promise<void>, [number]>().mockResolvedValue();
    const onRetry = jest.fn();

    await expect(
      runWithMigrationStartupRetry(operation, {
        sleep,
        onRetry,
      }),
    ).resolves.toBe("ready");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        nextAttempt: 2,
        delayMs: 2_000,
      }),
    );
  });

  it("recognizes transient connection codes nested in a driver error", () => {
    const error = Object.assign(new Error("query failed"), {
      cause: Object.assign(new Error("connection lost"), { code: "08006" }),
    });

    expect(isTransientMigrationStartupError(error)).toBe(true);
    expect(migrationStartupErrorSummary(error)).toBe("query failed");
  });

  it("does not retry a permanent migration error", async () => {
    const error = Object.assign(new Error("column already exists"), {
      code: "42701",
    });
    const operation = jest.fn<Promise<void>, []>().mockRejectedValue(error);
    const sleep = jest.fn<Promise<void>, [number]>().mockResolvedValue();

    await expect(
      runWithMigrationStartupRetry(operation, { sleep }),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops after the configured number of attempts", async () => {
    const error = Object.assign(new Error("still recovering"), {
      code: "57P03",
    });
    const operation = jest.fn<Promise<void>, []>().mockRejectedValue(error);
    const sleep = jest.fn<Promise<void>, [number]>().mockResolvedValue();

    await expect(
      runWithMigrationStartupRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maximumDelayMs: 15,
        sleep,
      }),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[10], [15]]);
  });
});
