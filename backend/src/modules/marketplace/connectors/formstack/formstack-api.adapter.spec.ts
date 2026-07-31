import {
  FormstackApiAdapter,
  FormstackApiError,
} from "./formstack-api.adapter";
import {
  FORMSTACK_MANAGE_OPERATION_IDS,
  FORMSTACK_OPERATIONS,
  FORMSTACK_READ_OPERATION_IDS,
  FORMSTACK_SOURCE_SHA256,
} from "./formstack-operation-registry";

describe("FormstackApiAdapter", () => {
  const credentials = { personalAccessToken: "fs_pat_customer-owned-token" };
  afterEach(() => jest.restoreAllMocks());

  it("pins the official JSON V2025 surface and excludes binary and onboarding internals", () => {
    expect(FORMSTACK_SOURCE_SHA256).toHaveLength(64);
    expect(FORMSTACK_OPERATIONS).toHaveLength(90);
    expect(FORMSTACK_READ_OPERATION_IDS).toHaveLength(34);
    expect(FORMSTACK_MANAGE_OPERATION_IDS).toHaveLength(56);
    expect(FORMSTACK_OPERATIONS.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "getFormsList",
        "createSubmission",
        "deletePartialSubmission",
        "createPortalUser",
        "getWebhookOpenApi",
      ]),
    );
    expect(
      FORMSTACK_OPERATIONS.some((item) => item.id.includes("Copilot")),
    ).toBe(false);
    expect(
      FORMSTACK_OPERATIONS.some((item) => item.id === "getSubmissionUpload"),
    ).toBe(false);
  });

  it("uses the fixed V2025 origin, bearer PAT, bounded pagination, and redaction", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ forms: [], personalAccessToken: "hidden" }),
          { status: 200 },
        ),
      );
    const result = await new FormstackApiAdapter().read(
      credentials,
      "getFormsList",
      { query: { pageNumber: 1, pageSize: 500 } },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        "https://www.formstack.com/api/v2025/forms?pageNumber=1&pageSize=100",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer fs_pat_customer-owned-token",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({ forms: [], personalAccessToken: "[REDACTED]" });
  });

  it("dispatches JSON mutations and rejects credential-bearing or unpinned input", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 42 }), { status: 200 }),
      );
    await new FormstackApiAdapter().manage(credentials, "editForm", {
      pathParameters: { formId: 42 },
      json: { name: "Updated intake" },
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://www.formstack.com/api/v2025/forms/42"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ name: "Updated intake" }),
      }),
    );
    expect(() =>
      new FormstackApiAdapter().manage(credentials, "editForm", {
        pathParameters: { formId: 42 },
        json: { accessToken: "never" },
      }),
    ).toThrow("Credential-bearing field accessToken is not allowed");
    expect(() =>
      new FormstackApiAdapter().read(credentials, "raw.request", {}),
    ).toThrow(FormstackApiError);
  });

  it("requires exact path parameters and refuses JSON bodies on reads", () => {
    const adapter = new FormstackApiAdapter();
    expect(() =>
      adapter.read(credentials, "getFieldDetails", {
        pathParameters: { formId: 1 },
      }),
    ).toThrow("path parameters must exactly match");
    expect(() =>
      adapter.read(credentials, "getFormsList", { json: { hidden: true } }),
    ).toThrow("read operations do not accept a JSON body");
  });
});
