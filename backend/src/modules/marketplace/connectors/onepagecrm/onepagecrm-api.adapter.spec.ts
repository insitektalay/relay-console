import { OnePageCrmApiAdapter } from "./onepagecrm-api.adapter";

describe("OnePageCrmApiAdapter", () => {
  const adapter = new OnePageCrmApiAdapter();
  const userId = "5aba31e99007ba0f570c12f7";
  const recordId = "5aba31ea9007ba0f570c92d4";
  const credentials = { userId, apiKey: "onepage-test-key" };

  afterEach(() => jest.restoreAllMocks());

  it("pins health to V3, uses HTTP Basic, and verifies the exact user", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 0,
          data: { user: { id: userId, auth_key: "provider-secret" } },
        }),
        { status: 200 },
      ),
    );

    const result = await adapter.health(credentials);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://app.onepagecrm.com",
        pathname: `/api/v3/users/${userId}.json`,
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from(`${userId}:onepage-test-key`).toString("base64")}`,
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        userVerified: true,
        userId,
        currentUser: {
          status: 0,
          data: { user: { id: userId, auth_key: "[redacted]" } },
        },
      }),
    );
  });

  it("permits a bounded filtered contact read", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: 0, data: { contacts: [] } }), {
        status: 200,
      }),
    );

    await adapter.read(credentials, {
      path: "/contacts",
      query: { per_page: 25, page: 2, search: "Ada" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/api/v3/contacts.json",
        search: "?per_page=25&page=2&search=Ada",
      }),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("permits an exact approved action transition", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 0, data: {} }), { status: 200 }),
      );

    await adapter.manage(credentials, {
      method: "PUT",
      path: `/actions/${recordId}/mark_as_done`,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: `/api/v3/actions/${recordId}/mark_as_done.json`,
      }),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("rejects account administration, schema writes, raw MCP, and oversized pagination", async () => {
    expect(() => adapter.read(credentials, { path: "/bootstrap" })).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
    expect(() =>
      adapter.manage(credentials, {
        method: "POST",
        path: "/change_auth_key",
      }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    expect(() =>
      adapter.manage(credentials, {
        method: "POST",
        path: "/custom_fields",
        json: { name: "Secret", api_key: "do-not-send" },
      }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    expect(() => adapter.read(credentials, { path: "/mcp" })).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
    await expect(
      adapter.read(credentials, {
        path: "/contacts",
        query: { per_page: 101 },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects credential-bearing bodies and maps both provider throttles", async () => {
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/notes",
        json: { contact_id: recordId, text: "Follow up", token: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });

    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("Rate Limit Exceeded", { status: 403 }));
    await expect(adapter.read(credentials, { path: "/users" })).rejects.toEqual(
      expect.objectContaining({
        code: "provider_rate_limited",
        statusCode: 403,
      }),
    );
  });
});
