import { AlchemerApiAdapter, AlchemerApiError } from "./alchemer-api.adapter";

describe("AlchemerApiAdapter", () => {
  const credentials = {
    region: "eu" as const,
    consumerKey: "consumer-key",
    consumerSecret: "consumer-secret",
    accessToken: "access-token",
    accessTokenSecret: "access-token-secret",
  };

  afterEach(() => jest.restoreAllMocks());

  it("signs bounded reads in the Authorization header without URL credentials", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result_ok: true, data: [] }), {
          status: 200,
        }),
      );
    await new AlchemerApiAdapter().read(credentials, "surveys.list", {
      page: 2,
      limit: 5,
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL("https://api.alchemer.eu/v5/survey?page=2&resultsperpage=5"),
    );
    expect(String(url)).not.toContain("consumer-key");
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: expect.stringContaining(
            'oauth_signature_method="HMAC-SHA1"',
          ),
        }),
        redirect: "error",
      }),
    );
  });

  it("minimizes response lists to metadata", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result_ok: true,
          data: [
            {
              id: "9",
              survey_id: "7",
              status: "Complete",
              date_submitted: "2026-07-17",
              survey_data: { email: "private@example.com" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new AlchemerApiAdapter().read(credentials, "responses.list", {
        surveyId: 7,
      }),
    ).resolves.toEqual({
      result_ok: true,
      data: [
        {
          id: "9",
          survey_id: "7",
          status: "Complete",
          date_submitted: "2026-07-17",
        },
      ],
    });
  });

  it("blocks arbitrary operations and unbounded lists", () => {
    const adapter = new AlchemerApiAdapter();
    expect(() => adapter.read(credentials, "raw.request", {})).toThrow(
      AlchemerApiError,
    );
    expect(() =>
      adapter.read(credentials, "surveys.list", { limit: 26 }),
    ).toThrow("integer from 1 to 25");
  });
});
