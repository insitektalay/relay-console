import { ChimeCrmApiAdapter } from "./chime-crm-api.adapter";

describe("ChimeCrmApiAdapter", () => {
  const adapter = new ChimeCrmApiAdapter();
  const credentials = { apiKey: "lofty-test-key" };

  afterEach(() => jest.restoreAllMocks());

  it("pins health to api.lofty.com /v1.0/me and redacts credential-shaped fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ code: 0, data: { id: 123, accessToken: "secret" } }),
        { status: 200 },
      ),
    );

    const result = await adapter.health(credentials);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://api.lofty.com",
        pathname: "/v1.0/me",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "lofty-test-key" }),
        redirect: "error",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        authenticated: true,
        provider: "lofty",
        legacyName: "chime",
        me: { code: 0, data: { id: 123, accessToken: "[redacted]" } },
      }),
    );
  });

  it("permits bounded lead and calendar reads", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: [] }), { status: 200 }),
    );

    await adapter.read(credentials, {
      path: "/v1.0/lead",
      query: { page: 1, pageSize: 25 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/v1.0/lead",
        search: "?page=1&pageSize=25",
      }),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("permits approved calendar and manual-log mutations", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: { id: "123-task" } }), {
        status: 200,
      }),
    );

    await adapter.manage(credentials, {
      method: "POST",
      path: "/v2.0/calendar",
      json: { type: "task", leadId: 123, title: "Follow up" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/v2.0/calendar" }),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Follow up"),
      }),
    );
  });

  it("blocks outbound communications, org administration, OAuth administration, and oversized pages", async () => {
    expect(() =>
      adapter.manage(credentials, {
        method: "POST",
        path: "/v1.0/message/sms/send",
        json: { body: "nope" },
      }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    expect(() =>
      adapter.manage(credentials, {
        method: "POST",
        path: "/v1.0/org/company",
      }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    expect(() => adapter.read(credentials, { path: "/api/user-web/oauth/token" })).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
    await expect(
      adapter.read(credentials, {
        path: "/v1.0/lead",
        query: { pageSize: 101 },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects credential-bearing input and maps provider throttles safely", async () => {
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/v1.0/logType",
        json: { leadId: 123, token: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });

    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
        status: 429,
      }),
    );
    await expect(
      adapter.read(credentials, { path: "/v1.0/lead" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
