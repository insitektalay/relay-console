import {
  MicrosoftListsApiAdapter,
  MicrosoftListsApiError,
  type MicrosoftListsBinding,
} from "./microsoft-lists-api.adapter";

const binding: MicrosoftListsBinding = {
  siteId: "contoso.sharepoint.com,site-collection,site-web",
  listId: "list-001",
  allowedFieldNames: ["Status", "Title"],
};

describe("MicrosoftListsApiAdapter", () => {
  it("queries only the bound list and returns only approved fields without identities or pagination", async () => {
    const calls: string[] = [];
    const adapter = new MicrosoftListsApiAdapter(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "1",
              fields: {
                Title: "Finalize launch",
                Status: "Ready",
                Person: { email: "private@example.com" },
                SecretNotes: "do not expose",
              },
              createdBy: { user: { email: "creator@example.com" } },
            },
          ],
          "@odata.nextLink": "https://graph.microsoft.com/secret-skip-token",
        }),
        { status: 200 },
      );
    });
    const result = await adapter.listItems("token", binding);
    const url = new URL(calls[0]);
    expect(url.pathname).toBe(
      "/v1.0/sites/contoso.sharepoint.com,site-collection,site-web/lists/list-001/items",
    );
    expect(url.searchParams.get("$expand")).toBe(
      "fields($select=Status,Title)",
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: "1",
        fields: { Title: "Finalize launch", Status: "Ready" },
        fieldPolicyApplied: true,
        identitiesAttachmentsExcluded: true,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("creator@example.com");
    expect(JSON.stringify(result)).not.toContain("do not expose");
    expect(JSON.stringify(result)).not.toContain("skip-token");
  });

  it("rejects unsafe bindings and identifiers before provider I/O", async () => {
    const request = jest.fn();
    const adapter = new MicrosoftListsApiAdapter(request);
    await expect(
      adapter.getItem(
        "token",
        { ...binding, allowedFieldNames: ["unsafe field"] },
        { itemId: "1" },
      ),
    ).rejects.toBeInstanceOf(MicrosoftListsApiError);
    await expect(
      adapter.getItem("token", binding, { itemId: "../permissions" }),
    ).rejects.toBeInstanceOf(MicrosoftListsApiError);
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on oversized responses and maps throttling safely", async () => {
    const oversized = new MicrosoftListsApiAdapter(
      async () => new Response("x".repeat(1_000_001), { status: 200 }),
    );
    await expect(oversized.health("token", binding)).rejects.toMatchObject({
      code: "microsoft_lists_response_too_large",
    });
    const throttled = new MicrosoftListsApiAdapter(
      async () => new Response("{}", { status: 429 }),
    );
    await expect(throttled.health("token", binding)).rejects.toMatchObject({
      code: "microsoft_lists_rate_limited",
      statusCode: 429,
    });
  });
});
