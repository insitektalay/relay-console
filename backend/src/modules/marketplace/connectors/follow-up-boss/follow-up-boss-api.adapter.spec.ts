import { FollowUpBossApiAdapter } from "./follow-up-boss-api.adapter";

describe("FollowUpBossApiAdapter", () => {
  const adapter = new FollowUpBossApiAdapter();
  const credentials = {
    apiKey: "fub-test-key",
    systemName: "RelayConsole",
    systemKey: "registered-system-key",
  };

  afterEach(() => jest.restoreAllMocks());

  it("pins health to /v1/identity, uses Basic API-key auth, and sends registered-system headers", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 123,
          account: { id: 456 },
          apiKey: "provider-secret",
        }),
        { status: 200 },
      ),
    );

    const result = await adapter.health(credentials);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://api.followupboss.com",
        pathname: "/v1/identity",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("fub-test-key:").toString("base64")}`,
          "X-System": "RelayConsole",
          "X-System-Key": "registered-system-key",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        authenticated: true,
        apiVersion: "v1",
        identity: {
          id: 123,
          account: { id: 456 },
          apiKey: "[redacted]",
        },
      }),
    );
  });

  it("permits bounded CRM reads and rejects allFields expansion", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ people: [] }), { status: 200 }),
    );

    await adapter.read(credentials, {
      path: "/people",
      query: { limit: 25, offset: 50, fields: "id,name,stage" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/v1/people",
        search: "?limit=25&offset=50&fields=id%2Cname%2Cstage",
      }),
      expect.objectContaining({ method: "GET" }),
    );
    await expect(
      adapter.read(credentials, {
        path: "/people",
        query: { fields: "allFields" },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("permits approved lead-event and CRM record mutations", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: 789 }), { status: 201 }),
    );

    await adapter.manage(credentials, {
      method: "POST",
      path: "/events",
      json: {
        source: "relayconsole.work",
        system: "RelayConsole",
        type: "General Inquiry",
        person: { firstName: "Ada", emails: [{ value: "ada@example.com" }] },
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/v1/events" }),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("General Inquiry"),
      }),
    );
  });

  it("blocks communications, user administration, raw OAuth apps, and oversized pagination", async () => {
    expect(() =>
      adapter.manage(credentials, {
        method: "POST",
        path: "/textMessages",
        json: { body: "nope" },
      }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    expect(() =>
      adapter.manage(credentials, { method: "DELETE", path: "/users/123" }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    expect(() => adapter.read(credentials, { path: "/oauthApps" })).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
    await expect(
      adapter.read(credentials, { path: "/people", query: { limit: 101 } }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects credential-bearing input and maps provider failures safely", async () => {
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/notes",
        json: { personId: 123, body: "Follow up", token: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });

    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ errorMessage: "Rate limit exceeded" }), {
        status: 429,
      }),
    );
    await expect(
      adapter.read(credentials, { path: "/users" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
