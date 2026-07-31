import { KeapMaxClassicApiAdapter } from "./keap-max-classic-api.adapter";

describe("KeapMaxClassicApiAdapter", () => {
  const adapter = new KeapMaxClassicApiAdapter();
  const credentials = { accessToken: "keap-max-classic-access-token" };

  afterEach(() => jest.restoreAllMocks());

  it("binds health checks to the fixed Keap REST origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ name: "Classic Co", refresh_token: "secret" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await adapter.health(credentials);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://api.infusionsoft.com",
        pathname: "/crm/rest/v1/account/profile",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer keap-max-classic-access-token",
        }),
        redirect: "error",
      }),
    );
    expect(result.profile).toEqual({
      name: "Classic Co",
      refresh_token: "[redacted]",
    });
  });

  it("permits a bounded documented contact read", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ contacts: [{ id: 1 }] }), {
        status: 200,
      }),
    );

    await adapter.read(credentials, {
      path: "/crm/rest/v1/contacts",
      query: { limit: 25, page: 1 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/crm/rest/v1/contacts",
        search: "?limit=25&page=1",
      }),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("permits an approved documented campaign-goal mutation", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 201 }),
      );

    await adapter.manage(credentials, {
      method: "POST",
      path: "/crm/rest/v1/campaigns/goals/relay/followup",
      json: { contact_id: 123 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/crm/rest/v1/campaigns/goals/relay/followup",
      }),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ contact_id: 123 }),
      }),
    );
  });

  it("rejects unsupported APIs, unbounded paging, and credential-bearing bodies", async () => {
    expect(() =>
      adapter.read(credentials, { path: "/crm/xmlrpc/v1", query: {} }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    await expect(
      adapter.read(credentials, {
        path: "/crm/rest/v1/contacts",
        query: { limit: 500 },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/crm/rest/v1/tasks",
        json: { title: "Follow up", api_key: "do-not-send" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps provider throttling without exposing response secrets", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "slow down", token: "secret" }), {
        status: 429,
      }),
    );

    await expect(
      adapter.read(credentials, { path: "/crm/rest/v1/users" }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "provider_rate_limited",
        message: "slow down",
        statusCode: 429,
      }),
    );
  });
});
