import {
  GoogleSlidesApiAdapter,
  GoogleSlidesApiError,
} from "./google-slides-api.adapter";
import {
  GOOGLE_SLIDES_CONNECTOR_MANIFEST,
  GOOGLE_SLIDES_SCOPES,
} from "./google-slides.connector";

describe("Google Slides connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses exact app-file OAuth and exposes five bounded tools", () => {
    expect(GOOGLE_SLIDES_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/drive.file",
    ]);
    expect(GOOGLE_SLIDES_CONNECTOR_MANIFEST.tools).toHaveLength(5);
    expect(
      GOOGLE_SLIDES_CONNECTOR_MANIFEST.tools
        .filter((tool) => tool.approvalRequired)
        .map((tool) => tool.functionName),
    ).toEqual(["google_slides_text_replace", "google_slides_slide_create"]);
  });
  it("reads bounded semantic text without media or design resources", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            presentationId: "deck_1",
            title: "Plan",
            slides: [
              {
                objectId: "slide_1",
                pageElements: [
                  {
                    shape: {
                      text: {
                        textElements: [{ textRun: { content: "Relay ready" } }],
                      },
                    },
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleSlidesApiAdapter().getPresentation("token", {
      presentationId: "deck_1",
    });
    expect(result).toMatchObject({
      presentation: {
        presentationId: "deck_1",
        slideCount: 1,
        slides: [{ semanticText: "Relay ready", mediaBytesReturned: false }],
      },
      providerRequestCount: 1,
    });
  });
  it("rejects non-allowlisted preparation operations", () => {
    expect(() =>
      new GoogleSlidesApiAdapter().prepareUpdate({
        presentationId: "deck_1",
        operation: "delete_slide",
      }),
    ).toThrow(GoogleSlidesApiError);
  });
  it("pins text replacement to one atomic typed batch request", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            presentationId: "deck_1",
            replies: [{}],
            writeControl: { requiredRevisionId: "rev_2" },
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleSlidesApiAdapter().replaceText("token", {
      presentationId: "deck_1",
      matchText: "old",
      replacementText: "new",
      idempotencyKey: "request-123",
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://slides.googleapis.com/v1/presentations/deck_1:batchUpdate",
    );
    expect(JSON.parse(String(init.body)).requests).toHaveLength(1);
    expect(result).toMatchObject({
      operation: "replace_text",
      replyCount: 1,
      idempotencyKey: "request-123",
      providerRequestCount: 1,
    });
  });
});
