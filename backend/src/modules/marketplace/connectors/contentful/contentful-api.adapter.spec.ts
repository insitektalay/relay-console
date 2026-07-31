import { ContentfulApiAdapter, ContentfulApiError } from "./contentful-api.adapter";
import { CONTENTFUL_CONNECTOR_MANIFEST } from "./contentful.connector";

describe("Contentful connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("defines eleven exact tools and Safe versus Dangerous authority", () => {
    expect(CONTENTFUL_CONNECTOR_MANIFEST.tools).toHaveLength(11);
    expect(CONTENTFUL_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: { requiredScopes: ["content_management_manage"], supportsRefresh: false },
    });
    expect(CONTENTFUL_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map((action) => action.id)).toEqual([
      "contentful_entry_create_draft",
      "contentful_entry_update_draft",
      "contentful_entry_publish",
    ]);
    expect(CONTENTFUL_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("pins the CMA host and creates drafts with the required content type", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sys: { id: "entry1", version: 1 }, apiKey: "leak" }), { status: 201 }),
    );
    const result = await new ContentfulApiAdapter().createDraft(
      "token-value", "https://api.contentful.com",
      { spaceId: "space1", environmentId: "master", contentTypeId: "article", fields: { title: { "en-US": "Draft" } } },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.contentful.com/spaces/space1/environments/master/entries");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", redirect: "error", cache: "no-store" });
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-value");
    expect(headers["X-Contentful-Content-Type"]).toBe("article");
    expect(result).toMatchObject({ apiKey: "[redacted]" });
    expect(JSON.stringify(result)).not.toContain("token-value");
  });

  it("uses exact version headers for draft updates and publication", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ sys: { id: "entry1", version: 8 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sys: { id: "entry1", version: 9 } }), { status: 200 }));
    const adapter = new ContentfulApiAdapter();
    await adapter.updateDraft("token", "https://api.eu.contentful.com", { spaceId: "space1", environmentId: "master", entryId: "entry1", expectedVersion: 7, fields: { title: { "en-US": "Updated" } } });
    await adapter.publishEntry("token", "https://api.eu.contentful.com", { spaceId: "space1", environmentId: "master", entryId: "entry1", expectedVersion: 8 });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.eu.contentful.com/spaces/space1/environments/master/entries/entry1");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)["X-Contentful-Version"]).toBe("7");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/entries/entry1/published");
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>)["X-Contentful-Version"]).toBe("8");
  });

  it("rejects untrusted hosts, invalid IDs, unbounded pages, and stale versions", async () => {
    const adapter = new ContentfulApiAdapter();
    await expect(adapter.listSpaces("token", "https://evil.example", {})).rejects.toMatchObject<Partial<ContentfulApiError>>({ code: "connection_not_ready" });
    await expect(adapter.getSpace("token", "https://api.contentful.com", { spaceId: "../bad" })).rejects.toMatchObject<Partial<ContentfulApiError>>({ code: "provider_validation_error" });
    await expect(adapter.listSpaces("token", "https://api.contentful.com", { limit: 1000 })).rejects.toMatchObject<Partial<ContentfulApiError>>({ code: "provider_validation_error" });
    await expect(adapter.publishEntry("token", "https://api.contentful.com", { spaceId: "space1", environmentId: "master", entryId: "entry1", expectedVersion: 0 })).rejects.toMatchObject<Partial<ContentfulApiError>>({ code: "provider_validation_error" });
  });
});
