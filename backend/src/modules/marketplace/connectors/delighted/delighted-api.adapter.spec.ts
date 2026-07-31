import {
  DelightedApiAdapter,
  DelightedApiError,
} from "./delighted-api.adapter";

describe("DelightedApiAdapter", () => {
  const credentials = { apiKey: "customer-project-key" };
  afterEach(() => jest.restoreAllMocks());

  it("uses Basic authentication and bounded response paging", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "1",
              person: "10",
              score: 9,
              comment: "Great",
              permalink: "private",
              notes: [{ user_email: "private@example.com" }],
            },
          ]),
          { status: 200 },
        ),
      );
    const result = await new DelightedApiAdapter().read(
      credentials,
      "responses.list",
      { page: 2, limit: 5, order: "desc" },
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://api.delighted.com/v1/survey_responses.json?per_page=5&page=2&order=desc",
      ),
    );
    expect(String(url)).not.toContain("customer-project-key");
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("customer-project-key:").toString("base64")}`,
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual([
      { id: "1", person: "10", score: 9, comment: "Great" },
    ]);
  });

  it("pins core metrics and blocks broad inputs", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nps: 51, response_count: 10 }), {
          status: 200,
        }),
      );
    await new DelightedApiAdapter().read(credentials, "metrics.get", {
      since: 100,
      until: 200,
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL(
        "https://api.delighted.com/v1/metrics.json?since=100&until=200&groups%5B%5D=core",
      ),
    );
    const adapter = new DelightedApiAdapter();
    expect(() => adapter.read(credentials, "people.list", {})).toThrow(
      DelightedApiError,
    );
    expect(() =>
      adapter.read(credentials, "responses.list", { limit: 100 }),
    ).toThrow("integer from 1 to 25");
  });
});
