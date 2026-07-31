import { MarketplaceConnectorRegistry } from "../connector-registry";
import { AsanaApiAdapter, AsanaApiError } from "./asana-api.adapter";
import { ASANA_CONNECTOR_MANIFEST } from "./asana.connector";

describe("Asana Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes six bounded tools under Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("asana")).toBe(ASANA_CONNECTOR_MANIFEST);
    expect(ASANA_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://app.asana.com/-/oauth_authorize",
      tokenUrl: "https://app.asana.com/-/oauth_token",
      pkce: true,
      requiredScopes: [
        "users:read",
        "workspaces:read",
        "projects:read",
        "tasks:read",
        "tasks:write",
      ],
      supportsRefresh: true,
    });
    expect(ASANA_CONNECTOR_MANIFEST.tools).toHaveLength(6);
    expect(
      ASANA_CONNECTOR_MANIFEST.tools.filter((tool) => tool.action === "write"),
    ).toHaveLength(2);
    expect(
      ASANA_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["asana_safe", "dangerously_skip_permissions"]);
  });

  it("uses bearer-only REST and keeps task search bounded", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                gid: "task-1",
                name: "Launch task",
                completed: false,
                permalink_url: "https://app.asana.com/0/0/task-1",
              },
            ],
            next_page: { offset: "next-secret" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const result = await new AsanaApiAdapter().searchTasks("secret-token", {
      workspaceGid: "workspace-1",
      query: "Launch",
      maxResults: 10,
    });
    expect(result).toMatchObject({
      count: 1,
      hasMore: true,
      nextPageFollowed: false,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/workspaces/workspace-1/tasks/search");
    expect(String(url)).toContain("limit=10");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer secret-token",
    });
    expect(String(url)).not.toContain("secret-token");
  });

  it("rejects an empty task update before provider access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new AsanaApiAdapter().updateTask("token", {
        taskGid: "task-1",
        idempotencyKey: "asana-test-1",
      }),
    ).rejects.toMatchObject<Partial<AsanaApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps paid-search and rate-limit failures to safe errors", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errors: [{ message: "private billing detail" }] }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      );
    await expect(
      new AsanaApiAdapter().searchTasks("token", {
        workspaceGid: "workspace-1",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      message:
        "Asana task search requires a paid workspace or eligible premium user",
    });
    await expect(
      new AsanaApiAdapter().listProjects("token", {
        workspaceGid: "workspace-1",
      }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      message: "Asana rate limit reached",
    });
  });
});
