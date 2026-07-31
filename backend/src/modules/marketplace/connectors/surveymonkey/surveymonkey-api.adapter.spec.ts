import { SurveyMonkeyApiAdapter } from "./surveymonkey-api.adapter";

const credentials = {
  accessToken: "private-surveymonkey-access-token",
  accessUrl: "https://api.eu.surveymonkey.com",
  userId: "123456789",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SurveyMonkeyApiAdapter", () => {
  it("uses the exact regional user binding for health", async () => {
    const request = jest.fn(async () => response({ id: "123456789" }));
    const result = await new SurveyMonkeyApiAdapter(request).health(
      credentials,
    );
    expect((request.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      "https://api.eu.surveymonkey.com/v3/users/me",
    );
    expect(result).toMatchObject({ userId: "123456789", reachable: true });
  });

  it("lists one fixed page of recent survey metadata only", async () => {
    const request = jest.fn(async () =>
      response({
        data: [
          {
            id: "11",
            title: "Feedback",
            nickname: "Q3",
            language: "en",
            response_count: 42,
            date_created: "2026-07-01T09:00:00Z",
            date_modified: "2026-07-11T09:00:00Z",
            owner: "private-owner",
            href: "https://private.example",
          },
        ],
      }),
    );
    const result = await new SurveyMonkeyApiAdapter(request).listRecentSurveys(
      credentials,
    );
    expect((request.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      "https://api.eu.surveymonkey.com/v3/surveys?page=1&per_page=25&sort_by=date_modified&sort_order=DESC&include=response_count%2Cdate_created%2Cdate_modified%2Clanguage",
    );
    expect(result.surveys[0]).toEqual({
      surveyId: "11",
      title: "Feedback",
      nickname: "Q3",
      language: "en",
      responseCount: 42,
      createdAt: "2026-07-01T09:00:00Z",
      modifiedAt: "2026-07-11T09:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("private-owner");
    expect(JSON.stringify(result)).not.toContain("private.example");
  });

  it("returns response metadata without content or identity", async () => {
    const request = jest.fn(async () =>
      response({
        id: "987654321",
        response_status: "completed",
        date_created: "2026-07-11T08:59:00Z",
        date_modified: "2026-07-11T09:00:00Z",
        ip_address: "192.0.2.1",
        recipient_id: "private-recipient",
        pages: [{ answers: [{ text: "private answer" }] }],
      }),
    );
    const result = await new SurveyMonkeyApiAdapter(request).getResponse(
      credentials,
      { surveyId: "123456789", responseId: "987654321" },
    );
    expect((request.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      "https://api.eu.surveymonkey.com/v3/surveys/123456789/responses/987654321",
    );
    expect(result.response).toEqual({
      responseId: "987654321",
      status: "completed",
      createdAt: "2026-07-11T08:59:00Z",
      modifiedAt: "2026-07-11T09:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects unsafe IDs and non-provider origins before network access", async () => {
    const request = jest.fn();
    const adapter = new SurveyMonkeyApiAdapter(request);
    await expect(
      adapter.listResponses(credentials, { surveyId: "11/details" }),
    ).rejects.toMatchObject({ code: "surveymonkey_identifier_invalid" });
    await expect(
      adapter.health({ ...credentials, accessUrl: "https://example.com" }),
    ).rejects.toMatchObject({ code: "surveymonkey_access_url_invalid" });
    expect(request).not.toHaveBeenCalled();
  });
});
