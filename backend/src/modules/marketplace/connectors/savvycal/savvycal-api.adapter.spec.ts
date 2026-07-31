import { SavvyCalApiAdapter, SavvyCalApiError } from "./savvycal-api.adapter";

describe("SavvyCalApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses SavvyCal's fixed API origin and server-held OAuth bearer token", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await new SavvyCalApiAdapter().read("oauth-secret", {
      path: "/v1/events",
      query: { limit: 10 },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.savvycal.com/v1/events?limit=10",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer oauth-secret" }),
    );
  });
  it("allows every documented mutation family", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ id: "ok" }), { status: 200 }),
      );
    const api = new SavvyCalApiAdapter();
    await api.manage("token", {
      method: "POST",
      path: "/v1/events/event_1/cancel",
    });
    await api.manage("token", {
      method: "PATCH",
      path: "/v1/links/link_1",
      json: { name: "Sales" },
    });
    await api.manage("token", {
      method: "DELETE",
      path: "/v1/webhooks/hook_1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("blocks undocumented routes, method mismatches, and credential-bearing input", async () => {
    const api = new SavvyCalApiAdapter();
    expect(() => api.read("token", { path: "/v1/billing" })).toThrow(
      SavvyCalApiError,
    );
    expect(() =>
      api.manage("token", { method: "PATCH", path: "/v1/events/event_1" }),
    ).toThrow(SavvyCalApiError);
    await expect(
      api.manage("token", {
        method: "POST",
        path: "/v1/webhooks",
        json: { secret: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("redacts returned credentials and maps throttling safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "secret" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Slow down" }), { status: 429 }),
      );
    const api = new SavvyCalApiAdapter();
    await expect(api.read("token", { path: "/v1/me" })).resolves.toEqual({
      access_token: "[redacted]",
    });
    await expect(api.read("token", { path: "/v1/me" })).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
