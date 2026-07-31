import { SprigApiAdapter, SprigApiError } from "./sprig-api.adapter";

describe("SprigApiAdapter", () => {
  const credentials = { apiKey: "customer-export-key" };
  afterEach(() => jest.restoreAllMocks());

  it("uses Bearer auth and minimizes a bounded study index", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cursor: "private-cursor",
          data: [
            {
              id: 12,
              name: "Checkout study",
              status: "IN_PROGRESS",
              platform: "web",
              type: "CONTINUOUS",
              createdAt: "2026-01-01T00:00:00Z",
              questions: [{ questionText: "Private question" }],
              constraints: [{ event: "private" }],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new SprigApiAdapter().read(
      credentials,
      "studies.list",
      { limit: 5 },
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL("https://api.sprig.com/v1/surveys?limit=5"),
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer customer-export-key",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      data: [
        {
          id: 12,
          name: "Checkout study",
          status: "IN_PROGRESS",
          platform: "web",
          type: "CONTINUOUS",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    });
  });

  it("blocks response, theme, user, and purge APIs", () => {
    expect(() =>
      new SprigApiAdapter().read(credentials, "responses.list", {}),
    ).toThrow(SprigApiError);
    expect(() =>
      new SprigApiAdapter().read(credentials, "studies.list", {
        limit: 26,
      }),
    ).toThrow("1 to 25");
  });
});
