import { SalesflareApiAdapter } from "./salesflare-api.adapter";

describe("SalesflareApiAdapter", () => {
  const adapter = new SalesflareApiAdapter();
  const credentials = { apiKey: "salesflare-test-key" };

  afterEach(() => jest.restoreAllMocks());

  it("binds health and reads to the fixed Salesflare origin", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ id: 7, tracking_token: "provider-secret" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await adapter.health(credentials);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://api.salesflare.com",
        pathname: "/me",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer salesflare-test-key",
        }),
        redirect: "error",
      }),
    );
    expect(result.currentUser).toEqual({ id: 7, tracking_token: "[redacted]" });
  });

  it("permits a bounded documented list read", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ id: 1 }]), { status: 200 }),
      );

    await adapter.read(credentials, {
      path: "/contacts",
      query: { limit: 25, offset: 0, search: "Ada" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/contacts",
        search: "?limit=25&offset=0&search=Ada",
      }),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("permits documented workflow audience mutation", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

    await adapter.manage(credentials, {
      method: "PUT",
      path: "/workflows/12/audience/34",
      json: { exited: true },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/workflows/12/audience/34" }),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ exited: true }),
      }),
    );
  });

  it("rejects export mode, unknown routes, and credential-bearing bodies", async () => {
    await expect(
      adapter.read(credentials, {
        path: "/accounts",
        query: { export: "csv" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(() => adapter.read(credentials, { path: "/billing" })).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/tasks",
        json: { description: "Follow up", api_key: "do-not-send" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps provider throttling without exposing response secrets", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: "slow down", token: "secret" }),
          { status: 429 },
        ),
      );

    await expect(adapter.read(credentials, { path: "/users" })).rejects.toEqual(
      expect.objectContaining({
        code: "provider_rate_limited",
        message: "slow down",
        statusCode: 429,
      }),
    );
  });
});
