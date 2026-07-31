import { MarketplaceConnectorRegistry } from "../connector-registry";
import { TrelloApiAdapter, TrelloApiError } from "./trello-api.adapter";
import { TRELLO_CONNECTOR_MANIFEST } from "./trello.connector";

describe("Trello Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes eight bounded OAuth 1.0 tools under Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("trello")).toBe(TRELLO_CONNECTOR_MANIFEST);
    expect(TRELLO_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "oauth1",
      oauth: {
        authorizationUrl: "https://trello.com/1/OAuthAuthorizeToken",
        requiredScopes: ["read", "write"],
        pkce: false,
        supportsRefresh: false,
      },
    });
    expect(TRELLO_CONNECTOR_MANIFEST.tools).toHaveLength(8);
    expect(
      TRELLO_CONNECTOR_MANIFEST.tools.filter((tool) => tool.action === "write"),
    ).toHaveLength(3);
    expect(
      TRELLO_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["trello_safe", "dangerously_skip_permissions"]);
  });

  it("signs the temporary-token request without putting secrets in the URL", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        "oauth_token=request-token&oauth_token_secret=request-secret",
        {
          status: 200,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      ),
    );
    await expect(
      new TrelloApiAdapter().requestToken(
        "api-key",
        "api-secret",
        "https://api.relayconsole.work/api/v1/marketplace/oauth/trello/callback",
      ),
    ).resolves.toEqual({ token: "request-token", secret: "request-secret" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://trello.com/1/OAuthGetRequestToken");
    expect(init?.headers).toMatchObject({
      Authorization: expect.stringContaining("oauth_signature="),
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("api-secret");
  });

  it("uses the OAuth key/token header and keeps card search bounded", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          cards: [
            {
              id: "card-1",
              name: "Launch",
              url: "https://trello.com/c/card-1",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const result = await new TrelloApiAdapter().searchCards(
      { apiKey: "api-key", token: "user-token" },
      { query: "Launch", maxResults: 10 },
    );
    expect(result).toMatchObject({
      count: 1,
      resultLimit: 10,
      nextPageFollowed: false,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/1/search");
    expect(String(url)).toContain("cards_limit=10");
    expect(init?.headers).toMatchObject({
      Authorization:
        'OAuth oauth_consumer_key="api-key", oauth_token="user-token"',
    });
    expect(String(url)).not.toContain("user-token");
  });

  it("rejects empty writes and maps rate limits to safe errors", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new TrelloApiAdapter().updateCard(
        { apiKey: "key", token: "token" },
        { cardId: "card-1", idempotencyKey: "trello-test-1" },
      ),
    ).rejects.toMatchObject<Partial<TrelloApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "API_TOKEN_LIMIT_EXCEEDED" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(
      new TrelloApiAdapter().listBoards({ apiKey: "key", token: "token" }, {}),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      message: "Trello rate limit reached",
    });
  });
});
