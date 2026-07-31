import {
  DocuSignClmApiAdapter,
  DocuSignClmApiError,
} from "./docusign-clm-api.adapter";

describe("DocuSignClmApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const input = {
    apiOrigin: "https://api.s1.us.clm.docusign.net",
    accountId: "123e4567-e89b-42d3-a456-426614174000",
    folderId: "123e4567-e89b-42d3-a456-426614174001",
  };

  it("pins the account CLM host and minimizes folder metadata", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          Id: input.folderId,
          Name: "Legal",
          Type: "Folder",
          ParentFolderId: "123e4567-e89b-42d3-a456-426614174002",
          CreatedDate: "2026-01-01T00:00:00Z",
          Documents: [{ Name: "Private" }],
          Owner: { Email: "private@example.com" },
          Href: "private",
        }),
        { status: 200 },
      ),
    );
    const result = await new DocuSignClmApiAdapter().read(
      "oauth-access-token",
      "folder.get",
      input,
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL(
        `${input.apiOrigin}/v2/${input.accountId}/folders/${input.folderId}`,
      ),
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-access-token",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      accountId: input.accountId,
      folderId: input.folderId,
      folder: {
        Id: input.folderId,
        Name: "Legal",
        Type: "Folder",
        ParentFolderId: "123e4567-e89b-42d3-a456-426614174002",
        CreatedDate: "2026-01-01T00:00:00Z",
      },
    });
  });

  it("blocks arbitrary hosts and document operations", () => {
    expect(() =>
      new DocuSignClmApiAdapter().read("token", "documents.get", input),
    ).toThrow(DocuSignClmApiError);
    expect(() =>
      new DocuSignClmApiAdapter().read("token", "folder.get", {
        ...input,
        apiOrigin: "https://example.com",
      }),
    ).toThrow("account-issued");
  });
});
