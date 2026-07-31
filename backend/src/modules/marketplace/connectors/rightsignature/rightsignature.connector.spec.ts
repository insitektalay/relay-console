import {
  RightSignatureApiAdapter,
  RightSignatureApiError,
} from "./rightsignature-api.adapter";
import { RIGHTSIGNATURE_CONNECTOR_MANIFEST } from "./rightsignature.connector";

describe("RightSignature connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses only the read scope and exposes two fixed reads", () => {
    expect(
      RIGHTSIGNATURE_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes,
    ).toEqual(["read"]);
    expect(RIGHTSIGNATURE_CONNECTOR_MANIFEST.tools).toHaveLength(2);
    expect(
      RIGHTSIGNATURE_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && !tool.approvalRequired,
      ),
    ).toBe(true);
  });
  it("lists at most 25 summaries and strips people, files, and signing data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            documents: Array.from({ length: 30 }, (_, i) => ({
              id: `4840dd4f-2c13-4395-a0e0-3577d1eed6${String(i).padStart(2, "0")}`,
              name: `Document ${i}`,
              state: "pending",
              filename: "private.pdf",
              roles: [{ signer_email: "private@example.com" }],
              signed_pdf_url: "https://private.example/signed",
            })),
          }),
          { status: 200 },
        ),
      );
    const result = await new RightSignatureApiAdapter().listDocuments("token", {
      state: "pending",
      resultLimit: 25,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.rightsignature.com/public/v2/documents?per_page=25&page=1&state=pending",
    );
    expect(result.documents).toHaveLength(25);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("private.pdf");
    expect(JSON.stringify(result)).not.toContain("private.example");
  });
  it("reads one fixed document and projects lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            document: {
              id: "4840dd4f-2c13-4395-a0e0-3577d1eed6fd",
              name: "NDA",
              state: "executed",
              created_at: "2026-07-17T10:00:00Z",
              filename: "private.pdf",
              roles: [{ signer_email: "private@example.com" }],
            },
          }),
          { status: 200 },
        ),
      );
    const result = await new RightSignatureApiAdapter().getDocument("token", {
      documentId: "4840dd4f-2c13-4395-a0e0-3577d1eed6fd",
    });
    expect(result.document).toEqual({
      documentId: "4840dd4f-2c13-4395-a0e0-3577d1eed6fd",
      name: "NDA",
      state: "executed",
      createdAt: "2026-07-17T10:00:00Z",
      updatedAt: null,
      sentAt: null,
      executedAt: null,
      expiredAt: null,
      declinedAt: null,
      voidedAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });
  it("rejects invalid IDs, states, and limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new RightSignatureApiAdapter();
    await expect(
      adapter.getDocument("token", { documentId: "../secret" }),
    ).rejects.toBeInstanceOf(RightSignatureApiError);
    await expect(
      adapter.listDocuments("token", { state: "all" }),
    ).rejects.toBeInstanceOf(RightSignatureApiError);
    await expect(
      adapter.listDocuments("token", { state: "pending", resultLimit: 26 }),
    ).rejects.toBeInstanceOf(RightSignatureApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
