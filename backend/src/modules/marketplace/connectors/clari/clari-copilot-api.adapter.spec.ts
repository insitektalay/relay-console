import {
  ClariCopilotApiAdapter,
  ClariCopilotApiError,
} from "./clari-copilot-api.adapter";

describe("ClariCopilotApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins a bounded public-call metadata read and strips people", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          calls: [
            {
              id: "call-7",
              title: "Demo",
              status: "POST_PROCESSING_DONE",
              type: "ZOOM",
              time: "2026-07-01T10:00:00Z",
              duration: 900,
              users: [{ userEmail: "private@example.com" }],
              externalParticipants: [{ email: "buyer@example.com" }],
              audio: "https://private.example/audio",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new ClariCopilotApiAdapter().read(
      { apiKey: "customer-key", apiPassword: "customer-password" },
      "calls.list",
      {
        fromDateTime: "2026-07-01T00:00:00Z",
        toDateTime: "2026-07-08T00:00:00Z",
      },
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://rest-api.copilot.clari.com/calls?skip=0&limit=25&filterTimeGt=2026-07-01T00%3A00%3A00Z&filterTimeLt=2026-07-08T00%3A00%3A00Z&sortTime=desc&includePrivate=false&includeAudio=false&includeVideo=false&includePagination=false",
      ),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "X-Api-Key": "customer-key",
          "X-Api-Password": "customer-password",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      data: [
        {
          id: "call-7",
          title: "Demo",
          status: "POST_PROCESSING_DONE",
          type: "ZOOM",
          time: "2026-07-01T10:00:00Z",
          duration: 900,
        },
      ],
      hasNextPage: false,
    });
  });

  it("blocks oversized ranges and broader operations", () => {
    const adapter = new ClariCopilotApiAdapter();
    expect(() =>
      adapter.read({ apiKey: "key", apiPassword: "password" }, "calls.list", {
        fromDateTime: "2026-01-01T00:00:00Z",
        toDateTime: "2026-07-01T00:00:00Z",
      }),
    ).toThrow("at most 31 days");
    expect(() =>
      adapter.read(
        { apiKey: "key", apiPassword: "password" },
        "call-details.read",
        {
          fromDateTime: "2026-07-01T00:00:00Z",
          toDateTime: "2026-07-08T00:00:00Z",
        },
      ),
    ).toThrow(ClariCopilotApiError);
  });
});
