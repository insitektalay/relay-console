import { UnbounceApiAdapter, UnbounceApiError } from "./unbounce-api.adapter";

describe("UnbounceApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins a bounded page list and removes lead and integration metadata", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pages: [
            {
              id: "page-1",
              name: "Spring campaign",
              state: "published",
              domain: "pages.example.com",
              integrations: [{ id: "private-integration" }],
              metadata: { related: { leads: "https://example.invalid/leads" } },
            },
          ],
          metadata: { count: 1 },
        }),
        { status: 200 },
      ),
    );
    await expect(
      new UnbounceApiAdapter().read(
        { apiKey: "customer-api-key" },
        "pages.list",
      ),
    ).resolves.toEqual({
      pages: [
        {
          id: "page-1",
          name: "Spring campaign",
          state: "published",
          domain: "pages.example.com",
        },
      ],
      truncated: false,
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(new URL("https://api.unbounce.com/pages?limit=100"));
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/vnd.unbounce.api.v0.4+json",
          Authorization: `Basic ${Buffer.from("customer-api-key:").toString("base64")}`,
        }),
        redirect: "error",
      }),
    );
  });

  it("blocks lead and write operations before making a request", () => {
    expect(() =>
      new UnbounceApiAdapter().read({ apiKey: "key" }, "leads.list"),
    ).toThrow(UnbounceApiError);
  });
});
