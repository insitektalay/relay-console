import { YouCanBookMeApiAdapter, YouCanBookMeApiError } from "./youcanbookme-api.adapter";

describe("YouCanBookMeApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { accountId: "account-123", apiKey: "ak_secret" };

  it("uses the fixed API origin and server-held HTTP Basic credentials", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(
      async () => new Response(JSON.stringify([]), { status: 200 }),
    );
    await new YouCanBookMeApiAdapter().read(credentials, { path: "/v1/profiles", query: { ownerId: "owner-1" } });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.youcanbook.me/v1/profiles?ownerId=owner-1");
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({ Authorization: `Basic ${Buffer.from("account-123:ak_secret").toString("base64")}` }));
    await new YouCanBookMeApiAdapter().read(credentials, {
      path: "/v1/bookings",
      query: { fields: "id,startsAt" },
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://api.youcanbook.me/v1/account-123/bookings?fields=id%2CstartsAt",
    );
  });

  it("allows the complete documented mutation families", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ id: "ok" }), { status: 200 }),
    );
    const api = new YouCanBookMeApiAdapter();
    await api.manage(credentials, { method: "POST", path: "/v1/profiles", json: { title: "Sales" } });
    await api.manage(credentials, { method: "PATCH", path: "/v1/bookings/booking-1", json: { cancelled: true } });
    await api.manage(credentials, { method: "DELETE", path: "/v1/profiles/profile-1/teammembers/items/member-1" });
    await api.manage(credentials, { method: "POST", path: "/v1/profiles/profile-1/appointmenttypes/items", json: { name: "Demo" } });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("blocks unknown routes, method mismatches, and credential-bearing input", async () => {
    const api = new YouCanBookMeApiAdapter();
    expect(() => api.read(credentials, { path: "/v1/billing" })).toThrow(YouCanBookMeApiError);
    expect(() => api.manage(credentials, { method: "DELETE", path: "/v1/profiles/profile-1" })).toThrow(YouCanBookMeApiError);
    await expect(api.manage(credentials, { method: "POST", path: "/v1/profiles", json: { apiKey: "no" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts returned credentials and maps throttling safely", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ apiKey: "secret" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Slow down" }), { status: 429 }));
    const api = new YouCanBookMeApiAdapter();
    await expect(api.read(credentials, { path: "/v1/profiles" })).resolves.toEqual({ apiKey: "[redacted]" });
    await expect(api.read(credentials, { path: "/v1/profiles" })).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
