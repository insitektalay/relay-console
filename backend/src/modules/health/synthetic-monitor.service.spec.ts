import { ConfigService } from "@nestjs/config";
import { SyntheticMonitorService } from "./synthetic-monitor.service";

describe("SyntheticMonitorService", () => {
  const values: Record<string, string> = {
    CLAWCHAT_WEB_ORIGIN: "https://relayconsole.work",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work",
    CLAWCHAT_BETA_SMOKE_EMAIL: "synthetic@example.test",
    CLAWCHAT_BETA_SMOKE_PASSWORD: "not-a-real-password",
    CLAWCHAT_BETA_SMOKE_WORKSPACE_ID: "workspace-test",
    RELAY_OPERATOR_API_SECRET: "operator-test-secret",
  };

  function create(overrides: Record<string, string> = {}) {
    const config = new ConfigService({ ...values, ...overrides });
    const health = { ready: jest.fn().mockResolvedValue({ ok: true }) };
    const billing = {
      snapshot: jest.fn().mockResolvedValue({ status: "healthy", alerts: [] }),
    };
    const operations = {
      snapshot: jest.fn().mockResolvedValue({ status: "healthy", alerts: [] }),
    };
    const service = new SyntheticMonitorService(
      health as any,
      billing as any,
      operations as any,
      config,
    );
    return { service, health, billing, operations };
  }

  afterEach(() => jest.restoreAllMocks());

  it("fails closed without exposing which required configuration is absent", async () => {
    const { service } = create({ CLAWCHAT_BETA_SMOKE_PASSWORD: "" });
    const result = await service.check();
    expect(result).toEqual({
      ok: false,
      status: "attention",
      checkedAt: expect.any(String),
    });
    expect(JSON.stringify(result)).not.toContain("PASSWORD");
  });

  it("fails closed on loopback monitoring origins", async () => {
    const { service } = create({
      CLAWCHAT_WEB_ORIGIN: "http://localhost:3000",
    });
    await expect(service.check()).resolves.toMatchObject({
      ok: false,
      status: "attention",
    });
  });

  it("caches a failed bounded check instead of letting operator polling amplify work", async () => {
    const { service, health, billing, operations } = create();
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
    const first = await service.check();
    const second = await service.check();
    expect(first).toEqual(second);
    expect(health.ready).toHaveBeenCalledTimes(1);
    expect(billing.snapshot).toHaveBeenCalledTimes(1);
    expect(operations.snapshot).toHaveBeenCalledTimes(1);
  });

  it("authenticates the protected readiness check through the web rewrite", async () => {
    const { service } = create();
    jest.spyOn(service as any, "fetchOk").mockResolvedValue(true);
    const fetchJsonOk = jest
      .spyOn(service as any, "fetchJsonOk")
      .mockResolvedValue(true);
    jest
      .spyOn(service as any, "authenticatedWebsocket")
      .mockResolvedValue(true);

    await expect(service.check()).resolves.toMatchObject({
      ok: true,
      status: "healthy",
    });
    expect(fetchJsonOk).toHaveBeenCalledWith(
      new URL("https://relayconsole.work/api/v1/health/ready"),
      { "x-relay-operator-secret": "operator-test-secret" },
    );
    expect(String(fetchJsonOk.mock.calls[0][0])).not.toContain(
      "operator-test-secret",
    );
  });
});
