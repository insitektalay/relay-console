import { WebflowApiAdapter, WebflowApiError } from "./webflow-api.adapter";
import {
  WEBFLOW_CONNECTOR_MANIFEST,
  WEBFLOW_SCOPES,
} from "./webflow.connector";

describe("Webflow connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses Relay-owned non-refreshable OAuth and nine bounded tools", () => {
    expect(WEBFLOW_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://webflow.com/oauth/authorize",
      tokenUrl: "https://api.webflow.com/oauth/access_token",
      revocationUrl: "https://webflow.com/oauth/revoke_authorization",
      requiredScopes: WEBFLOW_SCOPES,
      pkce: false,
      supportsRefresh: false,
    });
    expect(WEBFLOW_CONNECTOR_MANIFEST.tools).toHaveLength(9);
    expect(
      WEBFLOW_CONNECTOR_MANIFEST.tools.filter((tool) => tool.approvalRequired),
    ).toHaveLength(2);
    expect(
      WEBFLOW_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });
  it("preserves authorization binding while bounding sites", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          authorization: {
            id: "auth-1",
            grantType: "authorization_code",
            rateLimit: 60,
            scope: "sites:read,cms:read,cms:write",
            authorizedTo: {
              siteIds: ["site-1"],
              workspaceIds: ["workspace-1"],
              userIds: ["user-1"],
            },
          },
          application: { id: "app-1", displayName: "Relay Console" },
        }),
        { status: 200 },
      ),
    );
    const result = await new WebflowApiAdapter().authorization("token");
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.webflow.com/v2/token/introspect",
    );
    expect(result).toMatchObject({
      authorization: {
        id: "auth-1",
        rateLimit: 60,
        siteIds: ["site-1"],
        workspaceIds: ["workspace-1"],
        userIds: ["user-1"],
        scopes: WEBFLOW_SCOPES,
      },
      application: { id: "app-1" },
    });
  });
  it("updates one staged item through the current bulk route without publishing", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: "item-1", isDraft: true, fieldData: { name: "Draft" } },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new WebflowApiAdapter().updateStagedItem("token", {
      collectionId: "collection-1",
      itemId: "item-1",
      fieldData: { name: "Draft" },
      idempotencyKey: "idem-1",
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.webflow.com/v2/collections/collection-1/items?skipInvalidFiles=false",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({
        items: [{ id: "item-1", fieldData: { name: "Draft" } }],
      }),
    });
    expect(result).toMatchObject({
      operation: "update",
      contentState: "staged",
      item: { id: "item-1", isDraft: true },
      idempotencyKey: "idem-1",
    });
  });
  it("prepares locally and rejects an unbounded publication", () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new WebflowApiAdapter();
    const result = adapter.prepareItemChange({
      operation: "publish",
      collectionId: "collection-1",
      itemIds: ["item-1"],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      providerMutation: false,
      providerRequestCount: 0,
      change: { operation: "publish", itemIds: ["item-1"] },
    });
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      adapter.prepareItemChange({
        operation: "publish",
        collectionId: "collection-1",
        itemIds: Array.from({ length: 26 }, (_, index) => `item-${index}`),
      }),
    ).toThrow(WebflowApiError);
  });
});
