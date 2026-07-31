import { HabiticaApiAdapter, HabiticaApiError } from "./habitica-api.adapter";

describe("HabiticaApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  const credentials = {
    userId: "12345678-1234-1234-1234-123456789abc",
    apiToken: "api-token",
  };

  it("uses the fixed V3 origin and server-held Habitica headers", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
      }),
    );
    await new HabiticaApiAdapter().read(credentials, {
      path: "/tasks/user",
      query: { type: "todos" },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://habitica.com/api/v3/tasks/user?type=todos",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({
        "x-api-user": credentials.userId,
        "x-api-key": credentials.apiToken,
        "x-client": `${credentials.userId}-RelayConsole`,
      }),
    );
  });

  it("supports bounded JSON mutations", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    await new HabiticaApiAdapter().manage(credentials, {
      method: "POST",
      path: "/tasks/user",
      json: { type: "todo", text: "Ship" },
    });
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "todo", text: "Ship" }),
      }),
    );
  });

  it("blocks traversal, internal families, and credential-bearing input", async () => {
    const api = new HabiticaApiAdapter();
    await expect(
      api.read(credentials, { path: "/tasks/../auth" }),
    ).rejects.toBeInstanceOf(HabiticaApiError);
    await expect(
      api.read(credentials, { path: "/admin/users" }),
    ).rejects.toBeInstanceOf(HabiticaApiError);
    await expect(
      api.manage(credentials, {
        method: "POST",
        path: "/tasks/user",
        json: { apiToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts tokens and maps throttling safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { apiToken: "secret" } }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Slow down" }), {
          status: 429,
        }),
      );
    await expect(new HabiticaApiAdapter().health(credentials)).resolves.toEqual(
      {
        success: true,
        data: { apiToken: "[redacted]" },
      },
    );
    await expect(
      new HabiticaApiAdapter().health(credentials),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
