import {
  MailchimpSurveysApiAdapter,
  MailchimpSurveysApiError,
  type MailchimpSurveysCredentials,
} from "./mailchimp-surveys-api.adapter";

describe("MailchimpSurveysApiAdapter", () => {
  const credentials: MailchimpSurveysCredentials = {
    accessToken: "oauth-token",
    apiOrigin: "https://us21.api.mailchimp.com",
    accountId: "a".repeat(32),
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins collection reads to the metadata-derived origin and first 25 rows", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ surveys: [] }), { status: 200 }),
      );
    await new MailchimpSurveysApiAdapter().execute(
      credentials,
      "list_surveys",
      { listId: "list_1" },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://us21.api.mailchimp.com/3.0/lists/list_1/surveys?count=25&offset=0",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer oauth-token");
  });

  it("rejects unknown operations and invalid identifiers", async () => {
    const adapter = new MailchimpSurveysApiAdapter();
    expect(() => adapter.execute(credentials, "raw", {})).toThrow(
      MailchimpSurveysApiError,
    );
    expect(() =>
      adapter.execute(credentials, "get_response", {
        surveyId: "ok",
        responseId: "../../escape",
      }),
    ).toThrow(MailchimpSurveysApiError);
  });

  it("uses empty POST bodies only for pinned survey actions", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "survey-1" }), { status: 200 }),
      );
    await new MailchimpSurveysApiAdapter().execute(credentials, "publish", {
      listId: "list_1",
      surveyId: "survey_1",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://us21.api.mailchimp.com/3.0/lists/list_1/surveys/survey_1/actions/publish",
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0][1]?.body).toBe("{}");
  });
});
