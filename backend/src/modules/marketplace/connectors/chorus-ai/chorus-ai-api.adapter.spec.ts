import { ChorusAiApiAdapter, ChorusAiApiError } from "./chorus-ai-api.adapter";

describe("ChorusAiApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins a bounded engagement read and minimizes metadata", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          engagements: [
            {
              engagement_id: "eng-7",
              title: "Demo",
              start_time: "2026-07-01T10:00:00Z",
              duration: 900,
              engagement_type: "meeting",
              participants: [{ email: "private@example.com" }],
              recording: { url: "https://private.example/media" },
            },
          ],
          continuation_key: "do-not-follow",
        }),
        { status: 200 },
      ),
    );
    const result = await new ChorusAiApiAdapter().read(
      { apiToken: "customer-api-token" },
      "engagements.list",
      {
        minDate: "2026-07-01T00:00:00Z",
        maxDate: "2026-07-08T00:00:00Z",
      },
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://chorus.ai/v3/engagements?min_date=2026-07-01T00%3A00%3A00Z&max_date=2026-07-08T00%3A00%3A00Z&with_trackers=false",
      ),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "customer-api-token",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      data: [
        {
          engagement_id: "eng-7",
          title: "Demo",
          start_time: "2026-07-01T10:00:00Z",
          duration: 900,
          engagement_type: "meeting",
        },
      ],
      hasNextPage: true,
    });
  });

  it("blocks oversized ranges and broader operations", () => {
    const adapter = new ChorusAiApiAdapter();
    expect(() =>
      adapter.read({ apiToken: "token" }, "engagements.list", {
        minDate: "2026-01-01T00:00:00Z",
        maxDate: "2026-07-01T00:00:00Z",
      }),
    ).toThrow("at most 31 days");
    expect(() =>
      adapter.read({ apiToken: "token" }, "transcripts.list", {
        minDate: "2026-07-01T00:00:00Z",
        maxDate: "2026-07-08T00:00:00Z",
      }),
    ).toThrow(ChorusAiApiError);
  });
});
