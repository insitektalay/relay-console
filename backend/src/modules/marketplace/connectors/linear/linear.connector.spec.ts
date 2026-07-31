import { MarketplaceConnectorRegistry } from "../connector-registry";
import { LinearApiAdapter, LinearApiError } from "./linear-api.adapter";
import { LINEAR_CONNECTOR_MANIFEST } from "./linear.connector";

describe("Linear Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes eight bounded tools under Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("linear")).toBe(LINEAR_CONNECTOR_MANIFEST);
    expect(LINEAR_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://linear.app/oauth/authorize",
      tokenUrl: "https://api.linear.app/oauth/token",
      pkce: true,
      requiredScopes: ["read", "write"],
      supportsRefresh: true,
    });
    expect(LINEAR_CONNECTOR_MANIFEST.tools).toHaveLength(8);
    expect(
      LINEAR_CONNECTOR_MANIFEST.tools.filter((tool) => tool.action === "write"),
    ).toHaveLength(3);
    expect(
      LINEAR_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["linear_safe", "dangerously_skip_permissions"]);
  });

  it("uses bearer-only GraphQL and keeps issue search bounded", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              issues: {
                nodes: [
                  {
                    id: "issue-1",
                    identifier: "REL-1",
                    title: "Bounded issue",
                    url: "https://linear.app/relay/issue/REL-1/bounded-issue",
                    team: { id: "team-1", key: "REL", name: "Relay" },
                  },
                ],
                pageInfo: { hasNextPage: true },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const result = await new LinearApiAdapter().searchIssues(
      "secret-token",
      "Bounded",
      undefined,
      10,
    );
    expect(result).toMatchObject({
      count: 1,
      nextCursorFollowed: false,
      hasMore: true,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    });
    expect(String(init?.body)).not.toContain("secret-token");
    expect(JSON.parse(String(init?.body)).variables.first).toBe(10);
  });

  it("rejects an empty issue update before provider access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new LinearApiAdapter().updateIssue("token", {
        issueId: "REL-1",
        idempotencyKey: "linear-test-1",
      }),
    ).rejects.toMatchObject<Partial<LinearApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps GraphQL rate-limit errors without exposing provider details", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: [
              {
                message: "private quota detail",
                extensions: { code: "RATELIMITED" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    await expect(
      new LinearApiAdapter().listTeams("token", 1),
    ).rejects.toMatchObject<Partial<LinearApiError>>({
      code: "provider_rate_limited",
      message: "Linear rate limit reached",
    });
  });
});
