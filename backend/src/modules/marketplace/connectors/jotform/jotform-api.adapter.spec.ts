import { JotformApiAdapter, JotformApiError } from "./jotform-api.adapter";
import {
  JOTFORM_MANAGE_OPERATION_IDS,
  JOTFORM_OPERATIONS,
  JOTFORM_READ_OPERATION_IDS,
  JOTFORM_SOURCE_SHA256,
} from "./jotform-operation-registry";

describe("JotformApiAdapter", () => {
  const credentials = { apiKey: "customer-owned-key", region: "eu" as const };

  afterEach(() => jest.restoreAllMocks());

  it("pins the current non-deprecated authenticated Jotform V1 surface", () => {
    expect(JOTFORM_SOURCE_SHA256).toHaveLength(64);
    expect(JOTFORM_OPERATIONS).toHaveLength(48);
    expect(JOTFORM_READ_OPERATION_IDS.length).toBeGreaterThan(20);
    expect(JOTFORM_MANAGE_OPERATION_IDS.length).toBeGreaterThan(20);
    expect(JOTFORM_OPERATIONS.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "user.forms.list",
        "forms.questions.upsert",
        "forms.submissions.createMany",
        "forms.webhooks.delete",
        "labels.resources.add",
        "submissions.delete",
      ]),
    );
    expect(
      JOTFORM_OPERATIONS.some((item) => item.path.startsWith("/folder")),
    ).toBe(false);
    expect(JOTFORM_OPERATIONS.some((item) => item.id.includes("login"))).toBe(
      false,
    );
  });

  it("attaches the API key only as a header on the selected fixed provider region", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ responseCode: 200, apiKey: "hidden", content: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const result = await new JotformApiAdapter().read(
      credentials,
      "forms.submissions.list",
      {
        pathParameters: { formId: "123456789" },
        query: { limit: 500, offset: 0 },
      },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        "https://eu-api.jotform.com/form/123456789/submissions?limit=100&offset=0",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ APIKEY: "customer-owned-key" }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      responseCode: 200,
      apiKey: "[REDACTED]",
      content: [],
    });
  });

  it("encodes flattened Jotform form fields without accepting credentials", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ responseCode: 200 }), { status: 200 }),
      );
    await new JotformApiAdapter().manage(
      credentials,
      "forms.submissions.create",
      {
        pathParameters: { formId: "123" },
        form: { "submission[1]": "Approved", "submission[2_first]": "Ada" },
      },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://eu-api.jotform.com/form/123/submissions"),
      expect.objectContaining({
        method: "POST",
        body: "submission%5B1%5D=Approved&submission%5B2_first%5D=Ada",
      }),
    );
    expect(() =>
      new JotformApiAdapter().manage(credentials, "forms.submissions.create", {
        pathParameters: { formId: "123" },
        form: { apiKey: "never" },
      }),
    ).toThrow("Credential-bearing field apiKey is not allowed");
  });

  it("rejects unpinned operations, incomplete paths, and wrong body modes", async () => {
    const adapter = new JotformApiAdapter();
    expect(() => adapter.read(credentials, "raw.request", {})).toThrow(
      JotformApiError,
    );
    expect(() =>
      adapter.read(credentials, "forms.questions.get", {
        pathParameters: { formId: "123" },
      }),
    ).toThrow("path parameters must exactly match");
    expect(() =>
      adapter.manage(credentials, "forms.submissions.createMany", {
        pathParameters: { formId: "123" },
        form: { submission: "wrong" },
      }),
    ).toThrow("accepts JSON, not form fields");
  });
});
