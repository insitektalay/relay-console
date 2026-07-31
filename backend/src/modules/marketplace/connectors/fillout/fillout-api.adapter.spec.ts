import { FilloutApiAdapter } from "./fillout-api.adapter";

const credentials = {
  accessToken: "private-fillout-access-token",
  baseUrl: "https://eu-api.fillout.com",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestedUrl(request: jest.Mock) {
  return (request.mock.calls[0] as unknown as [string, RequestInit])[0];
}

describe("FilloutApiAdapter", () => {
  it("uses the provider-returned regional origin for health", async () => {
    const request = jest.fn(async () => response([]));
    const result = await new FilloutApiAdapter(request).health(credentials);
    expect(requestedUrl(request)).toBe(
      "https://eu-api.fillout.com/v1/api/forms",
    );
    expect(result).toMatchObject({ visibleFormCount: 0, reachable: true });
  });

  it("returns only bounded Form IDs and names", async () => {
    const request = jest.fn(async () =>
      response([
        {
          formId: "form_abc123",
          name: "Customer intake",
          questions: [{ name: "Private question" }],
        },
      ]),
    );
    const result = await new FilloutApiAdapter(request).listForms(credentials);
    expect(result.forms).toEqual([
      { formId: "form_abc123", name: "Customer intake" },
    ]);
    expect(JSON.stringify(result)).not.toContain("Private question");
  });

  it("returns structural Form counts without schema content", async () => {
    const request = jest.fn(async () =>
      response({
        id: "form_abc123",
        name: "Customer intake",
        questions: [{ name: "Private question" }, { name: "Private email" }],
        calculations: [{ name: "Private calculation" }],
        urlParameters: [{ name: "private_parameter" }],
        scheduling: [],
        payments: [],
        quiz: { enabled: true, score: 100 },
      }),
    );
    const result = await new FilloutApiAdapter(request).getFormMetadata(
      credentials,
      { formId: "form_abc123" },
    );
    expect(requestedUrl(request)).toBe(
      "https://eu-api.fillout.com/v1/api/forms/form_abc123",
    );
    expect(result.form).toEqual({
      formId: "form_abc123",
      name: "Customer intake",
      questionCount: 2,
      calculationCount: 1,
      urlParameterCount: 1,
      schedulingFieldCount: 0,
      paymentFieldCount: 0,
      quizEnabled: true,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
  });

  it("fixes the recent submission query and strips response content", async () => {
    const request = jest.fn(async () =>
      response({
        responses: [
          {
            submissionId: "sub_987654",
            submissionTime: "2026-07-11T09:00:00Z",
            lastUpdatedAt: "2026-07-11T09:01:00Z",
            questions: [{ value: "private answer" }],
            login: { email: "private@example.com" },
            editLink: "https://private.example",
          },
        ],
      }),
    );
    const result = await new FilloutApiAdapter(request).listRecentSubmissions(
      credentials,
      { formId: "form_abc123" },
    );
    expect(requestedUrl(request)).toBe(
      "https://eu-api.fillout.com/v1/api/forms/form_abc123/submissions?limit=25&offset=0&status=finished&includeEditLink=false&includePreview=false&sort=desc",
    );
    expect(result.submissions).toEqual([
      {
        submissionId: "sub_987654",
        submissionTime: "2026-07-11T09:00:00Z",
        lastUpdatedAt: "2026-07-11T09:01:00Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects unsafe IDs and unsupported origins before network access", async () => {
    const request = jest.fn();
    const adapter = new FilloutApiAdapter(request);
    await expect(
      adapter.getFormMetadata(credentials, { formId: "form/details" }),
    ).rejects.toMatchObject({ code: "fillout_form_identifier_invalid" });
    await expect(
      adapter.health({ ...credentials, baseUrl: "https://example.com" }),
    ).rejects.toMatchObject({ code: "fillout_base_url_invalid" });
    expect(request).not.toHaveBeenCalled();
  });
});
