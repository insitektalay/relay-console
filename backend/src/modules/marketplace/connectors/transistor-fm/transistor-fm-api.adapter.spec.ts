import { TransistorFmApiAdapter } from "./transistor-fm-api.adapter";
const credentials = { apiKey: "customer-key", showId: "132543" };
describe("TransistorFmApiAdapter", () => {
  it("uses header-only auth and redacts private show authority", async () => {
    const request = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            data: {
              id: "132543",
              type: "show",
              attributes: {
                title: "Bound",
                private: true,
                owner_email: "private@example.com",
                feed_url: "https://private.example/rss",
              },
            },
          }),
          { status: 200 },
        ),
    );
    const result = await new TransistorFmApiAdapter(request).health(
      credentials,
    );
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(request.mock.calls[0][0]).toBe(
      "https://api.transistor.fm/v1/shows/132543",
    );
    expect(request.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ "x-api-key": "customer-key" }),
    );
  });
  it("fails closed when an episode belongs to another show", async () => {
    const adapter = new TransistorFmApiAdapter(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            data: {
              id: "99",
              attributes: {},
              relationships: { show: { data: { id: "different" } } },
            },
          }),
          { status: 200 },
        ),
    );
    await expect(
      adapter.getEpisode(credentials, { episodeId: "99" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
  it("binds and bounds episode listing", async () => {
    const request = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "1",
                attributes: {
                  title: "Draft",
                  status: "draft",
                  transcript_text: "secret transcript",
                },
              },
            ],
            meta: { totalCount: 1 },
          }),
          { status: 200 },
        ),
    );
    const result = await new TransistorFmApiAdapter(request).listEpisodes(
      credentials,
      { status: "draft", perPage: 5 },
    );
    expect(JSON.stringify(result)).not.toContain("secret transcript");
    expect(request.mock.calls[0][0]).toContain("show_id=132543");
    expect(request.mock.calls[0][0]).toContain("pagination%5Bper%5D=5");
  });
  it("rejects analytics periods beyond 366 days", async () => {
    const adapter = new TransistorFmApiAdapter();
    await expect(
      adapter.getAnalytics(credentials, {
        scope: "show",
        startDate: "01-01-2024",
        endDate: "02-01-2025",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
