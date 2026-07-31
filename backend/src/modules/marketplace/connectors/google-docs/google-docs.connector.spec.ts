import {
  GoogleDocsApiAdapter,
  GoogleDocsApiError,
} from "./google-docs-api.adapter";
import {
  GOOGLE_DOCS_CONNECTOR_MANIFEST,
  GOOGLE_DOCS_SCOPES,
} from "./google-docs.connector";

describe("Google Docs connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses exact app-file OAuth and exposes four bounded tools", () => {
    expect(GOOGLE_DOCS_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/drive.file",
    ]);
    expect(GOOGLE_DOCS_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      GOOGLE_DOCS_CONNECTOR_MANIFEST.tools
        .filter((tool) => tool.approvalRequired)
        .map((tool) => tool.functionName),
    ).toEqual([
      "google_docs_create_document",
      "google_docs_apply_document_update",
    ]);
    expect(
      GOOGLE_DOCS_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["google_docs_safe", "dangerously_skip_permissions"]);
  });

  it("reads one fixed document endpoint and bounds returned text", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            documentId: "doc_1",
            title: "Plan",
            revisionId: "rev_1",
            body: {
              content: [
                {
                  paragraph: {
                    elements: [{ textRun: { content: "abcdefghij" } }],
                  },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleDocsApiAdapter().readDocument("token", {
      documentId: "doc_1",
      maxBodyChars: 200,
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://docs.googleapis.com/v1/documents/doc_1");
    expect(init.redirect).toBe("error");
    expect(result).toMatchObject({
      document: { documentId: "doc_1", title: "Plan" },
      bodyText: "abcdefghij",
      providerRequestCount: 1,
    });
  });

  it("allows exactly one constrained change form", () => {
    const adapter = new GoogleDocsApiAdapter();
    expect(
      adapter.prepareChange({
        documentId: "doc_1",
        insertText: "hello",
        insertIndex: 2,
      }),
    ).toMatchObject({
      change: { kind: "insert_text" },
      providerRequestCount: 0,
    });
    expect(() =>
      adapter.prepareChange({
        documentId: "doc_1",
        insertText: "hello",
        findText: "old",
        replaceText: "new",
      }),
    ).toThrow(GoogleDocsApiError);
  });

  it("creates a document and inserts bounded initial text", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            documentId: "doc_2",
            title: "Plan",
            revisionId: "rev_1",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ writeControl: { requiredRevisionId: "rev_2" } }),
          { status: 200 },
        ),
      );
    const result = await new GoogleDocsApiAdapter().createDocument("token", {
      title: "Plan",
      bodyText: "hello",
      idempotencyKey: "request-123",
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      operation: "create_document",
      document: { documentId: "doc_2", revisionId: "rev_2" },
      idempotencyKey: "request-123",
      providerRequestCount: 2,
    });
  });
});
