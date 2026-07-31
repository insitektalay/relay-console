import {
  GoogleFormsApiAdapter,
  GoogleFormsApiError,
} from "./google-forms-api.adapter";
import {
  GOOGLE_FORMS_CONNECTOR_MANIFEST,
  GOOGLE_FORMS_SCOPES,
} from "./google-forms.connector";
describe("Google Forms connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses exact app-file OAuth and exposes four response-free tools", () => {
    expect(GOOGLE_FORMS_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/drive.file",
    ]);
    expect(GOOGLE_FORMS_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      GOOGLE_FORMS_CONNECTOR_MANIFEST.tools
        .filter((t) => t.approvalRequired)
        .map((t) => t.functionName),
    ).toEqual(["google_forms_form_create", "google_forms_question_create"]);
  });
  it("returns structure while excluding responses and linked data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            formId: "form_1",
            info: { title: "Intake" },
            items: [],
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleFormsApiAdapter().getForm("token", {
      formId: "form_1",
    });
    expect(result).toMatchObject({
      form: {
        formId: "form_1",
        responsesReturned: false,
        linkedSheetIdReturned: false,
      },
      respondentDataReturned: false,
      providerRequestCount: 1,
    });
  });
  it("rejects response-like and non-allowlisted preparation operations", () => {
    expect(() =>
      new GoogleFormsApiAdapter().prepareUpdate({
        operation: "responses_get",
        title: "No",
      }),
    ).toThrow(GoogleFormsApiError);
  });
  it("creates one unpublished form", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ formId: "form_2", info: { title: "Intake" } }),
          { status: 200 },
        ),
      );
    const result = await new GoogleFormsApiAdapter().createForm("token", {
      title: "Intake",
      idempotencyKey: "request-123",
    });
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe("https://forms.googleapis.com/v1/forms?unpublished=true");
    expect(result).toMatchObject({
      operation: "create_unpublished_form",
      unpublished: true,
      idempotencyKey: "request-123",
    });
  });
});
