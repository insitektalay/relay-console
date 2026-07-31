import { AcuitySchedulingApiAdapter } from "./acuity-scheduling-api.adapter";

describe("AcuitySchedulingApiAdapter", () => {
  const adapter = new AcuitySchedulingApiAdapter();
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("binds reads to Acuity's fixed origin with a bearer token", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await adapter.read("access-token", {
      path: "/api/v1/appointments",
      query: { max: 10 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://acuityscheduling.com",
        pathname: "/api/v1/appointments",
        search: "?max=10",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
        redirect: "error",
      }),
    );
  });

  it("permits documented mutations", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 42 }), { status: 200 }),
      );
    await adapter.manage("access-token", {
      method: "PUT",
      path: "/api/v1/appointments/42/reschedule",
      json: { datetime: "2026-08-01T10:00:00Z" },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/api/v1/appointments/42/reschedule",
      }),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("rejects unofficial or undocumented routes", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.read("access-token", { path: "https://example.com/steal" }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      Promise.resolve().then(() =>
        adapter.manage("access-token", {
          method: "DELETE",
          path: "/api/v1/appointments/42",
        }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("never accepts credential-bearing request fields", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.manage("access-token", {
          method: "POST",
          path: "/api/v1/appointments",
          json: { apiKey: "leak" },
        }),
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
