import { MarketplaceConnectorRegistry } from "../connector-registry";
import { NotionApiAdapter, NotionApiError } from "./notion-api.adapter";
import { NOTION_CONNECTOR_MANIFEST } from "./notion.connector";

describe("Notion Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes the bounded six-tool Safe and Dangerous contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("notion")).toBe(NOTION_CONNECTOR_MANIFEST);
    expect(NOTION_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
      tokenUrl: "https://api.notion.com/v1/oauth/token",
      pkce: false,
      supportsRefresh: true,
    });
    expect(NOTION_CONNECTOR_MANIFEST.tools).toHaveLength(6);
    expect(
      NOTION_CONNECTOR_MANIFEST.tools.filter((tool) => tool.action === "write"),
    ).toHaveLength(2);
    expect(
      NOTION_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["notion_safe", "dangerously_skip_permissions"]);
  });

  it("uses a pinned API version, bearer header, and bounded non-exhaustive search", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                object: "page",
                id: "0123456789abcdef0123456789abcdef",
                url: "https://www.notion.so/test",
                properties: { Name: { title: [{ plain_text: "Test page" }] } },
              },
            ],
            has_more: true,
            next_cursor: "ignored",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const result = await new NotionApiAdapter().search(
      "secret-access-token",
      "Test",
      10,
    );
    expect(result).toMatchObject({
      count: 1,
      nextCursorFollowed: false,
      exhaustive: false,
    });
    expect(result.results[0]).toMatchObject({
      object: "page",
      title: "Test page",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer secret-access-token",
      "Notion-Version": "2026-03-11",
    });
    expect(String(init?.body)).not.toContain("secret-access-token");
  });

  it("maps inaccessible objects to a safe provider validation error", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "object_not_found",
            message: "private details",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        ),
      );
    await expect(
      new NotionApiAdapter().getPage(
        "token",
        "0123456789abcdef0123456789abcdef",
      ),
    ).rejects.toMatchObject<Partial<NotionApiError>>({
      code: "provider_validation_error",
      message:
        "Notion could not access that object; it may not be shared with this connection",
    });
  });

  it("uses the caller-selected title property for an explicit data source parent", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          object: "page",
          id: "0123456789abcdef0123456789abcdef",
          url: "https://www.notion.so/test",
          properties: {},
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await new NotionApiAdapter().createPage("token", {
      parentType: "data_source_id",
      parentId: "fedcba9876543210fedcba9876543210",
      titlePropertyName: "Task name",
      title: "Write launch notes",
      children: [],
      idempotencyKey: "notion-create-1",
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.properties).toHaveProperty("Task name");
    expect(body.properties).not.toHaveProperty("title");
  });

  it("rejects unbounded block append payloads before provider access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const children = Array.from({ length: 51 }, () => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [] },
    }));
    await expect(
      new NotionApiAdapter().appendBlocks("token", {
        blockId: "0123456789abcdef0123456789abcdef",
        children,
        idempotencyKey: "notion-test-1",
      }),
    ).rejects.toMatchObject<Partial<NotionApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
