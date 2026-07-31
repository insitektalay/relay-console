import { GongApiAdapter, GongApiError } from "./gong-api.adapter";

describe("GongApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins a bounded date-range call read and minimizes metadata", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          calls: [
            {
              id: "7",
              title: "Demo",
              started: "2026-07-01T10:00:00Z",
              duration: 900,
              direction: "Conference",
              meetingUrl: "https://private.example/meeting",
              customData: "private",
            },
          ],
          records: { cursor: "do-not-follow" },
        }),
        { status: 200 },
      ),
    );
    const result = await new GongApiAdapter().read(
      "oauth-token",
      "https://company-17.api.gong.io",
      "calls.list",
      {
        fromDateTime: "2026-07-01T00:00:00Z",
        toDateTime: "2026-07-08T00:00:00Z",
      },
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://company-17.api.gong.io/v2/calls?fromDateTime=2026-07-01T00%3A00%3A00Z&toDateTime=2026-07-08T00%3A00%3A00Z",
      ),
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
    expect(result).toEqual({
      data: [
        {
          id: "7",
          title: "Demo",
          started: "2026-07-01T10:00:00Z",
          duration: 900,
          direction: "Conference",
        },
      ],
      hasNextPage: true,
    });
  });

  it("blocks untrusted hosts, oversized ranges, and broader operations", async () => {
    const adapter = new GongApiAdapter();
    await expect(
      adapter.read("token", "https://evil.example", "calls.list", {
        fromDateTime: "2026-07-01T00:00:00Z",
        toDateTime: "2026-07-08T00:00:00Z",
      }),
    ).rejects.toThrow(GongApiError);
    expect(() =>
      adapter.read("token", "https://api.gong.io", "calls.list", {
        fromDateTime: "2026-01-01T00:00:00Z",
        toDateTime: "2026-07-01T00:00:00Z",
      }),
    ).toThrow("at most 31 days");
    expect(() =>
      adapter.read("token", "https://api.gong.io", "transcripts.list", {
        fromDateTime: "2026-07-01T00:00:00Z",
        toDateTime: "2026-07-08T00:00:00Z",
      }),
    ).toThrow("pinned basic-metadata contract");
  });
});
