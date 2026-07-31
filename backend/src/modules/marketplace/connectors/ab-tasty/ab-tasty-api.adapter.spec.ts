import { AbTastyApiAdapter, AbTastyApiError } from "./ab-tasty-api.adapter";

describe("AbTastyApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins bounded project discovery and minimizes output", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          total_count: 101,
          items: [{ id: "project-1", name: "Checkout", secret: "discard" }],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new AbTastyApiAdapter().read(
        { accessToken: "customer-token", accountId: "account_1" },
        "projects.list",
      ),
    ).resolves.toEqual({
      projects: [{ id: "project-1", name: "Checkout" }],
      truncated: true,
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://api.flagship.io/v1/accounts/account_1/projects?_page=0&_max_per_page=100",
      ),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer customer-token",
        }),
        redirect: "error",
      }),
    );
  });

  it("blocks campaign and write operations before making a request", () => {
    expect(() =>
      new AbTastyApiAdapter().read(
        { accessToken: "token", accountId: "account" },
        "campaigns.list",
      ),
    ).toThrow(AbTastyApiError);
  });
});
