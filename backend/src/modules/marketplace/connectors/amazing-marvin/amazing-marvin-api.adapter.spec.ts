import {
  AmazingMarvinApiAdapter,
  AmazingMarvinApiError,
} from "./amazing-marvin-api.adapter";

describe("AmazingMarvinApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  const credentials = { apiToken: "limited", fullAccessToken: "full" };

  it("uses the fixed public origin and correct server-held token", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await new AmazingMarvinApiAdapter().read(credentials, {
      path: "/todayItems",
      query: { date: "2026-07-15" },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://serv.amazingmarvin.com/api/todayItems?date=2026-07-15",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ "X-API-Token": "limited" }),
    );
  });

  it("uses the full-access token only for database-document routes", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ _id: "item" }), { status: 200 }),
      );
    await new AmazingMarvinApiAdapter().manage(credentials, {
      path: "/doc/update",
      json: { itemId: "item", setters: [{ key: "title", val: "Ship" }] },
    });
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Full-Access-Token": "full" }),
      }),
    );
  });

  it("blocks unknown routes and credential-bearing input", async () => {
    const api = new AmazingMarvinApiAdapter();
    expect(() => api.read(credentials, { path: "/billing" })).toThrow(
      AmazingMarvinApiError,
    );
    await expect(
      api.manage(credentials, {
        path: "/addTask",
        json: { apiToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts tokens and maps throttling safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ apiToken: "secret" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Slow down" }), {
          status: 429,
        }),
      );
    await expect(
      new AmazingMarvinApiAdapter().read(credentials, { path: "/me" }),
    ).resolves.toEqual({ apiToken: "[redacted]" });
    await expect(
      new AmazingMarvinApiAdapter().read(credentials, { path: "/me" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
