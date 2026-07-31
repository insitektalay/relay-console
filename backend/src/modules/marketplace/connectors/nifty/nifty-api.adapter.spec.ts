import { NiftyApiAdapter, NiftyApiError } from "./nifty-api.adapter";

describe("NiftyApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed OpenAPI origin and bearer token for bounded reads", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ projects: [] }), { status: 200 }),
      );
    await new NiftyApiAdapter().read("access-token", {
      path: "/api/v1.0/projects",
      query: { limit: 25 },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://openapi.niftypm.com/api/v1.0/projects?limit=25",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer access-token");
  });

  it("blocks traversal and credential-bearing agent input", async () => {
    const api = new NiftyApiAdapter();
    await expect(
      api.read("token", { path: "/api/v1.0/../oauth/token" }),
    ).rejects.toBeInstanceOf(NiftyApiError);
    await expect(
      api.manage("token", {
        method: "POST",
        path: "/api/v1.0/tasks",
        json: { apiKey: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts credential-like fields in provider responses", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "task-1", access_token: "secret" }), {
          status: 200,
        }),
      );
    await expect(new NiftyApiAdapter().health("token")).resolves.toEqual({
      id: "task-1",
      access_token: "[redacted]",
    });
  });
});
