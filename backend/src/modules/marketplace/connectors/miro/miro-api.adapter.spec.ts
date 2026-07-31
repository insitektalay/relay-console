import { MiroApiAdapter, MiroApiError } from "./miro-api.adapter";
import { MIRO_CONNECTOR_MANIFEST, MIRO_SCOPES } from "./miro.connector";

describe("Miro connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses Relay-owned rotating OAuth and eight bounded tools", () => {
    expect(MIRO_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://miro.com/oauth/authorize",
      tokenUrl: "https://api.miro.com/v1/oauth/token",
      refreshUrl: "https://api.miro.com/v1/oauth/token",
      revocationUrl: "https://api.miro.com/v2/oauth/revoke",
      requiredScopes: MIRO_SCOPES,
      supportsRefresh: true,
    });
    expect(MIRO_CONNECTOR_MANIFEST.tools).toHaveLength(8);
    expect(
      MIRO_CONNECTOR_MANIFEST.tools.filter((tool) => tool.approvalRequired),
    ).toHaveLength(3);
    expect(
      MIRO_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("preserves bounded board-item spatial semantics", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "item-1",
                type: "sticky_note",
                data: { content: "Plan" },
                position: { x: 10, y: 20, origin: "center" },
                geometry: { width: 200, height: 100, rotation: 0 },
                parent: { id: "frame-1" },
                createdBy: { id: "u1", name: "Alex" },
              },
            ],
            cursor: "next",
          }),
          { status: 200 },
        ),
      );
    const result = await new MiroApiAdapter().listBoardItems("token", {
      boardId: "board-1",
      maxResults: 10,
    });
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      "/v2/boards/board-1/items?limit=10",
    );
    expect(result).toMatchObject({
      boardId: "board-1",
      cursor: "next",
      nextPageFollowed: false,
      items: [
        {
          itemType: "sticky_note",
          content: "Plan",
          position: { x: 10, y: 20 },
          geometry: { width: 200, height: 100 },
          parent: { id: "frame-1" },
        },
      ],
    });
  });

  it("creates only a fixed-origin bounded sticky note", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "item-2",
            type: "sticky_note",
            data: { content: "Ship" },
          }),
          { status: 201 },
        ),
      );
    const result = await new MiroApiAdapter().createStickyNote("token", {
      boardId: "board-1",
      content: "Ship",
      x: 5,
      y: 7,
      idempotencyKey: "idem-1",
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.miro.com/v2/boards/board-1/sticky_notes",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(result).toMatchObject({
      operation: "sticky_note",
      idempotencyKey: "idem-1",
      item: { id: "item-2" },
    });
  });

  it("prepares updates locally without provider traffic", () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const result = new MiroApiAdapter().prepareItemChange({
      operation: "update",
      boardId: "board-1",
      itemId: "item-1",
      itemType: "card",
      content: "Ready",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      providerMutation: false,
      providerRequestCount: 0,
      change: { operation: "update", itemType: "card" },
    });
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects unsupported item types and unsafe identifiers", async () => {
    await expect(
      new MiroApiAdapter().updateItem("token", {
        boardId: "../board",
        itemId: "item",
        itemType: "card",
        content: "x",
        idempotencyKey: "i",
      }),
    ).rejects.toMatchObject<Partial<MiroApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      new MiroApiAdapter().updateItem("token", {
        boardId: "board",
        itemId: "item",
        itemType: "connector",
        content: "x",
        idempotencyKey: "i",
      }),
    ).rejects.toMatchObject<Partial<MiroApiError>>({
      code: "provider_validation_error",
    });
  });
});
