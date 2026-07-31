import { ConfigService } from "@nestjs/config";
import { HermesWorkerClient } from "./hermes-worker.client";

describe("HermesWorkerClient security", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function client(values: Record<string, string>) {
    return new HermesWorkerClient({
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService);
  }

  it("requires an exact Railway private origin in production", async () => {
    for (const baseUrl of [
      "http://worker.up.railway.app",
      "http://worker.railway.internal:8765",
      "http://relay-hermes-runtime-1.railway.internal:8080",
      "https://worker.up.railway.app",
      "https://attacker.example",
      "https://worker.up.railway.app.attacker.example",
      "https://worker.up.railway.app/path",
    ]) {
      await expect(
        client({
          NODE_ENV: "production",
          HERMES_WORKER_BASE_URL: baseUrl,
          HERMES_WORKER_SHARED_SECRET: "s".repeat(32),
        }).getHealth(),
      ).rejects.toThrow(/Railway .*origin|must be an origin/);
    }
  });

  it("accepts the fixed private Railway worker origin", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        implementation: "python_worker",
        authEnabled: true,
        workspaceIsolation: "single_managed_runtime",
        activeRuns: 0,
        maxActiveRuns: 8,
        storageUsedBytes: 0,
      }),
    }) as typeof fetch;
    await client({
      NODE_ENV: "production",
      HERMES_WORKER_BASE_URL:
        "http://relay-hermes-runtime-1.railway.internal:8765",
      HERMES_WORKER_SHARED_SECRET: "s".repeat(32),
    }).getHealth();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://relay-hermes-runtime-1.railway.internal:8765/health",
      expect.any(Object),
    );
  });

  it("accepts a bounded authenticated Railway health response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        implementation: "python_worker",
        authEnabled: true,
        workspaceIsolation: "single_managed_runtime",
        activeRuns: 0,
        maxActiveRuns: 8,
        storageUsedBytes: 0,
      }),
    }) as typeof fetch;
    const result = await client({
      NODE_ENV: "production",
      HERMES_WORKER_BASE_URL:
        "http://relay-hermes-runtime-1.railway.internal:8765",
      HERMES_WORKER_SHARED_SECRET: "s".repeat(32),
    }).getHealth();
    expect(result.workspaceIsolation).toBe("single_managed_runtime");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://relay-hermes-runtime-1.railway.internal:8765/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${"s".repeat(32)}`,
        }),
      }),
    );
  });

  it("rejects unsafe dispatch identifiers before building a cancel URL", async () => {
    global.fetch = jest.fn() as typeof fetch;
    await expect(
      client({
        HERMES_WORKER_BASE_URL: "http://127.0.0.1:8765",
        HERMES_WORKER_SHARED_SECRET: "s".repeat(32),
      }).cancelRun("../../health"),
    ).rejects.toThrow(/dispatchId is invalid/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
