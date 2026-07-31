import { HiveApiAdapter, HiveApiError } from "./hive-api.adapter";

describe("HiveApiAdapter", () => {
  const credentials = { apiKey: "hive_secret", userId: "user-123" };

  afterEach(() => jest.restoreAllMocks());

  it("validates credentials at Hive's fixed origin without exposing the key", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "User authenticated" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(new HiveApiAdapter().health(credentials)).resolves.toEqual({
      message: "User authenticated",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.hive.com/api/v1/testcredentials?user_id=user-123",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>).api_key,
    ).toBe("hive_secret");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("hive_secret");
  });

  it("supports current v2 reads and appends the stored user id", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ edges: [] }), { status: 200 }),
      );
    await new HiveApiAdapter().read(credentials, {
      path: "/api/v2/workspaces/workspace-1/actions",
      query: { first: 50, "filters[archived]": false },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.hive.com/api/v2/workspaces/workspace-1/actions?first=50&filters%5Barchived%5D=false&user_id=user-123",
    );
  });

  it("supports bounded writes but rejects alternate origins and credentials", async () => {
    const api = new HiveApiAdapter();
    await expect(
      api.write(credentials, {
        method: "POST",
        path: "https://evil.example/api/v2/actions",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.write(credentials, {
        method: "POST",
        path: "/api/v2/actions",
        json: { api_key: "expose" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      api.read(credentials, {
        path: "/api/v2/workspaces",
        query: { user_id: "override" },
      }),
    ).rejects.toBeInstanceOf(HiveApiError);
  });
});
