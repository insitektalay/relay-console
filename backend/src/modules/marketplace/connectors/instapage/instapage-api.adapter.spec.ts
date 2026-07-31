import {
  InstapageApiAdapter,
  InstapageApiError,
} from "./instapage-api.adapter";

describe("InstapageApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the first workspace page and removes owner and creation metadata", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              workspaceId: 1177,
              ownerId: 1319,
              workspaceName: "Campaigns",
              accessLevel: "viewer",
              createdAt: 1262304000,
            },
          ],
          meta: {
            pagination: { currentPage: 1, totalPagesCount: 2 },
          },
        }),
        { status: 200 },
      ),
    );
    await expect(
      new InstapageApiAdapter().read(
        { apiToken: "customer-api-token" },
        "workspaces.list",
      ),
    ).resolves.toEqual({
      workspaces: [{ id: "1177", name: "Campaigns", accessLevel: "viewer" }],
      truncated: true,
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL("https://api.instapage.com/v1/workspaces?page=1"),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer customer-api-token",
        }),
        redirect: "error",
      }),
    );
  });

  it("blocks page, lead, and mutation operations before making a request", () => {
    expect(() =>
      new InstapageApiAdapter().read({ apiToken: "token" }, "pages.list"),
    ).toThrow(InstapageApiError);
  });
});
