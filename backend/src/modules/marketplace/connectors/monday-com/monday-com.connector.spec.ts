import {
  MondayComApiAdapter,
  MondayComApiError,
} from "./monday-com-api.adapter";
import { MONDAY_COM_CONNECTOR_MANIFEST } from "./monday-com.connector";

describe("Monday.com Marketplace connector", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("publishes eight bounded OAuth 2.1 tools under Safe and Dangerous policies", () => {
    expect(MONDAY_COM_CONNECTOR_MANIFEST.tools).toHaveLength(8);
    expect(MONDAY_COM_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://auth.monday.com/oauth2/authorize",
      tokenUrl: "https://auth.monday.com/oauth_ms/oauth/token",
      refreshUrl: "https://auth.monday.com/oauth_ms/oauth/token",
      revocationUrl: "https://auth.monday.com/oauth_ms/oauth/revoke",
      pkce: true,
      supportsRefresh: true,
    });
    expect(
      MONDAY_COM_CONNECTOR_MANIFEST.approvalProfiles[0].allowedActions,
    ).toHaveLength(5);
    expect(
      MONDAY_COM_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions,
    ).toHaveLength(3);
    expect(
      MONDAY_COM_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions,
    ).toHaveLength(8);
  });

  it("uses versioned GraphQL and keeps board item reads on one bounded page", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            boards: [
              {
                id: "1",
                name: "Launch",
                items_page: {
                  cursor: "next",
                  items: [
                    { id: "2", name: "Ship Relay", column_values: [] },
                    { id: "3", name: "Other", column_values: [] },
                  ],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;
    const result = await new MondayComApiAdapter().listBoardItems(
      "secret-token",
      { boardId: "1", query: "relay", maxResults: 5 },
    );
    expect(result.items).toHaveLength(1);
    expect(result.nextPageFollowed).toBe(false);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe("https://api.monday.com/v2");
    expect(init.headers.Authorization).toBe("secret-token");
    expect(init.headers["API-Version"]).toBe("2026-04");
    expect(String(init.body)).not.toContain("secret-token");
  });

  it("normalizes an item write without exposing the token", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              create_item: {
                id: "2",
                name: "Ship",
                url: "https://relay.monday.com/boards/1/pulses/2",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch;
    const result = await new MondayComApiAdapter().createItem("secret-token", {
      boardId: "1",
      groupId: "topics",
      name: "Ship",
      columnValues: { status: { label: "Done" } },
      idempotencyKey: "monday-create-1",
    });
    expect(result).toMatchObject({
      boardId: "1",
      idempotencyKey: "monday-create-1",
    });
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.variables).toMatchObject({
      boardId: "1",
      groupId: "topics",
      name: "Ship",
      columnValues: JSON.stringify({ status: { label: "Done" } }),
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("rejects empty updates and maps GraphQL complexity errors safely", async () => {
    await expect(
      new MondayComApiAdapter().updateItem("token", {
        boardId: "1",
        itemId: "2",
        idempotencyKey: "monday-update-1",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: [
              {
                message: "limit",
                extensions: { code: "COMPLEXITY_BUDGET_EXHAUSTED" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch;
    await expect(
      new MondayComApiAdapter().listBoards("token", {}),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MondayComApiError>>({
        code: "provider_rate_limited",
        statusCode: 200,
      }),
    );
  });
});
