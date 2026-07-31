import { ZendeskSellApiAdapter } from "./zendesk-sell-api.adapter";

describe("ZendeskSellApiAdapter", () => {
  const adapter = new ZendeskSellApiAdapter();
  const credentials = { accessToken: "zendesk-sell-access-token" };

  afterEach(() => jest.restoreAllMocks());

  it("binds health checks to the fixed Zendesk Sell origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { id: 7 }, refresh_token: "secret" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 9 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await adapter.health(credentials);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        origin: "https://api.getbase.com",
        pathname: "/oauth2/token/info",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer zendesk-sell-access-token",
        }),
        redirect: "error",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        origin: "https://api.getbase.com",
        pathname: "/v2/account",
      }),
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.token).toEqual({
      data: { id: 7 },
      refresh_token: "[redacted]",
    });
  });

  it("permits a bounded documented deal read", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [{ data: { id: 1 } }] }), {
        status: 200,
      }),
    );

    await adapter.read(credentials, {
      path: "/v2/deals",
      query: { per_page: 25, page: 1, sort_by: "updated_at:desc" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/v2/deals",
        search: "?per_page=25&page=1&sort_by=updated_at%3Adesc",
      }),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("permits an approved documented lead mutation", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: 2 } }), { status: 200 }),
      );

    await adapter.manage(credentials, {
      method: "POST",
      path: "/v2/leads",
      json: { data: { last_name: "Lovelace" }, meta: { type: "lead" } },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/v2/leads" }),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          data: { last_name: "Lovelace" },
          meta: { type: "lead" },
        }),
      }),
    );
  });

  it("rejects unsupported APIs, unbounded paging, and credential-bearing bodies", async () => {
    expect(() =>
      adapter.read(credentials, { path: "/v3/search", query: { q: "deal" } }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    await expect(
      adapter.read(credentials, {
        path: "/v2/deals",
        query: { per_page: 500 },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/v2/tasks",
        json: { data: { content: "Call back", access_token: "do-not-send" } },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps provider throttling without exposing response secrets", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "slow down", token: "secret" }), {
        status: 429,
      }),
    );

    await expect(
      adapter.read(credentials, { path: "/v2/users" }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "provider_rate_limited",
        message: "slow down",
        statusCode: 429,
      }),
    );
  });
});
