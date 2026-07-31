import { SignNowApiAdapter, SignNowApiError } from "./signnow-api.adapter";
import { SIGNNOW_CONNECTOR_MANIFEST } from "./signnow.connector";

describe("SignNow connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("declares the provider's broad scope honestly and exposes only bounded reads", () => {
    expect(SIGNNOW_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual([
      "*",
    ]);
    expect(SIGNNOW_CONNECTOR_MANIFEST.auth.oauth?.pkce).toBe(false);
    expect(SIGNNOW_CONNECTOR_MANIFEST.tools).toHaveLength(2);
    expect(
      SIGNNOW_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && !tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("lists at most 25 summaries and strips people, content, and signing data", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          documents: Array.from({ length: 30 }, (_, index) => ({
            id: `document_${index}`,
            document_name: `Agreement ${index}`,
            page_count: 2,
            created: 1_700_000_000,
            signatures: [{ email: "private@example.com" }],
            thumbnails: [{ link: "https://private.example/page" }],
            field_invites: [{ email: "recipient@example.com" }],
          })),
        }),
        { status: 200 },
      ),
    );
    const result = await new SignNowApiAdapter().listDocuments("token", {
      resultLimit: 25,
    });
    expect(new URL(String(fetchMock.mock.calls[0][0])).toString()).toBe(
      "https://api.signnow.com/user/documentsv2",
    );
    expect(result.documents).toHaveLength(25);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("recipient@example.com");
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(result).toMatchObject({
      providerScope: "*",
      providerScopeIsBroad: true,
      automaticPagination: false,
    });
  });

  it("reads one fixed document path and returns only lifecycle metadata", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "abc_123",
          document_name: "NDA",
          document_status: "fulfilled",
          page_count: 3,
          created: 1_700_000_000,
          updated: "2026-07-17T10:00:00Z",
          signatures: [{ email: "private@example.com" }],
          texts: [{ data: "secret clause" }],
        }),
        { status: 200 },
      ),
    );
    const result = await new SignNowApiAdapter().getDocument("token", {
      documentId: "abc_123",
    });
    expect(result.document).toEqual({
      documentId: "abc_123",
      name: "NDA",
      status: "fulfilled",
      pageCount: 3,
      createdAt: 1_700_000_000,
      updatedAt: "2026-07-17T10:00:00Z",
      versionAt: null,
      template: null,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("secret clause");
  });

  it("rejects path traversal and invalid limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new SignNowApiAdapter();
    await expect(
      adapter.getDocument("token", { documentId: "../../users" }),
    ).rejects.toBeInstanceOf(SignNowApiError);
    await expect(
      adapter.listDocuments("token", { resultLimit: 26 }),
    ).rejects.toBeInstanceOf(SignNowApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
