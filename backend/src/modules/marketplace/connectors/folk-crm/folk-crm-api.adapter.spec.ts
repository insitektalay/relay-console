import { FolkCrmApiAdapter } from "./folk-crm-api.adapter";

describe("FolkCrmApiAdapter", () => {
  const adapter = new FolkCrmApiAdapter();
  const credentials = { apiKey: "folk-test-key" };
  const personId = "per_55175e81-9a52-4ac3-930e-82792c23499b";

  afterEach(() => jest.restoreAllMocks());

  it("pins health to folk's versioned API and redacts secret-like fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { id: "usr_1", signingSecret: "provider-secret" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await adapter.health(credentials);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://api.folk.app",
        pathname: "/v1/users/me",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer folk-test-key",
          "X-API-Version": "2025-05-26",
        }),
        redirect: "error",
      }),
    );
    expect(result.currentUser).toEqual({
      data: { id: "usr_1", signingSecret: "[redacted]" },
    });
  });

  it("permits a bounded documented filtered list read", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { items: [] } }), { status: 200 }),
      );

    await adapter.read(credentials, {
      path: "/v1/people",
      query: { limit: 25, "filter[fullName][like]": "Ada", combinator: "and" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/v1/people",
        search: "?limit=25&filter%5BfullName%5D%5Blike%5D=Ada&combinator=and",
      }),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("permits an exact approved record update", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: personId } }), {
          status: 200,
        }),
      );

    await adapter.manage(credentials, {
      method: "PATCH",
      path: `/v1/people/${personId}`,
      json: { jobTitle: "Founder" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: `/v1/people/${personId}` }),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ jobTitle: "Founder" }),
      }),
    );
  });

  it("rejects oversized cursors, unknown routes, and credential-bearing bodies", async () => {
    await expect(
      adapter.read(credentials, {
        path: "/v1/people",
        query: { cursor: "x".repeat(129) },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, { path: "/v1/campaigns" })).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/v1/notes",
        json: {
          entity: { id: personId },
          content: "Follow up",
          apiKey: "do-not-send",
        },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps provider throttling from folk's nested safe error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "slow down", signingSecret: "secret" },
        }),
        {
          status: 429,
        },
      ),
    );

    await expect(
      adapter.read(credentials, { path: "/v1/users" }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "provider_rate_limited",
        message: "slow down",
        statusCode: 429,
      }),
    );
  });
});
