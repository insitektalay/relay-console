import { ReallySimpleSystemsApiAdapter } from "./really-simple-systems-api.adapter";

describe("ReallySimpleSystemsApiAdapter", () => {
  const adapter = new ReallySimpleSystemsApiAdapter();
  const credentials = { accessToken: "spotler-test-token" };

  afterEach(() => jest.restoreAllMocks());

  it("pins health to the legacy-named V4 origin and attaches the bearer token", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          metadata: { total_count: 1 },
          list: [{ record: { id: 1, access_token: "provider-secret" } }],
        }),
        { status: 200 },
      ),
    );

    const result = await adapter.health(credentials);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://apiv4.reallysimplesystems.com",
        pathname: "/accounts",
        search: "?limit=1&page=1",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer spotler-test-token",
        }),
        redirect: "error",
      }),
    );
    expect(result.accountProbe).toEqual({
      metadata: { total_count: 1 },
      list: [{ record: { id: 1, access_token: "[redacted]" } }],
    });
  });

  it("permits bounded JSON filtering and ordering", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ metadata: {}, list: [] }), {
        status: 200,
      }),
    );

    await adapter.read(credentials, {
      path: "/opportunities",
      query: {
        limit: 50,
        page: 2,
        lines: true,
        q: JSON.stringify({ status: { $in: ["Open", "Won"] } }),
        order: JSON.stringify({ modifieddate: "desc" }),
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/opportunities",
        searchParams: expect.any(URLSearchParams),
      }),
      expect.objectContaining({ method: "GET" }),
    );
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("q")).toBe('{"status":{"$in":["Open","Won"]}}');
  });

  it("permits exact record and lookup mutations", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ record: { id: 95950731 } }), {
          status: 200,
        }),
    );

    await adapter.manage(credentials, {
      method: "PATCH",
      path: "/accounts/95950731",
      json: { name: "Updated account" },
    });
    await adapter.manage(credentials, {
      method: "PATCH",
      path: "/lookup/account_type",
      json: { items: ["Partner"] },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ pathname: "/accounts/95950731" }),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Updated account" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pathname: "/lookup/account_type" }),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("permits dictionaries and lookup reads but blocks arbitrary resources", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ fields: [] }), { status: 200 }),
      );

    await expect(
      adapter.read(credentials, { path: "/datadictionary/contacts" }),
    ).resolves.toEqual({ fields: [] });
    await expect(
      adapter.read(credentials, { path: "/lookup/accounts/type" }),
    ).resolves.toEqual({ fields: [] });
    expect(() => adapter.read(credentials, { path: "/users" })).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
  });

  it("rejects oversized pages, malformed filter JSON, and credential-bearing bodies", async () => {
    await expect(
      adapter.read(credentials, {
        path: "/accounts",
        query: { limit: 101 },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.read(credentials, {
        path: "/accounts",
        query: { q: "not-json" },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/contacts",
        json: { accountid: 1, name: "Ada", apiKey: "do-not-send" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps Spotler CRM's documented token failure", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "Forbidden",
          code: 402,
          message: "Please check your access token",
        }),
        { status: 402 },
      ),
    );

    await expect(
      adapter.read(credentials, { path: "/accounts" }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "token_expired",
        message: "Please check your access token",
        statusCode: 402,
      }),
    );
  });
});
