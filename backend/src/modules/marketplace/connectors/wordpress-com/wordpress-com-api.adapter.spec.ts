import {
  WordPressComApiAdapter,
  WordPressComApiError,
} from "./wordpress-com-api.adapter";
import {
  WORDPRESS_COM_CONNECTOR_MANIFEST,
  WORDPRESS_COM_SCOPES,
} from "./wordpress-com.connector";

describe("WordPress.com connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses specific-blog Relay-owned OAuth and eight bounded tools", () => {
    expect(WORDPRESS_COM_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://public-api.wordpress.com/oauth2/authorize",
      tokenUrl: "https://public-api.wordpress.com/oauth2/token",
      requiredScopes: WORDPRESS_COM_SCOPES,
      pkce: false,
      supportsRefresh: false,
    });
    expect(WORDPRESS_COM_CONNECTOR_MANIFEST.tools).toHaveLength(8);
    expect(
      WORDPRESS_COM_CONNECTOR_MANIFEST.tools.filter(
        (tool) => tool.approvalRequired,
      ),
    ).toHaveLength(3);
    expect(
      WORDPRESS_COM_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates token ownership and its specific blog", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            client_id: "client-1",
            user_id: "42",
            blog_id: "99",
            scope: "sites,posts",
          }),
          { status: 200 },
        ),
      );
    const result = await new WordPressComApiAdapter().tokenInfo(
      "token",
      "client-1",
    );
    const url = new URL(fetchMock.mock.calls[0][0].toString());
    expect(url.origin + url.pathname).toBe(
      "https://public-api.wordpress.com/oauth2/token-info",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("token")).toBe("token");
    expect(result).toMatchObject({
      clientId: "client-1",
      userId: "42",
      blogId: "99",
      scopes: WORDPRESS_COM_SCOPES,
    });
  });

  it("forces draft creation and disables public sharing", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ID: 7,
            site_ID: 99,
            status: "draft",
            title: "Review me",
            content: "Draft body",
            modified: "2026-07-16T12:00:00Z",
          }),
          { status: 200 },
        ),
      );
    const result = await new WordPressComApiAdapter().createDraft(
      "token",
      "99",
      {
        siteId: "99",
        title: "Review me",
        content: "Draft body",
        approvalId: "approval-1",
        idempotencyKey: "idem-1",
      },
    );
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://public-api.wordpress.com/rest/v1.1/sites/99/posts/new",
    );
    const body = new URLSearchParams(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    );
    expect(body.get("status")).toBe("draft");
    expect(body.get("publicize")).toBe("false");
    expect(result).toMatchObject({
      operation: "create_draft",
      post: { id: "7", status: "draft" },
      idempotencyKey: "idem-1",
    });
  });

  it("rejects stale draft updates before a provider mutation", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ID: 7,
            site_ID: 99,
            status: "draft",
            modified: "2026-07-16T12:05:00Z",
          }),
          { status: 200 },
        ),
      );
    await expect(
      new WordPressComApiAdapter().updateDraft("token", "99", {
        siteId: "99",
        postId: "7",
        expectedModified: "2026-07-16T12:00:00Z",
        title: "Changed",
        approvalId: "approval-1",
        idempotencyKey: "idem-1",
      }),
    ).rejects.toThrow(WordPressComApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET" });
  });

  it("prepares locally and rejects a site outside the grant", () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new WordPressComApiAdapter();
    const prepared = adapter.preparePostChange("99", {
      operation: "create_draft",
      siteId: "99",
      title: "Draft",
      content: "Body",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prepared).toMatchObject({
      providerMutation: false,
      providerRequestCount: 0,
      change: { operation: "create_draft", siteId: "99" },
    });
    expect(prepared.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      adapter.preparePostChange("99", {
        operation: "create_draft",
        siteId: "100",
        title: "Draft",
        content: "Body",
      }),
    ).toThrow(WordPressComApiError);
  });
});
