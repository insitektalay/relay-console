import { DrataApiAdapter, DrataApiError } from "./drata-api.adapter";

const credentials = { region: "eu", workspaceId: "42", apiKey: "key" };

describe("DrataApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the regional workspace and minimizes a bounded framework page", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 123,
              name: "SOC 2",
              description: "hidden",
              slug: "soc-2",
              tag: "SOC_2",
              isReady: true,
              isEnabled: true,
              numInScopeControls: 42,
              activeLogo: "https://private.example/logo.svg",
            },
          ],
          pagination: { cursor: "cursor_2", totalCount: 100 },
        }),
        { status: 200 },
      ),
    );

    await expect(
      new DrataApiAdapter().read(credentials, {
        operation: "frameworks.list",
        size: 20,
        cursor: "cursor_1",
      }),
    ).resolves.toEqual({
      frameworks: [
        {
          id: 123,
          name: "SOC 2",
          slug: "soc-2",
          tag: "SOC_2",
          isReady: true,
          isEnabled: true,
        },
      ],
      size: 20,
      nextCursor: "cursor_2",
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://public-api.eu.drata.com/public/v2/workspaces/42/frameworks?size=20&cursor=cursor_1",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
      }),
    );
  });

  it("rejects invalid binding values, arbitrary operations, and oversized pages", async () => {
    const adapter = new DrataApiAdapter();
    await expect(
      adapter.read(
        { ...credentials, region: "uk" },
        { operation: "frameworks.list" },
      ),
    ).rejects.toBeInstanceOf(DrataApiError);
    await expect(
      adapter.read(
        { ...credentials, workspaceId: "../1" },
        { operation: "frameworks.list" },
      ),
    ).rejects.toBeInstanceOf(DrataApiError);
    await expect(
      adapter.read(credentials, { operation: "controls.list" }),
    ).rejects.toBeInstanceOf(DrataApiError);
    await expect(
      adapter.read(credentials, { operation: "frameworks.list", size: 21 }),
    ).rejects.toBeInstanceOf(DrataApiError);
  });
});
