import { OneDriveApiAdapter, OneDriveApiError } from "./onedrive-api.adapter";

describe("OneDriveApiAdapter", () => {
  it("uses only fixed own-drive metadata endpoints and returns useful bounded fields", async () => {
    const calls: string[] = [];
    const adapter = new OneDriveApiAdapter(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "item_1",
              name: "Budget.xlsx",
              size: 42,
              createdDateTime: "2026-07-01T00:00:00Z",
              lastModifiedDateTime: "2026-07-02T00:00:00Z",
              webUrl: "https://tenant-my.sharepoint.com/item",
              file: {
                mimeType: "application/vnd.ms-excel",
                hashes: { quickXorHash: "hash" },
              },
              "@microsoft.graph.downloadUrl": "https://secret.example",
            },
          ],
          "@odata.nextLink":
            "https://graph.microsoft.com/v1.0/me/drive/root/children?$skiptoken=secret",
        }),
        { status: 200 },
      );
    });
    const result = await adapter.listRootItems("token");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/v1.0/me/drive/root/children");
    expect(calls[0]).toContain("%24top=25");
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: "item_1",
          name: "Budget.xlsx",
          kind: "file",
          mimeType: "application/vnd.ms-excel",
        }),
      ],
      resultCount: 1,
      nextPageFollowed: false,
    });
    expect(JSON.stringify(result)).not.toContain("downloadUrl");
    expect(JSON.stringify(result)).not.toContain("skiptoken");
  });

  it("rejects unsafe identifiers before provider I/O", async () => {
    const request = jest.fn();
    const adapter = new OneDriveApiAdapter(request);
    await expect(
      adapter.getItem("token", { itemId: "../../content" }),
    ).rejects.toBeInstanceOf(OneDriveApiError);
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on oversized responses and maps throttling safely", async () => {
    const oversized = new OneDriveApiAdapter(
      async () => new Response("x".repeat(1_000_001), { status: 200 }),
    );
    await expect(oversized.getDrive("token")).rejects.toMatchObject({
      code: "onedrive_response_too_large",
    });
    const throttled = new OneDriveApiAdapter(
      async () => new Response("{}", { status: 429 }),
    );
    await expect(throttled.getDrive("token")).rejects.toMatchObject({
      code: "onedrive_rate_limited",
      statusCode: 429,
    });
  });
});
