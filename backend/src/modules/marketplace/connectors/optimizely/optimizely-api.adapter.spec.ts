import {
  OptimizelyApiAdapter,
  OptimizelyApiError,
} from "./optimizely-api.adapter";

describe("OptimizelyApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the first project page and removes account and snippet details", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 21014920239,
            account_id: 5935064,
            name: "Website",
            platform: "web",
            status: "active",
            web_snippet: { code_revision: 6281 },
          },
        ]),
        { status: 200, headers: { link: "<next>; rel=next" } },
      ),
    );
    await expect(
      new OptimizelyApiAdapter().read("oauth-token", "projects.list"),
    ).resolves.toEqual({
      projects: [
        {
          id: "21014920239",
          name: "Website",
          platform: "web",
          status: "active",
        },
      ],
      truncated: true,
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL("https://api.optimizely.com/v2/projects?page=1&per_page=100"),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-token",
        }),
        redirect: "error",
      }),
    );
  });

  it("blocks experiment and write operations before making a request", () => {
    expect(() =>
      new OptimizelyApiAdapter().read("token", "experiments.list"),
    ).toThrow(OptimizelyApiError);
  });
});
