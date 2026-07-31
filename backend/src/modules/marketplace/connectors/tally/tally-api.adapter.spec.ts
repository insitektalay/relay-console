import { TallyApiAdapter } from "./tally-api.adapter";

const credentials = { apiKey: "tly-private-test-key" };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestCall(request: jest.Mock) {
  return request.mock.calls[0] as unknown as [string, RequestInit];
}

describe("TallyApiAdapter", () => {
  it("validates the exact current user with the pinned API version", async () => {
    const request = jest.fn(async () =>
      response({
        id: "user_123",
        fullName: "Relay User",
        email: "private@example.com",
        organizationId: "org_123",
        subscriptionPlan: "PRO",
      }),
    );
    const result = await new TallyApiAdapter(request).health(credentials);
    const [url, init] = requestCall(request);
    expect(url).toBe("https://api.tally.so/users/me");
    expect(init.headers).toMatchObject({ "tally-version": "2025-02-01" });
    expect(result).toMatchObject({
      userId: "user_123",
      organizationId: "org_123",
      reachable: true,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("lists one fixed page of Form metadata without payments", async () => {
    const request = jest.fn(async () =>
      response({
        items: [
          {
            id: "form_123",
            name: "Customer feedback",
            workspaceId: "workspace_123",
            status: "PUBLISHED",
            numberOfSubmissions: 42,
            isClosed: false,
            createdAt: "2026-07-01T09:00:00Z",
            updatedAt: "2026-07-11T09:00:00Z",
            payments: [{ amount: 1200, currency: "GBP" }],
          },
        ],
      }),
    );
    const result = await new TallyApiAdapter(request).listForms(credentials);
    expect(requestCall(request)[0]).toBe(
      "https://api.tally.so/forms?page=1&limit=25",
    );
    expect(result.forms[0]).toEqual({
      formId: "form_123",
      name: "Customer feedback",
      workspaceId: "workspace_123",
      status: "PUBLISHED",
      numberOfSubmissions: 42,
      isClosed: false,
      createdAt: "2026-07-01T09:00:00Z",
      updatedAt: "2026-07-11T09:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("GBP");
  });

  it("strips questions, responses, previews, PDFs, and respondent identity", async () => {
    const request = jest.fn(async () =>
      response({
        questions: [{ title: "Private question" }],
        submissions: [
          {
            id: "submission_123",
            formId: "form_123",
            isCompleted: true,
            submittedAt: "2026-07-11T09:00:00Z",
            createdAt: "2026-07-11T08:59:00Z",
            updatedAt: "2026-07-11T09:00:01Z",
            previewUrl: "https://private.example/preview",
            pdfUrl: "https://private.example/file.pdf",
            responses: [
              { answer: "private answer", respondentId: "respondent_1" },
            ],
          },
        ],
      }),
    );
    const result = await new TallyApiAdapter(request).listSubmissions(
      credentials,
      { formId: "form_123" },
    );
    expect(requestCall(request)[0]).toBe(
      "https://api.tally.so/forms/form_123/submissions?page=1&limit=25&filter=completed",
    );
    expect(result.submissions[0]).toEqual({
      submissionId: "submission_123",
      formId: "form_123",
      isCompleted: true,
      submittedAt: "2026-07-11T09:00:00Z",
      createdAt: "2026-07-11T08:59:00Z",
      updatedAt: "2026-07-11T09:00:01Z",
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("respondent_1");
  });

  it("rejects unsafe IDs and malformed keys before network access", async () => {
    const request = jest.fn();
    const adapter = new TallyApiAdapter(request);
    await expect(
      adapter.getForm(credentials, { formId: "form/details" }),
    ).rejects.toMatchObject({ code: "tally_form_identifier_invalid" });
    await expect(
      adapter.health({ apiKey: "not-a-tally-key" }),
    ).rejects.toMatchObject({ code: "tally_api_key_invalid" });
    expect(request).not.toHaveBeenCalled();
  });
});
