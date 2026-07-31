import { HotjarApiAdapter, HotjarApiError } from "./hotjar-api.adapter";

describe("HotjarApiAdapter", () => {
  const credentials = {
    clientId: "customer-client",
    clientSecret: "customer-secret",
    siteId: "12345",
  };
  afterEach(() => jest.restoreAllMocks());

  it("exchanges client credentials and minimizes bounded responses", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "temporary-access",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: "response_1",
                answers: [{ question_id: "q1", answer: "Great" }],
                created_time: "2026-07-17T10:00:00Z",
                is_complete: true,
                hotjar_user_id: "private",
                recording_url: "private",
                response_origin_url: "private",
                user_attributes: [
                  { name: "email", value: "private@example.com" },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new HotjarApiAdapter().read(
      credentials,
      "responses.list",
      { surveyId: "survey_12345678-1234-4234-9234-123456789abc", limit: 5 },
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://api.hotjar.io/v1/oauth/token",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: "customer-client",
          client_secret: "customer-secret",
        }),
        redirect: "error",
      }),
    );
    expect(fetchSpy.mock.calls[1]?.[0]).toEqual(
      new URL(
        "https://api.hotjar.io/v1/sites/12345/surveys/survey_12345678-1234-4234-9234-123456789abc/responses?limit=5",
      ),
    );
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer temporary-access",
        }),
      }),
    );
    expect(result).toEqual({
      results: [
        {
          id: "response_1",
          answers: [{ question_id: "q1", answer: "Great" }],
          created_time: "2026-07-17T10:00:00Z",
          is_complete: true,
        },
      ],
    });
  });

  it("pins list expansion and blocks user lookup and oversized pages", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "temporary-access" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );
    await new HotjarApiAdapter().read(credentials, "surveys.list", {
      limit: 10,
    });
    expect(fetchSpy.mock.calls[1]?.[0]).toEqual(
      new URL(
        "https://api.hotjar.io/v1/sites/12345/surveys?limit=10&with_questions=false",
      ),
    );
    const adapter = new HotjarApiAdapter();
    expect(adapter.read(credentials, "user.lookup", {})).rejects.toBeInstanceOf(
      HotjarApiError,
    );
    await expect(
      adapter.read(credentials, "surveys.list", { limit: 100 }),
    ).rejects.toThrow("integer from 1 to 25");
  });
});
