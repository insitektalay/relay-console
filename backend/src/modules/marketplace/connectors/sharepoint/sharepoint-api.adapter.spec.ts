import {
  SharePointApiAdapter,
  SharePointApiError,
} from "./sharepoint-api.adapter";

describe("SharePointApiAdapter", () => {
  const siteId = "contoso.sharepoint.com,site-collection,site-web";

  it("uses only the selected site's fixed metadata endpoints and drops pagination and content", async () => {
    const calls: string[] = [];
    const adapter = new SharePointApiAdapter(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "list-1",
              displayName: "Product Roadmap",
              description: "Planning",
              webUrl:
                "https://contoso.sharepoint.com/sites/product/Lists/Roadmap",
              list: { template: "genericList", hidden: false },
              fields: [{ name: "Secret" }],
            },
          ],
          "@odata.nextLink": "https://graph.microsoft.com/secret-skip-token",
        }),
        { status: 200 },
      );
    });
    const result = await adapter.listLists("token", siteId);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`/v1.0/sites/${siteId}/lists`);
    expect(calls[0]).toContain("%24top=25");
    expect(result.lists[0]).toEqual(
      expect.objectContaining({
        id: "list-1",
        displayName: "Product Roadmap",
        template: "genericList",
        itemsAndFieldsExcluded: true,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("Secret");
    expect(JSON.stringify(result)).not.toContain("skip-token");
  });

  it("rejects unsafe or unbound site identifiers before provider I/O", async () => {
    const request = jest.fn();
    const adapter = new SharePointApiAdapter(request);
    await expect(
      adapter.getSite("token", "../sites/root"),
    ).rejects.toBeInstanceOf(SharePointApiError);
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on oversized responses and maps selected-site denial safely", async () => {
    const oversized = new SharePointApiAdapter(
      async () => new Response("x".repeat(1_000_001), { status: 200 }),
    );
    await expect(oversized.getSite("token", siteId)).rejects.toMatchObject({
      code: "sharepoint_response_too_large",
    });
    const denied = new SharePointApiAdapter(
      async () => new Response("{}", { status: 403 }),
    );
    await expect(denied.getSite("token", siteId)).rejects.toMatchObject({
      code: "sharepoint_permission_denied",
      statusCode: 403,
    });
  });
});
